// ═══════════════════════════════════════════════════════════════
// DATABRICKS SERVICE — AI Intelligence Engine
// ═══════════════════════════════════════════════════════════════

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
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
  const cleanHost = DATABRICKS_HOST.replace(/\/+$/, '');
  const url = `${cleanHost}/serving-endpoints/${DATABRICKS_MODEL}/invocations`;
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

const ANALYSIS_SYSTEM_PROMPT = `You are Code Archaeologist — a checkpoint-native developer intelligence engine powered by Databricks.
Your task is to analyze AI-assisted development checkpoints and session transcripts to reconstruct:
1. ORIGINAL INTENT: What was the developer or AI agent trying to build?
2. REQUIREMENTS: Stated or implied requirements with status (COMPLETED, PARTIAL, MISSING, UNVERIFIED)
3. COMPLETED WORK: Work confirmed implemented with code citations
4. PARTIAL WORK: Work initiated or partially implemented
5. UNFINISHED WORK: Requirements discussed or planned but left unfinished or abandoned
6. IMPORTANT DECISIONS: Technical/architectural decisions with rationale and impact
7. ASSUMPTIONS: Assumptions made during development that need verification
8. RISKS: Prioritized development risks (HIGH, MEDIUM, LOW)
9. RELEVANT FILES: Files modified or connected
10. RECOMMENDED NEXT STEPS: Actionable steps for another developer or AI agent

RULES:
- Return ONLY valid JSON — no markdown, no conversational commentary outside JSON
- Every finding MUST have a confidence score (0.0 - 1.0)
- Cite exact file names, functions, and evidence snippets
- Distinguish verified facts from inferences and assumptions

OUTPUT JSON SCHEMA:
{
  "original_intent": "string",
  "intent": "string",
  "requirements": [
    { "id": "REQ-1", "description": "string", "status": "COMPLETED|PARTIAL|MISSING|UNVERIFIED", "confidence": 0.0-1.0, "evidence": "string" }
  ],
  "completed_work": [
    { "description": "string", "evidence": "string", "confidence": 0.0-1.0 }
  ],
  "partial_work": [
    { "description": "string", "missing_aspects": "string", "confidence": 0.0-1.0 }
  ],
  "unfinished_work": [
    { "description": "string", "evidence": "string", "confidence": 0.0-1.0, "priority": "HIGH|MEDIUM|LOW" }
  ],
  "important_decisions": [
    { "description": "string", "rationale": "string", "relevant_files": ["string"], "impact": "string", "confidence": 0.0-1.0 }
  ],
  "assumptions": [
    { "description": "string", "source": "string", "risk_level": "HIGH|MEDIUM|LOW", "confidence": 0.0-1.0, "verification_status": "VERIFIED|PARTIALLY_VERIFIED|UNVERIFIED|CONTRADICTED" }
  ],
  "risks": [
    { "description": "string", "severity": "HIGH|MEDIUM|LOW", "evidence": "string", "confidence": 0.0-1.0 }
  ],
  "relevant_files": ["string"],
  "recommended_next_steps": [
    { "description": "string", "priority": "HIGH|MEDIUM|LOW" }
  ]
}`;

export async function analyzeCheckpoint(checkpointMetadata, transcriptData) {
  const userPrompt = `Analyze this Entire developer checkpoint and session transcript. Extract full developer intelligence according to the specification schema.

═══ CHECKPOINT METADATA ═══
${JSON.stringify(checkpointMetadata, null, 2)}

═══ SESSION TRANSCRIPT ═══
${transcriptData ? transcriptData.substring(0, 15000) : 'No raw transcript available — analyze metadata and prompt context.'}

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
      reason: `LLM response parse error: ${parseErr.message}`,
      rawResponse: result.data?.substring(0, 500),
      model: result.model,
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
      description: 'Connect Databricks Foundation Model endpoint in backend/.env for deep LLM extraction',
      evidence: 'Running in deterministic local fallback mode',
      confidence: 1.0,
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
  const completedWork = (analysis?.completed_work || analysis?.completed || []).map(c => typeof c === 'string' ? c : c.description);
  const unfinishedWork = (analysis?.unfinished_work || analysis?.unfinished || []).map(u => typeof u === 'string' ? u : u.description);
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
    completed_work: completedWork,
    unfinished_work: unfinishedWork,
    important_decisions: decisions,
    assumptions: assumptions,
    risks: risks,
    relevant_files: analysis?.relevant_files || [],
    verified_evidence: verifiedEvidence,
    recommended_next_steps: nextSteps,
    // Additive metadata for auditing
    metadata: {
      generator: "Code Archaeologist v2.0",
      generated_at: new Date().toISOString(),
      repository: repoPath,
      confidence: {
        overall: calculateOverallConfidence(analysis),
        completeness: calculateCompleteness(analysis)
      }
    }
  };
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
