// ═══════════════════════════════════════════════════════════════
// DATABRICKS SERVICE — AI Intelligence Engine
// ═══════════════════════════════════════════════════════════════

import dotenv from 'dotenv';
dotenv.config();

const DATABRICKS_HOST = process.env.DATABRICKS_HOST || '';
const DATABRICKS_TOKEN = process.env.DATABRICKS_TOKEN || '';
const DATABRICKS_MODEL = process.env.DATABRICKS_MODEL_ENDPOINT || 'databricks-meta-llama-3-3-70b-instruct';

export function isDatabricksConfigured() {
  return {
    configured: !!(DATABRICKS_HOST && DATABRICKS_TOKEN),
    host: DATABRICKS_HOST ? DATABRICKS_HOST.replace(/https?:\/\//, '').split('.')[0] + '...' : null,
    model: DATABRICKS_MODEL,
  };
}

async function callDatabricksLLM(systemPrompt, userPrompt, options = {}) {
  if (!DATABRICKS_HOST || !DATABRICKS_TOKEN) {
    return { success: false, error: 'Databricks not configured. Set DATABRICKS_HOST and DATABRICKS_TOKEN in backend/.env' };
  }
  const url = `${DATABRICKS_HOST}/serving-endpoints/${DATABRICKS_MODEL}/invocations`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DATABRICKS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Databricks API ${response.status}: ${errText}` };
    }
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    return { success: true, data: content, model: result.model || DATABRICKS_MODEL, usage: result.usage || null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

const ANALYSIS_SYSTEM_PROMPT = `You are Code Archaeologist — an AI analysis engine that examines developer checkpoint data from AI-assisted coding sessions.

You analyze checkpoint metadata and transcripts to reconstruct:
1. The original developer/agent INTENT
2. REQUIREMENTS that were stated or implied
3. COMPLETED work with evidence
4. UNFINISHED or abandoned work
5. KEY DECISIONS made during the session
6. RISKS and potential issues

RULES:
- Return ONLY valid JSON — no markdown, no explanation outside JSON
- Every finding MUST have a confidence score (0.0-1.0)
- 0.9-1.0 = directly stated in transcript/metadata
- 0.7-0.89 = strongly implied by context
- 0.5-0.69 = inferred from patterns
- Below 0.5 = speculative (MUST be labeled as such)
- Cite specific evidence: file names, function names, transcript snippets
- NEVER present speculation as fact
- Separate what IS completed from what is NOT

OUTPUT JSON SCHEMA:
{
  "intent": "string — the original goal of this development session",
  "requirements": [
    { "id": "R1", "description": "string", "status": "COMPLETED|PARTIAL|MISSING|UNKNOWN", "confidence": 0.0-1.0, "evidence": "string" }
  ],
  "completed": [
    { "description": "string", "evidence": "string", "confidence": 0.0-1.0 }
  ],
  "unfinished": [
    { "description": "string", "evidence": "string", "confidence": 0.0-1.0, "priority": "HIGH|MEDIUM|LOW" }
  ],
  "decisions": [
    { "description": "string", "rationale": "string", "confidence": 0.0-1.0 }
  ],
  "risks": [
    { "description": "string", "severity": "HIGH|MEDIUM|LOW", "evidence": "string", "confidence": 0.0-1.0 }
  ],
  "relevant_files": ["string"],
  "next_steps": [
    { "description": "string", "priority": "HIGH|MEDIUM|LOW" }
  ]
}`;

export async function analyzeCheckpoint(checkpointMetadata, transcriptData) {
  const userPrompt = `Analyze this AI-assisted development checkpoint. Extract all intent, requirements, completed work, unfinished work, decisions, and risks.

═══ CHECKPOINT METADATA ═══
${JSON.stringify(checkpointMetadata, null, 2)}

═══ SESSION TRANSCRIPT ═══
${transcriptData ? transcriptData.substring(0, 15000) : 'No transcript available — analyze metadata only.'}

Return ONLY the JSON object matching the schema.`;

  const result = await callDatabricksLLM(ANALYSIS_SYSTEM_PROMPT, userPrompt);

  if (!result.success) {
    return {
      success: true,
      data: buildFallbackAnalysis(checkpointMetadata, transcriptData),
      source: 'local-fallback',
      reason: result.error,
      model: null,
    };
  }

  try {
    const jsonMatch = result.data.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result.data);
    return { success: true, data: parsed, source: 'databricks', model: result.model, usage: result.usage };
  } catch (parseErr) {
    return {
      success: true,
      data: buildFallbackAnalysis(checkpointMetadata, transcriptData),
      source: 'local-fallback',
      reason: `LLM response was not valid JSON: ${parseErr.message}`,
      rawResponse: result.data?.substring(0, 500),
      model: result.model,
    };
  }
}

function buildFallbackAnalysis(metadata, transcript) {
  const files = metadata?.files_touched || metadata?.files || [];
  const message = metadata?.message || metadata?.summary || '';
  const sessions = metadata?.sessions || [];
  const prompts = sessions.map(s => s.prompt || s.scoped_prompt || s.description || '').filter(Boolean);
  const intent = prompts.length > 0 ? prompts.join(' | ') : message || 'Intent could not be extracted — Databricks LLM required for deep analysis';
  const fileList = files.map(f => typeof f === 'string' ? f : (f.path || f.file || JSON.stringify(f)));

  return {
    intent,
    requirements: fileList.map((f, i) => ({
      id: `R${i + 1}`, description: `File modification: ${f}`, status: 'COMPLETED', confidence: 1.0, evidence: 'Present in checkpoint metadata files_touched',
    })),
    completed: fileList.map(f => ({ description: `Modified: ${f}`, evidence: 'checkpoint metadata', confidence: 1.0 })),
    unfinished: [{
      description: 'Full deep analysis requires Databricks LLM — configure DATABRICKS_HOST and DATABRICKS_TOKEN',
      evidence: 'Databricks not configured', confidence: 1.0, priority: 'HIGH',
    }],
    decisions: [{ description: `Session involved ${sessions.length} session(s) modifying ${files.length} file(s)`, rationale: 'Extracted from checkpoint metadata', confidence: 1.0 }],
    risks: files.length === 0 ? [{ description: 'No files were touched — session may have been exploratory only', severity: 'MEDIUM', evidence: 'Empty files_touched in metadata', confidence: 0.9 }] : [],
    relevant_files: fileList,
    next_steps: [
      { description: 'Configure Databricks for full AI-powered analysis', priority: 'HIGH' },
      { description: 'Run Entire Graph verification on identified claims', priority: 'HIGH' },
    ],
  };
}

export function generateHandoff(analysis, graphVerification, checkpointId, repoPath) {
  return {
    version: '1.0',
    generator: 'Code Archaeologist v1.0',
    generated_at: new Date().toISOString(),
    source: { checkpoint_id: checkpointId, repository: repoPath },
    intent: analysis?.intent || '',
    completed: (analysis?.completed || []).map(c => c.description || c),
    unfinished: (analysis?.unfinished || []).map(u => u.description || u),
    decisions: (analysis?.decisions || []).map(d => d.description || d),
    risks: (analysis?.risks || []).map(r => ({ description: r.description || r, severity: r.severity || 'MEDIUM' })),
    evidence: (graphVerification || []).map(v => ({ claim: v.claim, status: v.status, source: v.source, query: v.query })),
    confidence: {
      overall: calculateOverallConfidence(analysis),
      intent: analysis?.requirements?.[0]?.confidence || 0.5,
      completeness: calculateCompleteness(analysis),
    },
    relevant_files: analysis?.relevant_files || [],
    next_steps: (analysis?.next_steps || []).map(n => n.description || n),
  };
}

function calculateOverallConfidence(analysis) {
  const c = [...(analysis?.completed || []).map(c => c.confidence || 0), ...(analysis?.unfinished || []).map(u => u.confidence || 0), ...(analysis?.requirements || []).map(r => r.confidence || 0)];
  return c.length === 0 ? 0 : Math.round((c.reduce((a, b) => a + b, 0) / c.length) * 100) / 100;
}

function calculateCompleteness(analysis) {
  const reqs = analysis?.requirements || [];
  if (reqs.length === 0) return 0;
  return Math.round((reqs.filter(r => r.status === 'COMPLETED').length / reqs.length) * 100) / 100;
}
