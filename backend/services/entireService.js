// ═══════════════════════════════════════════════════════════════
// ENTIRE SERVICE — Checkpoint & Graph Integration
// ═══════════════════════════════════════════════════════════════

import { execSync } from 'child_process';

function runEntireCommand(args, repoPath) {
  const cwd = repoPath || process.cwd();
  try {
    const result = execSync(`entire ${args}`, {
      cwd,
      timeout: 30000,
      encoding: 'utf-8',
      env: { ...process.env, PAGER: 'cat' },
      maxBuffer: 10 * 1024 * 1024,
    });
    return { success: true, data: result.trim() };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stderr: err.stderr?.trim() || '',
      stdout: err.stdout?.trim() || '',
    };
  }
}

function parseJsonSafe(str) {
  try { return JSON.parse(str); } catch { return null; }
}

// ── Status ──
export function getEntireStatus(repoPath) {
  const result = runEntireCommand('status', repoPath);
  const version = runEntireCommand('--version', repoPath);
  return {
    enabled: result.success,
    output: result.data || result.error,
    version: version.success ? version.data : null,
  };
}

// ── List Checkpoints ──
export function listCheckpoints(repoPath) {
  const result = runEntireCommand('checkpoint list --json', repoPath);
  if (!result.success) return { success: false, checkpoints: [], error: result.error };
  const parsed = parseJsonSafe(result.data);
  if (!parsed) return { success: true, checkpoints: [], raw: result.data };
  const checkpoints = Array.isArray(parsed) ? parsed : (parsed.checkpoints || []);
  return { success: true, checkpoints };
}

// ── Checkpoint Metadata ──
export function getCheckpointMetadata(checkpointId, repoPath) {
  const result = runEntireCommand(`checkpoint explain ${checkpointId} --json`, repoPath);
  if (!result.success) return { success: false, error: result.error };
  const parsed = parseJsonSafe(result.data);
  return { success: true, metadata: parsed || { raw: result.data } };
}

// ── Checkpoint Explanation (human-readable) ──
export function getCheckpointExplanation(checkpointId, repoPath) {
  const result = runEntireCommand(`checkpoint explain ${checkpointId} --full`, repoPath);
  return { success: result.success, explanation: result.data || result.error };
}

// ── Checkpoint Transcript (JSONL) ──
export function getCheckpointTranscript(checkpointId, repoPath, sessionIndex) {
  const sessionFlag = sessionIndex !== undefined ? ` --session-index ${sessionIndex}` : '';
  const result = runEntireCommand(`checkpoint explain ${checkpointId} --transcript${sessionFlag}`, repoPath);
  return { success: result.success, transcript: result.data || null, error: result.error || null };
}

// ── Search Checkpoints ──
export function searchCheckpoints(query, repoPath) {
  const result = runEntireCommand(`checkpoint search "${query.replace(/"/g, '\\"')}"`, repoPath);
  return { success: result.success, results: result.data || result.error };
}

// ── Graph Search ──
export function graphSearch(query, repoPath, topK = 5) {
  const result = runEntireCommand(
    `graph search --query "${query.replace(/"/g, '\\"')}" --format json --top-k ${topK} --repo ${repoPath || '.'}`,
    repoPath
  );
  if (!result.success) return { success: false, error: result.error, stderr: result.stderr };
  const parsed = parseJsonSafe(result.data);
  return { success: true, results: parsed || result.data };
}

// ── Graph Impact ──
export function graphImpact(symbol, repoPath) {
  const result = runEntireCommand(
    `graph impact --symbol "${symbol.replace(/"/g, '\\"')}" --format json --repo ${repoPath || '.'}`,
    repoPath
  );
  if (!result.success) return { success: false, error: result.error };
  const parsed = parseJsonSafe(result.data);
  return { success: true, results: parsed || result.data };
}

// ── Graph Def ──
export function graphDef(symbol, repoPath) {
  const result = runEntireCommand(
    `graph def --symbol "${symbol.replace(/"/g, '\\"')}" --format json --repo ${repoPath || '.'}`,
    repoPath
  );
  if (!result.success) return { success: false, error: result.error };
  const parsed = parseJsonSafe(result.data);
  return { success: true, results: parsed || result.data };
}

// ── Graph Checkpoint ──
export function graphCheckpoint(checkpointId, repoPath) {
  const result = runEntireCommand(`graph checkpoint ${checkpointId} --json --repo ${repoPath || '.'}`, repoPath);
  if (!result.success) return { success: false, error: result.error };
  const parsed = parseJsonSafe(result.data);
  return { success: true, results: parsed || result.data };
}

// ── Graph Diff ──
export function graphDiff(fromRef, toRef, repoPath) {
  const result = runEntireCommand(`graph diff ${fromRef} ${toRef} --format json --repo ${repoPath || '.'}`, repoPath);
  if (!result.success) return { success: false, error: result.error };
  const parsed = parseJsonSafe(result.data);
  return { success: true, results: parsed || result.data };
}

// ── Batch Verify Claims Against Graph ──
export function verifyClaimsWithGraph(claims, repoPath) {
  const results = [];
  for (const claim of claims.slice(0, 8)) {
    const searchTerm = claim
      .replace(/^(Modified|Completed|Missing|Added|Removed|Implemented|Created):\s*/i, '')
      .substring(0, 120);
    if (searchTerm.length < 3) continue;

    const graphResult = graphSearch(searchTerm, repoPath, 3);
    let status = 'UNVERIFIED';
    let evidence = null;

    if (graphResult.success && graphResult.results) {
      const resultData = typeof graphResult.results === 'string'
        ? graphResult.results : JSON.stringify(graphResult.results);
      if (resultData.length > 20 && !resultData.includes('"results":[]') && !resultData.includes('"hits":[]')) {
        status = 'VERIFIED';
        evidence = graphResult.results;
      } else {
        status = 'NOT_FOUND';
      }
    }

    results.push({ claim, query: searchTerm, status, evidence, source: 'entire-graph' });
  }
  return results;
}

// ── Check Graph Plugin ──
export function isGraphAvailable(repoPath) {
  const result = runEntireCommand('graph version', repoPath);
  return { available: result.success, version: result.success ? result.data : null, error: result.success ? null : result.error };
}
