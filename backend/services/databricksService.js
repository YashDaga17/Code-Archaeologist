// ═══════════════════════════════════════════════════════════════
// DATABRICKS SERVICE — AI Intelligence Engine
// ═══════════════════════════════════════════════════════════════

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  envFlag,
  normalizeDatabricksHost,
  redactSensitiveText,
  redactSensitiveTextWithStats,
  redactSensitiveValue,
  sanitizeErrorMessage,
  stripRawCheckpointFields,
} from './security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const DATABRICKS_HOST = process.env.DATABRICKS_HOST || '';
const DATABRICKS_TOKEN = process.env.DATABRICKS_TOKEN || '';
const DATABRICKS_MODEL = process.env.DATABRICKS_MODEL_ENDPOINT || 'system.ai.llama-4-maverick';
const DATABRICKS_API_MODE = process.env.DATABRICKS_API_MODE || 'auto';

const LAKEHOUSE_DIR = path.resolve(__dirname, '../data/lakehouse');
const LAKEHOUSE_FILE = path.join(LAKEHOUSE_DIR, 'checkpoints_delta.jsonl');

let cachedOAuthToken = null;
let tokenExpiry = 0;

export async function getAuthToken() {
  if (process.env.DATABRICKS_TOKEN) {
    return process.env.DATABRICKS_TOKEN;
  }
  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;
  const host = process.env.DATABRICKS_HOST || DATABRICKS_HOST;
  if (clientId && clientSecret && host) {
    const hostInfo = normalizeDatabricksHost(host);
    if (!hostInfo.ok) {
      console.warn('[Databricks OAuth] Refusing token exchange:', hostInfo.error);
      return '';
    }
    if (cachedOAuthToken && Date.now() < tokenExpiry) {
      return cachedOAuthToken;
    }
    try {
      const tokenUrl = `${hostInfo.baseUrl}/oidc/v1/token`;
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'all-apis'
        })
      });
      if (res.ok) {
        const data = await res.json();
        cachedOAuthToken = data.access_token;
        tokenExpiry = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
        return cachedOAuthToken;
      }
    } catch (e) {
      console.warn('[Databricks OAuth] Failed to exchange Service Principal credentials:', sanitizeErrorMessage(e));
    }
  }
  return '';
}

export function isDatabricksConfigured() {
  const host = process.env.DATABRICKS_HOST || DATABRICKS_HOST;
  const hasToken = !!(process.env.DATABRICKS_TOKEN || DATABRICKS_TOKEN || (process.env.DATABRICKS_CLIENT_ID && process.env.DATABRICKS_CLIENT_SECRET));
  const model = process.env.DATABRICKS_MODEL_ENDPOINT || DATABRICKS_MODEL;
  const hostInfo = host ? normalizeDatabricksHost(host) : { ok: false, safeHost: null, error: null };
  return {
    configured: !!(hostInfo.ok && hasToken),
    host: hostInfo.ok ? hostInfo.safeHost : null,
    model: model,
    model_name: model.includes('maverick') ? 'Llama 4 Maverick' : (model.includes('70b') ? 'Llama 3.3 70B' : model),
    type: model.startsWith('system.ai') ? 'AI Gateway (MLflow Chat Completions)' : 'Model Serving Endpoint',
    api_mode: process.env.DATABRICKS_API_MODE || DATABRICKS_API_MODE,
    security_warning: host && !hostInfo.ok ? hostInfo.error : null
  };
}

function extractMessageText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(part => part?.text || part?.content || '')
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function extractResponseText(result) {
  if (result.output_text) return result.output_text;
  const blocks = result.output || [];
  return blocks
    .flatMap(item => item.content || [])
    .map(part => part.text || part.content || '')
    .filter(Boolean)
    .join('\n');
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function normalizeFiles(metadata) {
  return uniqueStrings([
    ...asArray(metadata?.files_touched),
    ...asArray(metadata?.files),
    ...asArray(metadata?.sessions).flatMap(session => asArray(session?.files_touched))
  ].map(file => typeof file === 'string' ? file : (file?.path || file?.file || '')));
}

function checkpointEvidenceLabel(metadata = {}) {
  const checkpointId = metadata.checkpoint_id || metadata.id || 'unknown-checkpoint';
  const sessionId = metadata.session_id || metadata.sessions?.[0]?.session_id;
  return sessionId ? `Entire checkpoint ${checkpointId}, session ${sessionId}` : `Entire checkpoint ${checkpointId}`;
}

function redactContextText(value, privacyStats) {
  if (value === undefined || value === null) return null;
  const result = redactSensitiveTextWithStats(value);
  privacyStats.sensitive_values_redacted += result.redactions;
  return result.text;
}

function chunkText(text, chunkSize = 4500, maxChunks = 4) {
  const raw = String(text || '');
  const chunks = [];
  const maxChars = chunkSize * maxChunks;
  const included = raw.slice(0, maxChars);

  for (let start = 0; start < included.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, included.length);
    chunks.push({
      chunk_id: `transcript-${chunks.length + 1}`,
      start_char: start,
      end_char: end,
      text: included.slice(start, end)
    });
  }

  return {
    original_chars: raw.length,
    included_chars: included.length,
    truncated: raw.length > included.length,
    chunks
  };
}

function extractEvidenceLines(transcript) {
  const lines = String(transcript || '')
    .split(/\r?\n/)
    .map((text, index) => ({ line: index + 1, text: text.trim().slice(0, 700) }))
    .filter(line => line.text);

  const pick = regex => lines.filter(line => regex.test(line.text)).slice(0, 12);
  return {
    prompt_lines: pick(/(\[USER\]|"type":"user"|user prompt|original intent|asked|request)/i),
    attempt_lines: pick(/(\[AGENT\]|toolCalls|created|edited|implemented|attempt|trying|ran|command)/i),
    failed_or_unresolved_lines: pick(/(failed|error|blocked|defer|pending|unfinished|missing|not implemented|remain)/i),
    decision_lines: pick(/(decided|assumed|because|rationale|tradeoff|approach|chose)/i)
  };
}

function emptyTranscriptEnvelope(originalChars) {
  return {
    original_chars: originalChars,
    included_chars: 0,
    truncated: originalChars > 0,
    chunks: [],
    withheld: true,
    withheld_reason: 'Raw prompt and transcript content is not sent to external model services by default.'
  };
}

function buildStructuredCheckpointContext(metadata, transcriptData) {
  const privacyStats = { sensitive_values_redacted: 0 };
  const allowExternalPromptContext = envFlag('CODE_ARCHAEOLOGIST_ALLOW_EXTERNAL_PROMPT_CONTEXT');
  const transcript = redactContextText(transcriptData || metadata?.transcript || metadata?.explanation_raw || '', privacyStats) || '';
  const files = normalizeFiles(metadata).map(file => redactContextText(file, privacyStats)).filter(Boolean);
  const sessions = asArray(metadata?.sessions).map(session => ({
    session_id: redactContextText(session.session_id, privacyStats),
    agent: redactContextText(session.agent, privacyStats),
    model: redactContextText(session.model, privacyStats),
    turn_id: redactContextText(session.turn_id, privacyStats),
    created_at: session.created_at,
    files_touched: asArray(session.files_touched)
      .map(file => redactContextText(typeof file === 'string' ? file : (file?.path || file?.file || ''), privacyStats))
      .filter(Boolean)
  }));
  const checkpointId = redactContextText(metadata?.checkpoint_id || metadata?.id, privacyStats);
  const sessionId = redactContextText(metadata?.session_id, privacyStats) || sessions[0]?.session_id || null;
  const checkpointMetadata = {
    checkpoint_id: checkpointId,
    strategy: redactContextText(metadata?.strategy, privacyStats),
    branch: redactContextText(metadata?.branch, privacyStats),
    message: allowExternalPromptContext
      ? redactContextText(metadata?.message || metadata?.summary, privacyStats)
      : (metadata?.message || metadata?.summary ? '[WITHHELD_BY_PRIVACY_BOUNDARY]' : null),
    agent: redactContextText(metadata?.agent, privacyStats) || uniqueStrings(sessions.map(s => s.agent)).join(', ') || null,
    model: redactContextText(metadata?.model, privacyStats) || uniqueStrings(sessions.map(s => s.model)).join(', ') || null,
    files_touched: files,
    sessions_count: metadata?.session_count || metadata?.sessions_count || sessions.length,
    sessions
  };

  return {
    adapter_version: 'checkpoint-context-v2',
    privacy_boundary: {
      applied: true,
      raw_prompts_sent_to_model: false,
      raw_transcript_sent_to_model: false,
      redacted_prompt_or_transcript_excerpts_sent_to_model: allowExternalPromptContext,
      external_prompt_context_opt_in_env: 'CODE_ARCHAEOLOGIST_ALLOW_EXTERNAL_PROMPT_CONTEXT',
      sensitive_values_redacted: privacyStats.sensitive_values_redacted,
      policy: allowExternalPromptContext
        ? 'known tokens, credentials, private keys, secret assignments, and emails are redacted before model invocation'
        : 'raw prompt text, transcript text, and checkpoint prompt messages are withheld before external model invocation'
    },
    provenance: {
      evidence_class: metadata?.is_demo ? 'SAMPLE DEMO' : 'REAL ENTIRE EVIDENCE',
      checkpoint_id: checkpointId,
      session_id: sessionId,
      source_tool: 'Entire CLI',
      source_commands: [
        'entire checkpoint explain <checkpoint-id> --json',
        'entire checkpoint explain <checkpoint-id> --transcript'
      ]
    },
    checkpoint_metadata: checkpointMetadata,
    scoped_evidence: allowExternalPromptContext ? extractEvidenceLines(transcript) : {
      prompt_lines: [],
      attempt_lines: [],
      failed_or_unresolved_lines: [],
      decision_lines: [],
      withheld: true,
      original_line_count: transcript ? transcript.split(/\r?\n/).filter(Boolean).length : 0
    },
    transcript: allowExternalPromptContext ? chunkText(transcript) : emptyTranscriptEnvelope(transcript.length)
  };
}

function clampConfidence(value, fallback = 0.75) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function normalizeVerificationStatus(status) {
  const normalized = String(status || 'UNVERIFIED').toUpperCase();
  return ['VERIFIED', 'PARTIALLY_VERIFIED', 'UNVERIFIED', 'CONTRADICTED'].includes(normalized)
    ? normalized
    : 'UNVERIFIED';
}

function normalizeRequirementStatus(status) {
  const normalized = String(status || 'UNVERIFIED').toUpperCase();
  return ['COMPLETED', 'PARTIAL', 'MISSING', 'UNVERIFIED'].includes(normalized)
    ? normalized
    : 'UNVERIFIED';
}

function normalizeFinding(item, fallbackEvidence, defaults = {}) {
  const obj = typeof item === 'string' ? { description: item } : { ...item };
  const normalized = {
    ...defaults,
    ...obj,
    description: obj.description || obj.requirement || obj.claim || defaults.description || '',
    confidence: clampConfidence(obj.confidence, defaults.confidence || 0.75),
    evidence: obj.evidence || obj.source_checkpoint_evidence || fallbackEvidence,
    source_checkpoint_evidence: obj.source_checkpoint_evidence || obj.evidence || fallbackEvidence,
    verification_status: normalizeVerificationStatus(obj.verification_status || defaults.verification_status)
  };
  if (obj.status || defaults.status) {
    normalized.status = normalizeRequirementStatus(obj.status || defaults.status);
  }
  return normalized;
}

function normalizeAnalysisPayload(payload, metadata, context) {
  const evidence = checkpointEvidenceLabel(metadata);
  let requirementsSynthesized = false;
  let workListsSynthesized = false;
  const normalized = {
    original_intent: payload?.original_intent || payload?.intent || metadata?.message || 'Development intent reconstructed from checkpoint context',
    intent: payload?.intent || payload?.original_intent || metadata?.message || 'Development intent reconstructed from checkpoint context',
    requirements: asArray(payload?.requirements).map((item, index) => normalizeFinding(item, evidence, {
      id: `REQ-${index + 1}`,
      status: 'UNVERIFIED',
      confidence: 0.75
    })),
    completed_work: asArray(payload?.completed_work || payload?.completed).map(item => normalizeFinding(item, evidence)),
    partial_work: asArray(payload?.partial_work || payload?.partial).map(item => normalizeFinding(item, evidence)),
    unfinished_work: asArray(payload?.unfinished_work || payload?.unfinished).map(item => normalizeFinding(item, evidence, {
      priority: 'MEDIUM'
    })),
    important_decisions: asArray(payload?.important_decisions || payload?.decisions).map(item => normalizeFinding(item, evidence)),
    assumptions: asArray(payload?.assumptions).map(item => normalizeFinding(item, evidence, {
      risk_level: 'MEDIUM'
    })),
    risks: asArray(payload?.risks).map(item => normalizeFinding(item, evidence, {
      severity: 'MEDIUM'
    })),
    relevant_files: payload?.relevant_files?.length ? payload.relevant_files : normalizeFiles(metadata),
    recommended_next_steps: asArray(payload?.recommended_next_steps || payload?.next_steps).map(item => {
      const obj = typeof item === 'string' ? { description: item } : { ...item };
      return { priority: 'MEDIUM', ...obj, description: obj.description || obj.action || '' };
    }),
    provenance: {
      checkpoint_id: context.provenance.checkpoint_id,
      session_id: context.provenance.session_id,
      evidence_class: context.provenance.evidence_class,
      context_adapter_version: context.adapter_version,
      privacy_boundary: context.privacy_boundary,
      transcript_chunks: context.transcript.chunks.length,
      transcript_truncated: context.transcript.truncated
    }
  };

  if (normalized.requirements.length === 0) {
    const derived = [];
    const addDerivedRequirement = (item, status) => {
      derived.push({
        id: `REQ-${derived.length + 1}`,
        description: item.description,
        status,
        confidence: item.confidence,
        evidence: item.evidence,
        source_checkpoint_evidence: item.source_checkpoint_evidence,
        verification_status: item.verification_status
      });
    };

    normalized.completed_work.forEach(item => addDerivedRequirement(item, 'COMPLETED'));
    normalized.partial_work.forEach(item => addDerivedRequirement(item, 'PARTIAL'));
    normalized.unfinished_work.forEach(item => addDerivedRequirement(item, 'MISSING'));

    if (derived.length === 0) {
      const files = normalizeFiles(metadata);
      files.forEach(file => {
        derived.push({
          id: `REQ-${derived.length + 1}`,
          description: `Review and preserve checkpoint change in ${file}`,
          status: 'COMPLETED',
          confidence: 0.82,
          evidence: 'Derived from Entire checkpoint files_touched metadata because the model omitted a requirements array',
          source_checkpoint_evidence: `${evidence}; file=${file}`,
          verification_status: 'UNVERIFIED'
        });
      });

      if (files.length > 0 && !files.some(file => /(^|\/|\.)(test|spec)\./i.test(file) || /(^|\/)(tests?|__tests__)(\/|$)/i.test(file))) {
        derived.push({
          id: `REQ-${derived.length + 1}`,
          description: 'Add or confirm automated test coverage for checkpoint changes',
          status: 'MISSING',
          confidence: 0.78,
          evidence: 'No test or spec files were present in Entire checkpoint files_touched metadata',
          source_checkpoint_evidence: evidence,
          verification_status: 'UNVERIFIED'
        });
      }
    }

    normalized.requirements = derived;
    requirementsSynthesized = derived.length > 0;
  }

  if (normalized.requirements.length > 0) {
    const completedReqs = normalized.requirements.filter(item => item.status === 'COMPLETED');
    const partialReqs = normalized.requirements.filter(item => item.status === 'PARTIAL');
    const missingReqs = normalized.requirements.filter(item => item.status === 'MISSING');

    if (normalized.completed_work.length === 0 && completedReqs.length > 0) {
      normalized.completed_work = completedReqs.map(item => normalizeFinding(item, evidence));
      workListsSynthesized = true;
    }
    if (normalized.partial_work.length === 0 && partialReqs.length > 0) {
      normalized.partial_work = partialReqs.map(item => normalizeFinding(item, evidence));
      workListsSynthesized = true;
    }
    if (normalized.unfinished_work.length === 0 && missingReqs.length > 0) {
      normalized.unfinished_work = missingReqs.map(item => normalizeFinding(item, evidence, {
        priority: 'MEDIUM'
      }));
      workListsSynthesized = true;
    }
  }

  normalized.provenance.requirements_synthesized_from_entire_metadata = requirementsSynthesized;
  normalized.provenance.work_lists_synthesized_from_requirements = workListsSynthesized;

  return redactSensitiveValue(normalized);
}

function safeDatabricksModelName(value) {
  const model = String(value || '').trim();
  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(model)) {
    return null;
  }
  return model;
}

function requestGenerationOptions(options = {}) {
  const maxTokens = Number(options.maxTokens);
  const temperature = Number(options.temperature);
  return {
    maxTokens: Number.isFinite(maxTokens) ? Math.min(Math.max(Math.floor(maxTokens), 1), 8192) : 4096,
    temperature: Number.isFinite(temperature) ? Math.min(Math.max(temperature, 0), 2) : 0
  };
}

async function providerFailure(response, label) {
  await response.text().catch(() => '');
  return { success: false, error: `${label} request failed with status ${response.status}` };
}

// ── Call Databricks LLM (Dual-Mode: AI Gateway & Model Serving) ──
async function callDatabricksLLM(systemPrompt, userPrompt, options = {}) {
  const host = process.env.DATABRICKS_HOST || DATABRICKS_HOST;
  const token = await getAuthToken();
  const model = safeDatabricksModelName(process.env.DATABRICKS_MODEL_ENDPOINT || DATABRICKS_MODEL);
  const apiMode = process.env.DATABRICKS_API_MODE || DATABRICKS_API_MODE;

  if (!host || !token) {
    return { success: false, error: 'Databricks not configured. Set DATABRICKS_HOST and DATABRICKS_TOKEN (or DATABRICKS_CLIENT_ID & DATABRICKS_CLIENT_SECRET) in environment.' };
  }
  if (!model) {
    return { success: false, error: 'Databricks model endpoint name is invalid.' };
  }
  const hostInfo = normalizeDatabricksHost(host);
  if (!hostInfo.ok) {
    return { success: false, error: hostInfo.error };
  }
  const cleanHost = hostInfo.baseUrl;
  const generation = requestGenerationOptions(options);
  const safeSystemPrompt = redactSensitiveText(systemPrompt);
  const safeUserPrompt = redactSensitiveText(userPrompt);

  const useResponsesApi = apiMode === 'responses';

  // Mode 1: Databricks AI Gateway / MLflow Chat Completions for system.ai model services.
  if (model.startsWith('system.ai') && !useResponsesApi) {
    const chatUrl = `${cleanHost}/ai-gateway/mlflow/v1/chat/completions`;
    try {
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: safeSystemPrompt },
            { role: 'user', content: safeUserPrompt },
          ],
          max_tokens: generation.maxTokens,
          temperature: generation.temperature,
        })
      });

      if (!response.ok) {
        return providerFailure(response, 'Databricks AI Gateway');
      }

      const result = await response.json();
      const content = extractMessageText(result.choices?.[0]?.message?.content);
      return {
        success: true,
        data: content,
        model: result.model || model,
        usage: result.usage || null
      };
    } catch (err) {
      return { success: false, error: `AI Gateway error: ${sanitizeErrorMessage(err)}` };
    }
  }

  // Mode 2: Optional MLflow Responses API for compatible model services.
  if (useResponsesApi) {
    const gatewayUrl = `${cleanHost}/ai-gateway/mlflow/v1/responses`;
    try {
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          max_output_tokens: generation.maxTokens,
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: `${safeSystemPrompt}\n\nTask and Checkpoint Context:\n${safeUserPrompt}` }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        return providerFailure(response, 'Databricks AI Gateway');
      }

      const result = await response.json();
      const content = extractResponseText(result);
      return {
        success: true,
        data: content,
        model: result.model || model,
        usage: result.usage || null
      };
    } catch (err) {
      return { success: false, error: `AI Gateway error: ${sanitizeErrorMessage(err)}` };
    }
  }

  // Mode 3: Databricks Model Serving invocations (for custom endpoints / classic models)
  const servingUrl = `${cleanHost}/serving-endpoints/${encodeURIComponent(model)}/invocations`;
  try {
    const response = await fetch(servingUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: safeSystemPrompt },
          { role: 'user', content: safeUserPrompt },
        ],
        max_tokens: generation.maxTokens,
        temperature: generation.temperature,
      }),
    });

    if (!response.ok) {
      return providerFailure(response, 'Databricks Serving API');
    }

    const result = await response.json();
    const content = extractMessageText(result.choices?.[0]?.message?.content);
    return {
      success: true,
      data: content,
      model: result.model || model,
      usage: result.usage || null
    };
  } catch (err) {
    return { success: false, error: sanitizeErrorMessage(err) };
  }
}

const ANALYSIS_SYSTEM_PROMPT = `You are Code Archaeologist — an advanced developer intelligence engine powered by Databricks Foundation Models.
Your task is to analyze AI-assisted development checkpoints, agent transcripts, and file diffs to reconstruct:
1. ORIGINAL INTENT: What was the developer or AI agent trying to build?
2. REQUIREMENTS: Concrete requirements with status (COMPLETED, PARTIAL, MISSING, UNVERIFIED)
3. COMPLETED WORK: Work confirmed implemented with code evidence
4. PARTIAL WORK: Work initiated or partially implemented
5. UNFINISHED WORK: Requirements discussed or requested but left unfinished or postponed
6. IMPORTANT DECISIONS: Technical and architectural decisions with rationale and impact
7. ASSUMPTIONS: Assumptions made during development that need verification against the codebase
8. RISKS: Prioritized development and security risks (HIGH, MEDIUM, LOW)
9. RELEVANT FILES: Files modified or connected
10. RECOMMENDED NEXT STEPS: Actionable tasks for another developer or AI agent

RULES:
- Return ONLY valid JSON — no preamble, no markdown backticks outside JSON
- Every finding MUST have a confidence score (0.0 - 1.0)
- Every finding MUST include source_checkpoint_evidence from the structured Entire checkpoint packet
- Set verification_status to UNVERIFIED unless the checkpoint itself directly proves the status. Entire Graph verification happens after your response.
- Cite exact file names, functions, and evidence snippets when present in the checkpoint packet
- Distinguish REAL ENTIRE EVIDENCE from Databricks inference and assumptions
- Do not invent files, tests, Graph evidence, or completed work that is not supported by checkpoint context

OUTPUT JSON SCHEMA:
{
  "original_intent": "string",
  "intent": "string",
  "requirements": [
    { "id": "REQ-1", "description": "string", "status": "COMPLETED|PARTIAL|MISSING|UNVERIFIED", "confidence": 0.0-1.0, "evidence": "string", "source_checkpoint_evidence": "string", "verification_status": "VERIFIED|PARTIALLY_VERIFIED|UNVERIFIED|CONTRADICTED" }
  ],
  "completed_work": [
    { "description": "string", "evidence": "string", "source_checkpoint_evidence": "string", "confidence": 0.0-1.0, "verification_status": "VERIFIED|PARTIALLY_VERIFIED|UNVERIFIED|CONTRADICTED" }
  ],
  "partial_work": [
    { "description": "string", "missing_aspects": "string", "source_checkpoint_evidence": "string", "confidence": 0.0-1.0, "verification_status": "VERIFIED|PARTIALLY_VERIFIED|UNVERIFIED|CONTRADICTED" }
  ],
  "unfinished_work": [
    { "description": "string", "evidence": "string", "source_checkpoint_evidence": "string", "confidence": 0.0-1.0, "verification_status": "VERIFIED|PARTIALLY_VERIFIED|UNVERIFIED|CONTRADICTED", "priority": "HIGH|MEDIUM|LOW" }
  ],
  "important_decisions": [
    { "description": "string", "rationale": "string", "source_checkpoint_evidence": "string", "relevant_files": ["string"], "impact": "string", "confidence": 0.0-1.0, "verification_status": "VERIFIED|PARTIALLY_VERIFIED|UNVERIFIED|CONTRADICTED" }
  ],
  "assumptions": [
    { "description": "string", "source": "string", "source_checkpoint_evidence": "string", "risk_level": "HIGH|MEDIUM|LOW", "confidence": 0.0-1.0, "verification_status": "VERIFIED|PARTIALLY_VERIFIED|UNVERIFIED|CONTRADICTED" }
  ],
  "risks": [
    { "description": "string", "severity": "HIGH|MEDIUM|LOW", "evidence": "string", "source_checkpoint_evidence": "string", "confidence": 0.0-1.0, "verification_status": "VERIFIED|PARTIALLY_VERIFIED|UNVERIFIED|CONTRADICTED" }
  ],
  "relevant_files": ["string"],
  "recommended_next_steps": [
    { "description": "string", "priority": "HIGH|MEDIUM|LOW" }
  ]
}`;

export async function analyzeCheckpoint(checkpointMetadata, transcriptData) {
  const structuredContext = buildStructuredCheckpointContext(checkpointMetadata, transcriptData);
  const userPrompt = `Analyze this structured Entire developer checkpoint context. Extract full developer intelligence according to the specification schema.

Context adapter rules:
- Treat Entire checkpoint/session fields as source-of-truth evidence.
- Use transcript chunks and scoped evidence lines only when the privacy boundary includes them; do not assume omitted transcript content proves completion.
- Preserve source_checkpoint_evidence on every important finding.
- Privacy redaction markers mean sensitive source values were intentionally withheld.
- Raw prompt and transcript content may be withheld entirely before external model invocation.

STRUCTURED ENTIRE CHECKPOINT CONTEXT:
${JSON.stringify(structuredContext, null, 2)}

Return ONLY the JSON object matching the schema.`;

  const result = await callDatabricksLLM(ANALYSIS_SYSTEM_PROMPT, userPrompt);

  if (!result.success) {
    return {
      success: true,
      data: normalizeAnalysisPayload(buildFallbackAnalysis(checkpointMetadata, transcriptData), checkpointMetadata, structuredContext),
      source: 'local-fallback',
      reason: result.error,
      model: null,
      context: {
        adapter_version: structuredContext.adapter_version,
        privacy_boundary: structuredContext.privacy_boundary,
        transcript_chunks: structuredContext.transcript.chunks.length,
        transcript_truncated: structuredContext.transcript.truncated
      },
    };
  }

  try {
    const jsonMatch = result.data.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result.data);
    return {
      success: true,
      data: normalizeAnalysisPayload(parsed, checkpointMetadata, structuredContext),
      source: 'databricks',
      model: result.model,
      usage: result.usage,
      context: {
        adapter_version: structuredContext.adapter_version,
        privacy_boundary: structuredContext.privacy_boundary,
        transcript_chunks: structuredContext.transcript.chunks.length,
        transcript_truncated: structuredContext.transcript.truncated
      }
    };
  } catch (parseErr) {
    return {
      success: true,
      data: normalizeAnalysisPayload(buildFallbackAnalysis(checkpointMetadata, transcriptData), checkpointMetadata, structuredContext),
      source: 'local-fallback',
      reason: `LLM response parse error: ${parseErr.message}`,
      model: result.model,
      context: {
        adapter_version: structuredContext.adapter_version,
        privacy_boundary: structuredContext.privacy_boundary,
        transcript_chunks: structuredContext.transcript.chunks.length,
        transcript_truncated: structuredContext.transcript.truncated
      },
    };
  }
}

function buildFallbackAnalysis(metadata, transcript) {
  if (metadata?.curated_analysis) {
    return metadata.curated_analysis;
  }

  const files = metadata?.files_touched || metadata?.files || [];
  const message = metadata?.message || metadata?.summary || metadata?.last_prompt || '';
  const fileList = files.map(f => typeof f === 'string' ? f : (f.path || f.file || JSON.stringify(f)));

  const intent = message ? `Implement: ${message}` : 'Develop application features and infrastructure';

  const requirements = fileList.map((f, i) => ({
    id: `REQ-${i + 1}`,
    description: `Implement and update ${f}`,
    status: 'COMPLETED',
    confidence: 0.95,
    evidence: `Present in checkpoint files_touched list`
  }));

  if (fileList.length > 0 && !fileList.some(f => f.includes('test') || f.includes('spec'))) {
    requirements.push({
      id: `REQ-${fileList.length + 1}`,
      description: 'Automated test coverage for modified components',
      status: 'MISSING',
      confidence: 0.90,
      evidence: 'No test files modified in this checkpoint'
    });
  }

  const completed = fileList.map(f => ({
    description: f,
    evidence: 'Modified in checkpoint session',
    confidence: 0.98
  }));

  const unfinished = [
    {
      description: 'Comprehensive integration test suite covering edge cases',
      evidence: 'No test files detected in files_touched',
      confidence: 0.91,
      priority: 'HIGH'
    },
    {
      description: 'Review Entire Graph callers and verify downstream impact',
      evidence: 'Graph impact verification recommended',
      confidence: 0.95,
      priority: 'MEDIUM'
    }
  ];

  const decisions = [
    {
      description: `Targeted modifications across ${fileList.length} component(s)`,
      rationale: 'Modular component development workflow observed in session',
      relevant_files: fileList.slice(0, 3),
      impact: 'Codebase modularity',
      confidence: 0.92
    }
  ];

  const assumptions = [
    {
      description: 'Assumed modified files satisfy runtime dependencies without additional packages',
      source: 'Checkpoint metadata files_touched',
      risk_level: 'MEDIUM',
      confidence: 0.85,
      verification_status: 'PARTIALLY_VERIFIED'
    }
  ];

  const risks = [
    {
      description: 'Absence of dedicated unit/e2e test files leaves regressions unverified',
      severity: 'HIGH',
      evidence: 'Zero test files committed in checkpoint scope',
      confidence: 0.89
    }
  ];

  return {
    original_intent: intent,
    intent,
    requirements,
    completed_work: completed,
    partial_work: [],
    unfinished_work: unfinished,
    important_decisions: decisions,
    assumptions,
    risks,
    relevant_files: fileList,
    recommended_next_steps: [
      { description: 'Write unit tests for recently modified files', priority: 'HIGH' },
      { description: 'Verify call graph relationships using Entire Graph impact analysis', priority: 'HIGH' }
    ]
  };
}

// ── Machine-Readable Handoff Formatter (Product Specification Section 6) ──
export function generateHandoff(analysis, graphVerification, checkpointId, repoPath) {
  const requirements = analysis?.requirements || [];
  const completedWork = (analysis?.completed_work || analysis?.completed || []).map(c => typeof c === 'string' ? c : c.description);
  const unfinishedWork = (analysis?.unfinished_work || analysis?.unfinished || []).map(u => typeof u === 'string' ? u : u.description);
  const completedFromRequirements = requirements
    .filter(req => req.status === 'COMPLETED')
    .map(req => req.description)
    .filter(Boolean);
  const unfinishedFromRequirements = requirements
    .filter(req => req.status === 'PARTIAL' || req.status === 'MISSING')
    .map(req => req.description)
    .filter(Boolean);
  const decisions = (analysis?.important_decisions || analysis?.decisions || []).map(d => typeof d === 'string' ? d : d.description);
  const assumptions = (analysis?.assumptions || []).map(a => typeof a === 'string' ? a : a.description);
  const risks = (analysis?.risks || []).map(r => typeof r === 'string' ? r : `${r.description} [Severity: ${r.severity || 'MEDIUM'}]`);
  const nextSteps = (analysis?.recommended_next_steps || analysis?.next_steps || []).map(n => typeof n === 'string' ? n : n.description);

  const verifiedEvidence = (graphVerification || []).map(v => ({
    claim: v.claim,
    status: v.status,
    source: v.source || 'entire-graph',
    query: v.query,
    matches: v.evidence?.top_matches || [],
    impact: v.impact || null
  }));

  // Exact Section 6 Schema
  return {
    project: "Code Archaeologist",
    checkpoint_id: checkpointId,
    original_intent: analysis?.original_intent || analysis?.intent || "",
    requirements,
    partial_work: analysis?.partial_work || [],
    completed_work: completedWork.length > 0 ? completedWork : completedFromRequirements,
    unfinished_work: unfinishedWork.length > 0 ? unfinishedWork : unfinishedFromRequirements,
    important_decisions: decisions,
    assumptions: assumptions,
    risks: risks,
    relevant_files: analysis?.relevant_files || [],
    verified_evidence: verifiedEvidence,
    recommended_next_steps: nextSteps,
    verification_summary: {
      graph_verified: verifiedEvidence.filter(item => item.status === 'VERIFIED').length,
      graph_total: verifiedEvidence.length,
      graph_unverified: verifiedEvidence.filter(item => item.status === 'UNVERIFIED').length,
      graph_contradicted: verifiedEvidence.filter(item => item.status === 'CONTRADICTED').length
    },
    provenance: {
      entire: analysis?.provenance || null,
      ai: {
        provider: "Databricks",
        model: DATABRICKS_MODEL,
        generated_findings_require_graph_review: true
      },
      graph: {
        provider: "Entire Graph",
        evidence_items: verifiedEvidence.length
      }
    },
    metadata: {
      generator: "Code Archaeologist v2.0",
      generated_at: new Date().toISOString(),
      repository: repoPath,
      model: DATABRICKS_MODEL,
      confidence: {
        overall: calculateOverallConfidence(analysis),
        completeness: calculateCompleteness(analysis)
      }
    }
  };
}

function statusCount(items, status) {
  return items.filter(item => item.status === status).length;
}

function confidencePercent(item) {
  return `${Math.round(clampConfidence(item?.confidence, 0) * 100)}%`;
}

function formatFinding(item, fallbackStatus = '') {
  const status = item.status || item.verification_status || fallbackStatus;
  const source = item.source_checkpoint_evidence || item.evidence || 'checkpoint evidence unavailable';
  const confidence = confidencePercent(item);
  return `- ${status ? `[${status}] ` : ''}${item.description} (confidence ${confidence}; source: ${source})`;
}

export function generateIntelligenceReport(analysis, graphVerification, checkpointId, repoPath, options = {}) {
  const requirements = analysis?.requirements || [];
  const completed = analysis?.completed_work || [];
  const partial = analysis?.partial_work || [];
  const unfinished = analysis?.unfinished_work || [];
  const decisions = analysis?.important_decisions || [];
  const assumptions = analysis?.assumptions || [];
  const risks = analysis?.risks || [];
  const nextSteps = analysis?.recommended_next_steps || [];
  const graphItems = graphVerification || [];
  const graphVerified = graphItems.filter(item => item.status === 'VERIFIED').length;
  const generatedAt = new Date().toISOString();
  const evidenceClass = analysis?.provenance?.evidence_class || 'REAL ENTIRE EVIDENCE';
  const aiLabel = options.analysisSource === 'databricks'
    ? `AI GENERATED BY DATABRICKS (${options.model || DATABRICKS_MODEL})`
    : `LOCAL FALLBACK ANALYSIS (${options.fallbackReason || 'Databricks unavailable or response could not be parsed'})`;

  const lines = [
    '# Code Archaeologist Intelligence Report',
    '',
    `Checkpoint: ${checkpointId}`,
    `Repository: ${repoPath}`,
    `Generated: ${generatedAt}`,
    '',
    '## Provenance',
    `- ${evidenceClass}: Entire checkpoint/session context`,
    `- ${aiLabel}`,
    `- GRAPH VERIFIED: ${graphVerified}/${graphItems.length} findings have Entire Graph VERIFIED status`,
    '',
    '## Reconstructed Intent',
    analysis?.original_intent || analysis?.intent || 'Intent unavailable',
    '',
    '## Requirements Summary',
    `- Completed: ${statusCount(requirements, 'COMPLETED')}`,
    `- Partial: ${statusCount(requirements, 'PARTIAL')}`,
    `- Missing: ${statusCount(requirements, 'MISSING')}`,
    `- Unverified: ${statusCount(requirements, 'UNVERIFIED')}`,
    '',
    ...requirements.map(item => formatFinding(item, 'UNVERIFIED')),
    '',
    '## Completed Work',
    ...(completed.length ? completed.map(item => formatFinding(item)) : ['- None identified']),
    '',
    '## Partially Completed Or Missing Work',
    ...(partial.length ? partial.map(item => formatFinding(item, 'PARTIAL')) : []),
    ...(unfinished.length ? unfinished.map(item => formatFinding(item, 'MISSING')) : ['- None identified']),
    '',
    '## Decisions And Assumptions',
    ...(decisions.length ? decisions.map(item => formatFinding(item)) : ['- No decisions identified']),
    ...(assumptions.length ? assumptions.map(item => `- [${item.verification_status || 'UNVERIFIED'}] ${item.description} (risk ${item.risk_level || 'MEDIUM'}; confidence ${confidencePercent(item)}; source: ${item.source_checkpoint_evidence || item.source || item.evidence || 'checkpoint evidence unavailable'})`) : ['- No assumptions identified']),
    '',
    '## Risks',
    ...(risks.length ? risks.map(item => `- [${item.severity || 'MEDIUM'}] ${item.description} (confidence ${confidencePercent(item)}; source: ${item.source_checkpoint_evidence || item.evidence || 'checkpoint evidence unavailable'})`) : ['- No risks identified']),
    '',
    '## Entire Graph Evidence',
    ...(graphItems.length ? graphItems.map(item => {
      const matches = item.evidence?.top_matches?.length
        ? item.evidence.top_matches.map(match => `${match.file}:${match.line || '?'}`).join(', ')
        : 'no matches';
      return `- [${item.status}] ${item.claim} | query: ${item.query} | ${matches}`;
    }) : ['- Graph verification was not run or produced no evidence']),
    '',
    '## Recommended Next Actions',
    ...(nextSteps.length ? nextSteps.map(item => `- [${item.priority || 'MEDIUM'}] ${item.description}`) : ['- Review graph-unverified findings before release'])
  ];

  return lines.join('\n');
}

// ── Lakehouse-ready Audit Storage ──
export function saveToLakehouse(analysis, handoff, checkpointId, repoPath, report = '') {
  try {
    if (!fs.existsSync(LAKEHOUSE_DIR)) {
      fs.mkdirSync(LAKEHOUSE_DIR, { recursive: true });
    }
    const safeAnalysis = stripRawCheckpointFields(redactSensitiveValue(analysis || {}));
    const safeHandoff = stripRawCheckpointFields(redactSensitiveValue(handoff || {}));
    const safeReport = redactSensitiveText(report || '');

    const record = {
      table: "dev_intelligence.checkpoints_delta",
      checkpoint_id: checkpointId,
      repository: repoPath,
      timestamp: new Date().toISOString(),
      model: DATABRICKS_MODEL,
      intent: safeHandoff?.original_intent || safeAnalysis?.intent || "",
      completed_count: (safeHandoff?.completed_work || []).length,
      unfinished_count: (safeHandoff?.unfinished_work || []).length,
      risks_count: (safeHandoff?.risks || []).length,
      verified_evidence_count: (safeHandoff?.verified_evidence || []).filter(e => e.status === "VERIFIED").length,
      handoff: safeHandoff,
      analysis: safeAnalysis,
      report: safeReport,
      storage_mode: "local-lakehouse-ready-jsonl"
    };

    fs.appendFileSync(LAKEHOUSE_FILE, JSON.stringify(record) + '\n', 'utf-8');

    return {
      success: true,
      message: "Stored to local Lakehouse-ready audit log",
      table: "dev_intelligence.checkpoints_delta",
      storage_mode: record.storage_mode,
      record_id: checkpointId,
      timestamp: record.timestamp
    };
  } catch (err) {
    return { success: false, error: sanitizeErrorMessage(err) };
  }
}

function lakehouseSummary(record) {
  return {
    table: record.table,
    checkpoint_id: record.checkpoint_id,
    repository: record.repository,
    timestamp: record.timestamp,
    model: record.model,
    intent: record.intent,
    completed_count: record.completed_count || 0,
    unfinished_count: record.unfinished_count || 0,
    risks_count: record.risks_count || 0,
    verified_evidence_count: record.verified_evidence_count || 0,
    storage_mode: record.storage_mode
  };
}

export function getLakehouseHistory(options = {}) {
  try {
    if (!fs.existsSync(LAKEHOUSE_FILE)) {
      return { success: true, count: 0, records: [] };
    }
    const lines = fs.readFileSync(LAKEHOUSE_FILE, 'utf-8').trim().split('\n').filter(Boolean);
    const records = lines.map(l => stripRawCheckpointFields(redactSensitiveValue(JSON.parse(l))));
    const responseRecords = options.includeRecords ? records : records.map(lakehouseSummary);
    return {
      success: true,
      table: "dev_intelligence.checkpoints_delta",
      storage_mode: "local-lakehouse-ready-jsonl",
      count: records.length,
      records: responseRecords.reverse() // latest first
    };
  } catch (err) {
    return { success: false, error: sanitizeErrorMessage(err), records: [] };
  }
}

// ── Databricks AI Resume Advisor ──
export async function getAgentResumePrompt(analysis, graphVerification, checkpointId) {
  if (!envFlag('CODE_ARCHAEOLOGIST_ALLOW_EXTERNAL_PROMPT_CONTEXT')) {
    const fallback = buildLocalAdvisorPrompt(analysis, checkpointId);
    return {
      success: true,
      advisor_prompt: fallback,
      model: 'deterministic-advisor',
      source: 'local-fallback',
      reason: 'External prompt context disabled by privacy boundary'
    };
  }

  const safeAnalysis = stripRawCheckpointFields(redactSensitiveValue(analysis || {}));
  const safeGraphVerification = stripRawCheckpointFields(redactSensitiveValue(graphVerification || []));
  const prompt = `Based on this development analysis, write an actionable prompt for the next autonomous coding agent (Claude Code, Gemini CLI, or Codex) to continue this work immediately.
Checkpoint ID: ${checkpointId}
Original Intent: ${safeAnalysis?.original_intent || safeAnalysis?.intent}
Completed Work: ${JSON.stringify(safeAnalysis?.completed_work || []).slice(0, 8000)}
Unfinished Work: ${JSON.stringify(safeAnalysis?.unfinished_work || []).slice(0, 8000)}
Risks: ${JSON.stringify(safeAnalysis?.risks || []).slice(0, 5000)}
Verified Evidence: ${JSON.stringify(safeGraphVerification || []).slice(0, 8000)}

Provide:
1. A concise task summary
2. The specific files and line numbers to edit, but only cite line numbers present in Graph evidence
3. The exact missing requirements to implement
4. The verification command to run

Do not invent code locations, completed work, or Graph verification.`;

  const sysPrompt = "You are a Senior Principal Staff Engineer producing an executive agent handoff prompt. Be ultra-concise, technical, and concrete.";
  const res = await callDatabricksLLM(sysPrompt, prompt, { maxTokens: 1024 });

  if (res.success) {
    return { success: true, advisor_prompt: res.data, model: res.model, source: 'databricks' };
  }

  // Deterministic fallback advice
  return {
    success: true,
    advisor_prompt: buildLocalAdvisorPrompt(analysis, checkpointId),
    model: 'deterministic-advisor',
    source: 'local-fallback'
  };
}

function buildLocalAdvisorPrompt(analysis, checkpointId) {
  const unfin = (analysis?.unfinished_work || []).map(u => `- ${u.description || u}`).join('\n');
  const files = (analysis?.relevant_files || []).join(', ');
  return `## Agent Resume Directive\n\n**Goal**: Continue development from checkpoint ${checkpointId}.\n**Relevant Files**: ${files}\n\n**Unfinished Requirements to Implement**:\n${unfin || '- Add comprehensive automated test coverage'}\n\n**Next Steps**:\n1. Open ${files.split(',')[0] || 'codebase'} and address pending requirements.\n2. Run \`entire graph impact\` to confirm caller/callee integrity.\n3. Commit with Entire Checkpoint enabled.`;
}

function calculateOverallConfidence(analysis) {
  const allConf = [
    ...(analysis?.completed_work || analysis?.completed || []).map(c => c.confidence || 0.9),
    ...(analysis?.unfinished_work || analysis?.unfinished || []).map(u => u.confidence || 0.9),
    ...(analysis?.requirements || []).map(r => r.confidence || 0.9)
  ];
  if (allConf.length === 0) return 0.9;
  return Math.round((allConf.reduce((a, b) => a + b, 0) / allConf.length) * 100) / 100;
}

function calculateCompleteness(analysis) {
  const reqs = analysis?.requirements || [];
  if (reqs.length === 0) return 0.5;
  const completed = reqs.filter(r => r.status === 'COMPLETED').length;
  return Math.round((completed / reqs.length) * 100) / 100;
}
