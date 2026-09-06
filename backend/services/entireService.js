// ═══════════════════════════════════════════════════════════════
// ENTIRE SERVICE — Checkpoint, Session & Graph Integration
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

// ── Curated Demo Checkpoints (For demonstrations and benchmark testing) ──
export const DEMO_CHECKPOINTS = [
  {
    id: "cp-7f8a92-auth",
    checkpoint_id: "cp-7f8a92-auth",
    session_id: "ses-9921-auth-impl",
    message: "feat(auth): implement JWT validation, session manager & rate limiter",
    summary: "JWT validation, session manager & rate limiter implementation",
    agent: "Claude Code",
    model: "claude-3-7-sonnet",
    date: "2026-09-06T08:30:00Z",
    timestamp: "2026-09-06T08:30:00Z",
    turns: 6,
    files_count: 3,
    sessions_count: 2,
    is_real: false,
    is_demo: true,
    files_touched: [
      "backend/index.js",
      "backend/services/databricksService.js",
      "backend/services/entireService.js"
    ],
    curated_analysis: {
      original_intent: "Implement production-grade JWT session authentication, authorization middleware, and token rate limiting for backend API endpoints.",
      intent: "Implement production-grade JWT session authentication, authorization middleware, and token rate limiting for backend API endpoints.",
      requirements: [
        { id: "REQ-1", description: "Express authentication middleware with token validation", status: "COMPLETED", confidence: 0.98, evidence: "backend/index.js routes defined" },
        { id: "REQ-2", description: "Configurable token verification and Databricks secret management", status: "COMPLETED", confidence: 0.95, evidence: "backend/services/databricksService.js environment handling" },
        { id: "REQ-3", description: "Automated test suite for token expiration and rotation", status: "MISSING", confidence: 0.92, evidence: "Transcript requested refresh token test suite, no test files created" },
        { id: "REQ-4", description: "Distributed Redis storage for multi-instance rate limiting", status: "MISSING", confidence: 0.88, evidence: "Session transcript noted rate limiting left in-memory for MVP" }
      ],
      completed_work: [
        { description: "backend/index.js", evidence: "Express API server with endpoint routing", confidence: 0.99 },
        { description: "backend/services/databricksService.js", evidence: "Foundation model client & fallback handling", confidence: 0.96 },
        { description: "backend/services/entireService.js", evidence: "Entire CLI and Graph integration service", confidence: 0.97 }
      ],
      partial_work: [],
      unfinished_work: [
        { description: "Automated test suite for token expiration and rotation", evidence: "Prompt requested test cases; no tests generated in repo", confidence: 0.94, priority: "HIGH" },
        { description: "Distributed Redis storage for rate limiting across multiple server nodes", evidence: "Implemented in-memory Map only; flagged as tech debt in transcript", confidence: 0.91, priority: "MEDIUM" }
      ],
      important_decisions: [
        { description: "Used RS256 token verification pattern for asymmetric key separation", rationale: "Security review in agent transcript recommended public key distribution", relevant_files: ["backend/index.js"], impact: "Security architecture", confidence: 0.95 },
        { description: "Separated Entire CLI wrappers into standalone service module", rationale: "Ensures testability and independent mocking in containerized environments", relevant_files: ["backend/services/entireService.js"], impact: "Code modularity", confidence: 0.96 }
      ],
      assumptions: [
        { description: "Assumed single-process deployment allows in-memory rate limiting map without Redis", source: "Agent reasoning turn 4", risk_level: "HIGH", confidence: 0.92, verification_status: "CONTRADICTED" },
        { description: "Assumed upstream API gateway handles SSL termination before hitting backend port", source: "Prompt specification", risk_level: "LOW", confidence: 0.85, verification_status: "PARTIALLY_VERIFIED" }
      ],
      risks: [
        { description: "In-memory rate limiting fails across distributed multi-cluster deployments", severity: "HIGH", evidence: "No external cache store connected", confidence: 0.93 },
        { description: "Missing refresh token rotation tests could lead to silent session hijacking", severity: "HIGH", evidence: "Zero test coverage on token expiration logic", confidence: 0.90 }
      ],
      relevant_files: [
        "backend/index.js",
        "backend/services/databricksService.js",
        "backend/services/entireService.js"
      ],
      recommended_next_steps: [
        { description: "Create test suite verifying token expiration edges", priority: "HIGH" },
        { description: "Replace in-memory rate limiter with Redis cluster client", priority: "MEDIUM" },
        { description: "Run Entire Graph impact analysis on changed route handlers", priority: "HIGH" }
      ]
    },
    transcript: `[USER]: Build the backend authentication and rate limiting for Code Archaeologist API.
[AGENT]: I will set up the Express routes, JWT validation, and in-memory rate limiting.
[AGENT]: Created backend/index.js with Express routes and middleware.
[AGENT]: Created backend/services/databricksService.js for token & AI integration.
[AGENT]: Created backend/services/entireService.js for CLI wrapping.
[USER]: Make sure you add test suites for token refresh rotation and Redis cache storage.
[AGENT]: I am noting that down. I implemented the core endpoints first. The test suite and Redis store remain pending for the next sprint.`
  },
  {
    id: "cp-3e1b09-graph-ui",
    checkpoint_id: "cp-3e1b09-graph-ui",
    session_id: "ses-4412-mission-ctrl",
    message: "feat(ui): Mission Control dashboard with Entire Graph code verification",
    summary: "Mission Control UI dashboard with Entire Graph code verification and Handoff generator",
    agent: "Gemini CLI",
    model: "gemini-3-flash-preview",
    date: "2026-09-06T09:15:00Z",
    timestamp: "2026-09-06T09:15:00Z",
    turns: 4,
    files_count: 4,
    sessions_count: 1,
    is_real: false,
    is_demo: true,
    files_touched: [
      "src/app/page.js",
      "src/app/globals.css",
      "src/app/layout.js",
      "next.config.mjs"
    ],
    curated_analysis: {
      original_intent: "Build ForgeOS / Mission Control Developer Intelligence dashboard with live checkpoint explorer, Entire Graph code verification, and Agent Handoff generator.",
      intent: "Build ForgeOS / Mission Control Developer Intelligence dashboard with live checkpoint explorer, Entire Graph code verification, and Agent Handoff generator.",
      requirements: [
        { id: "REQ-1", description: "Industrial Mission Control theme with high-contrast panels", status: "COMPLETED", confidence: 0.99, evidence: "src/app/globals.css" },
        { id: "REQ-2", description: "Interactive checkpoint selection and step-by-step pipeline runner", status: "COMPLETED", confidence: 0.98, evidence: "src/app/page.js" },
        { id: "REQ-3", description: "Verification tab checking AI claims against Entire Graph", status: "COMPLETED", confidence: 0.96, evidence: "Entire Graph code search integration" },
        { id: "REQ-4", description: "Dark/light mode toggle with persistence", status: "MISSING", confidence: 0.85, evidence: "UI styled exclusively in dark theme; theme switcher not yet implemented" }
      ],
      completed_work: [
        { description: "src/app/page.js", evidence: "Full interactive Mission Control dashboard client component", confidence: 0.99 },
        { description: "src/app/globals.css", evidence: "Complete ForgeOS CSS styling and micro-animations", confidence: 0.98 },
        { description: "next.config.mjs", evidence: "API proxy configuration for Express backend", confidence: 0.97 }
      ],
      partial_work: [],
      unfinished_work: [
        { description: "Dark/light mode toggle with persistence", evidence: "Mentioned in early UI wireframe requirements, deferred for hackathon launch", confidence: 0.89, priority: "LOW" },
        { description: "WebSocket live streaming for real-time Entire Checkpoint notifications", evidence: "Currently uses polling / manual scan; live streaming endpoint pending", confidence: 0.88, priority: "MEDIUM" }
      ],
      important_decisions: [
        { description: "Adopted Next.js App Router with client-side component state for reactive pipeline transitions", rationale: "Fast render latency and seamless step-by-step pipeline updates", relevant_files: ["src/app/page.js"], impact: "Frontend reactivity", confidence: 0.96 },
        { description: "Configured API rewrites in next.config.mjs instead of separate CORS proxy", rationale: "Eliminates CORS preflight overhead in development and staging", relevant_files: ["next.config.mjs"], impact: "Network latency", confidence: 0.97 }
      ],
      assumptions: [
        { description: "Assumed developer screen viewport is at least 1024px for mission control layout", source: "UI wireframe spec", risk_level: "LOW", confidence: 0.90, verification_status: "VERIFIED" },
        { description: "Assumed localhost:3001 is available for Express server without port collision", source: "Architecture config", risk_level: "MEDIUM", confidence: 0.88, verification_status: "VERIFIED" }
      ],
      risks: [
        { description: "Polling interval for health check may exceed rate limit on large repos", severity: "LOW", evidence: "Single periodic call on scan", confidence: 0.82 }
      ],
      relevant_files: [
        "src/app/page.js",
        "src/app/globals.css",
        "next.config.mjs"
      ],
      recommended_next_steps: [
        { description: "Add WebSocket live checkpoint stream for multi-agent teams", priority: "MEDIUM" },
        { description: "Implement theme switcher toggle in navigation bar", priority: "LOW" }
      ]
    },
    transcript: `[USER]: Build the Mission Control frontend using ForgeOS design aesthetics with dark panels and amber/green accents.
[AGENT]: Creating src/app/globals.css with complete ForgeOS design tokens and responsive grid.
[AGENT]: Creating src/app/page.js with Checkpoint Explorer, Pipeline Stepper, Graph Verification, and Handoff Generator.
[USER]: Also add a theme switcher toggle and WebSocket live streaming.
[AGENT]: The dashboard and graph panels are complete. Theme toggle and WebSockets are deferred as unfinished requirements.`
  }
];

// ── Demo Sessions Fixtures ──
export const DEMO_SESSIONS = [
  {
    session_id: "ses-9921-auth-impl",
    agent: "Claude Code",
    model: "claude-3-7-sonnet",
    status: "ended",
    started_at: "2026-09-06T08:10:00Z",
    ended_at: "2026-09-06T08:32:00Z",
    turns: 6,
    checkpoints: 1,
    files_touched: ["backend/index.js", "backend/services/databricksService.js", "backend/services/entireService.js"],
    last_prompt: "Build the backend authentication and rate limiting for Code Archaeologist API...",
    is_real: false,
    is_demo: true
  },
  {
    session_id: "ses-4412-mission-ctrl",
    agent: "Gemini CLI",
    model: "gemini-3-flash-preview",
    status: "ended",
    started_at: "2026-09-06T08:50:00Z",
    ended_at: "2026-09-06T09:18:00Z",
    turns: 4,
    checkpoints: 1,
    files_touched: ["src/app/page.js", "src/app/globals.css", "src/app/layout.js", "next.config.mjs"],
    last_prompt: "Build the Mission Control frontend using ForgeOS design aesthetics...",
    is_real: false,
    is_demo: true
  }
];

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

// ── Sessions Management (Section 4.2) ──
export function listSessions(repoPath) {
  const result = runEntireCommand('session list --json', repoPath);
  let realSessions = [];
  if (result.success) {
    const parsed = parseJsonSafe(result.data);
    if (Array.isArray(parsed)) {
      realSessions = parsed.map(s => ({ ...s, is_real: true, is_demo: false }));
    }
  }

  // Combine real sessions with demo sessions for rich testing
  const allSessions = [...realSessions, ...DEMO_SESSIONS];
  return {
    success: true,
    sessions: allSessions,
    real_count: realSessions.length,
    demo_count: DEMO_SESSIONS.length
  };
}

export function getCurrentSession(repoPath) {
  const result = runEntireCommand('session current', repoPath);
  return {
    success: result.success,
    output: result.data || result.error || 'No active session'
  };
}

export function getSessionInfo(sessionId, repoPath) {
  const demo = DEMO_SESSIONS.find(s => s.session_id === sessionId);
  if (demo) return { success: true, session: demo };

  const result = runEntireCommand(`session info ${sessionId} --json`, repoPath);
  if (!result.success) return { success: false, error: result.error };
  const parsed = parseJsonSafe(result.data);
  return { success: true, session: parsed || { raw: result.data } };
}

// ── List Checkpoints (Section 4.1 & 5.2) ──
export function listCheckpoints(repoPath) {
  const result = runEntireCommand('checkpoint list --json', repoPath);
  const sessionsResult = listSessions(repoPath);
  const sessionMap = new Map();
  (sessionsResult.sessions || []).forEach(s => sessionMap.set(s.session_id, s));

  let realCheckpoints = [];
  if (result.success) {
    const parsed = parseJsonSafe(result.data);
    if (parsed) {
      const rawList = Array.isArray(parsed) ? parsed : (parsed.checkpoints || []);
      realCheckpoints = rawList.map(cp => {
        const cpId = cp.checkpoint_id || cp.id;
        const sInfo = cp.session_id ? sessionMap.get(cp.session_id) : null;
        return {
          id: cpId,
          checkpoint_id: cpId,
          session_id: cp.session_id || sInfo?.session_id || null,
          message: cp.message || sInfo?.last_prompt || "Checkpoint commit",
          summary: cp.summary || cp.message || "Entire checkpoint",
          agent: sInfo?.agent || "Entire Agent",
          model: sInfo?.model || "AI Model",
          date: cp.date || sInfo?.started_at || new Date().toISOString(),
          timestamp: cp.date || sInfo?.started_at || new Date().toISOString(),
          turns: sInfo?.turns || 1,
          files_count: sInfo?.files_touched?.length || 0,
          files_touched: sInfo?.files_touched || [],
          is_real: true,
          is_demo: false
        };
      });
    }
  }

  // Always make demo checkpoints available alongside real checkpoints
  const allCheckpoints = [...realCheckpoints, ...DEMO_CHECKPOINTS];
  return {
    success: true,
    checkpoints: allCheckpoints,
    real_count: realCheckpoints.length,
    demo_count: DEMO_CHECKPOINTS.length
  };
}

// ── Checkpoint Metadata ──
export function getCheckpointMetadata(checkpointId, repoPath) {
  const demoCp = DEMO_CHECKPOINTS.find(c => c.id === checkpointId || c.checkpoint_id === checkpointId);
  if (demoCp) {
    return { success: true, metadata: demoCp, is_demo: true };
  }

  // First try JSON explain
  let meta = null;
  const jsonRes = runEntireCommand(`checkpoint explain ${checkpointId} --json`, repoPath);
  if (jsonRes.success) {
    meta = parseJsonSafe(jsonRes.data);
  }

  // If jsonRes wasn't available or had no trailer, get human explanation & attach session info
  if (!meta) {
    const fullRes = runEntireCommand(`checkpoint explain ${checkpointId}`, repoPath);
    const sessions = listSessions(repoPath).sessions || [];
    // Find matching session if possible
    let matchedSession = null;
    if (fullRes.success && fullRes.data) {
      const match = fullRes.data.match(/session\s+([a-f0-9\-]+)/i);
      if (match) {
        matchedSession = sessions.find(s => s.session_id === match[1]);
      }
    }

    meta = {
      id: checkpointId,
      checkpoint_id: checkpointId,
      session_id: matchedSession?.session_id || null,
      message: matchedSession?.last_prompt || "Checkpoint context",
      agent: matchedSession?.agent || "Entire Agent",
      model: matchedSession?.model || "AI Model",
      files_touched: matchedSession?.files_touched || [],
      explanation_raw: fullRes.data || fullRes.error,
      is_real: true
    };
  }

  return { success: true, metadata: meta, is_demo: false };
}

// ── Checkpoint Explanation ──
export function getCheckpointExplanation(checkpointId, repoPath) {
  const demoCp = DEMO_CHECKPOINTS.find(c => c.id === checkpointId || c.checkpoint_id === checkpointId);
  if (demoCp) {
    return {
      success: true,
      explanation: `${demoCp.message}\n\nAgent: ${demoCp.agent} (${demoCp.model})\nTurns: ${demoCp.turns}\nFiles touched:\n${demoCp.files_touched.map(f => ` - ${f}`).join('\n')}`
    };
  }

  const result = runEntireCommand(`checkpoint explain ${checkpointId}`, repoPath);
  return { success: result.success, explanation: result.data || result.error };
}

// ── Checkpoint Transcript ──
export function getCheckpointTranscript(checkpointId, repoPath, sessionIndex) {
  const demoCp = DEMO_CHECKPOINTS.find(c => c.id === checkpointId || c.checkpoint_id === checkpointId);
  if (demoCp) {
    return { success: true, transcript: demoCp.transcript, error: null };
  }

  const sessionFlag = sessionIndex !== undefined ? ` --session-index ${sessionIndex}` : '';
  const result = runEntireCommand(`checkpoint explain ${checkpointId} --transcript${sessionFlag}`, repoPath);
  if (result.success && result.data) {
    return { success: true, transcript: result.data, error: null };
  }

  // Fallback to full explanation text
  const exp = getCheckpointExplanation(checkpointId, repoPath);
  return { success: exp.success, transcript: exp.explanation, error: exp.success ? null : 'Transcript unavailable' };
}

// ── Search Checkpoints ──
export function searchCheckpoints(query, repoPath) {
  const result = runEntireCommand(`checkpoint search "${query.replace(/"/g, '\\"')}"`, repoPath);
  return { success: result.success, results: result.data || result.error };
}

// ── Development Timeline (Section 5.3) ──
export function buildTimeline(repoPath) {
  const cpRes = listCheckpoints(repoPath);
  const sesRes = listSessions(repoPath);

  const events = [];

  // Add session events
  (sesRes.sessions || []).forEach(s => {
    events.push({
      type: "session",
      id: s.session_id,
      title: `Agent Session: ${s.agent}`,
      subtitle: s.last_prompt ? `Prompt: ${s.last_prompt.substring(0, 80)}...` : `Model: ${s.model}`,
      timestamp: s.started_at || new Date().toISOString(),
      agent: s.agent,
      model: s.model,
      turns: s.turns,
      files_touched: s.files_touched || [],
      is_real: s.is_real !== false,
      status: s.status || "completed"
    });
  });

  // Add checkpoint events
  (cpRes.checkpoints || []).forEach(cp => {
    events.push({
      type: "checkpoint",
      id: cp.id || cp.checkpoint_id,
      title: `Checkpoint: ${(cp.message || "Update").substring(0, 60)}`,
      subtitle: `ID: ${(cp.id || cp.checkpoint_id || "").substring(0, 12)}...`,
      timestamp: cp.timestamp || cp.date || new Date().toISOString(),
      agent: cp.agent,
      model: cp.model,
      files_count: cp.files_count || (cp.files_touched?.length || 0),
      files_touched: cp.files_touched || [],
      is_real: cp.is_real !== false,
      status: "committed"
    });
  });

  // Sort chronologically (latest first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return { success: true, timeline: events };
}

// ── Entire Graph Commands ──
export function graphSearch(query, repoPath, topK = 5) {
  const result = runEntireCommand(
    `graph search --query "${query.replace(/"/g, '\\"')}" --format json --top-k ${topK} --repo ${repoPath || '.'}`,
    repoPath
  );
  if (!result.success) return { success: false, error: result.error, stderr: result.stderr };
  const parsed = parseJsonSafe(result.data);
  return { success: true, results: parsed || result.data };
}

export function graphImpact(symbol, repoPath) {
  const result = runEntireCommand(
    `graph impact --symbol "${symbol.replace(/"/g, '\\"')}" --format json --repo ${repoPath || '.'}`,
    repoPath
  );
  if (!result.success) return { success: false, error: result.error };
  const parsed = parseJsonSafe(result.data);
  return { success: true, results: parsed || result.data };
}

export function graphDef(symbol, repoPath) {
  const result = runEntireCommand(
    `graph def --symbol "${symbol.replace(/"/g, '\\"')}" --format json --repo ${repoPath || '.'}`,
    repoPath
  );
  if (!result.success) return { success: false, error: result.error };
  const parsed = parseJsonSafe(result.data);
  return { success: true, results: parsed || result.data };
}

export function graphCheckpoint(checkpointId, repoPath) {
  const result = runEntireCommand(`graph checkpoint ${checkpointId} --json --repo ${repoPath || '.'}`, repoPath);
  if (!result.success) return { success: false, error: result.error };
  const parsed = parseJsonSafe(result.data);
  return { success: true, results: parsed || result.data };
}

// ── 4-State Entire Graph Verification (Section 4.4 & 5.9) ──
// Verification States:
// - VERIFIED: Strong codebase evidence with high match score & line numbers
// - PARTIALLY_VERIFIED: Partial components or references found
// - UNVERIFIED: No conclusive graph match found
// - CONTRADICTED: Explicitly absent or contradicts claimed implementation
export function verifyClaimsWithGraph(claims, repoPath) {
  const results = [];
  for (const claimObj of claims.slice(0, 10)) {
    const rawClaim = typeof claimObj === 'string' ? claimObj : (claimObj.description || claimObj.claim || '');
    const claimType = claimObj.type || 'requirement'; // 'completed', 'unfinished', 'assumption', 'decision'

    // Extract target symbol or filename for search
    let searchTerm = rawClaim
      .replace(/^(Modified|Completed|Missing|Added|Removed|Implemented|Created|File modification|Assumed):\s*/i, '')
      .replace(/^src\/app\//, '')
      .replace(/^backend\/(services\/)?/, '')
      .trim();

    if (searchTerm.length < 3) continue;

    // Run real Entire Graph search on local codebase
    const graphResult = graphSearch(searchTerm, repoPath, 3);
    let status = 'UNVERIFIED';
    let evidence = null;
    let impactInfo = null;

    if (graphResult.success && graphResult.results) {
      const resObj = typeof graphResult.results === 'string'
        ? parseJsonSafe(graphResult.results)
        : graphResult.results;

      const hitList = Array.isArray(resObj?.results) ? resObj.results : [];
      const topScore = hitList[0]?.score || 0;

      if (hitList.length > 0 && topScore >= 15) {
        status = 'VERIFIED';
        evidence = {
          explanation: `Entire Graph confirmed ${hitList.length} matching code symbol(s) in repository.`,
          matches_count: hitList.length,
          top_matches: hitList.slice(0, 3).map(m => ({
            file: m.file_path,
            line: m.start_line,
            score: Math.round((m.score || 0) * 10) / 10,
          }))
        };

        // Try impact query for top symbol if applicable
        const topSymbol = searchTerm.split(/[\s/.]+/).pop();
        if (topSymbol && topSymbol.length > 3) {
          const impactRes = graphImpact(topSymbol, repoPath);
          if (impactRes.success && impactRes.results) {
            const callers = impactRes.results.callers?.total || 0;
            const callees = impactRes.results.callees?.total || 0;
            impactInfo = {
              symbol: topSymbol,
              callers_count: callers,
              callees_count: callees,
              file: impactRes.results.focus?.file_path || null
            };
          }
        }

      } else if (hitList.length > 0 && topScore < 15) {
        status = 'PARTIALLY_VERIFIED';
        evidence = {
          explanation: `Weak or indirect references detected by Entire Graph (score: ${topScore.toFixed(1)}).`,
          matches_count: hitList.length,
          top_matches: hitList.slice(0, 2).map(m => ({
            file: m.file_path,
            line: m.start_line,
            score: Math.round((m.score || 0) * 10) / 10,
          }))
        };
      } else {
        // Zero hits found
        if (claimType === 'unfinished' || rawClaim.toLowerCase().includes('missing') || rawClaim.toLowerCase().includes('test')) {
          status = 'VERIFIED'; // Verified as genuinely missing in code!
          evidence = {
            explanation: `Entire Graph verified requirement is NOT present in codebase (0 matches found).`,
            matches_count: 0,
            top_matches: []
          };
        } else if (rawClaim.toLowerCase().includes('assumed') || claimType === 'assumption') {
          status = 'CONTRADICTED';
          evidence = {
            explanation: `Entire Graph could not verify this assumption against code definitions.`,
            matches_count: 0,
            top_matches: []
          };
        } else {
          status = 'CONTRADICTED';
          evidence = {
            explanation: `Claimed code symbol or component was not found in codebase index.`,
            matches_count: 0,
            top_matches: []
          };
        }
      }
    } else {
      status = 'UNVERIFIED';
      evidence = {
        explanation: 'Entire Graph search could not be evaluated for this query.',
        matches_count: 0,
        top_matches: []
      };
    }

    results.push({
      claim: rawClaim,
      query: searchTerm,
      status, // 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED' | 'CONTRADICTED'
      type: claimType,
      evidence,
      impact: impactInfo,
      source: 'entire-graph'
    });
  }
  return results;
}

export function isGraphAvailable(repoPath) {
  const result = runEntireCommand('graph version', repoPath);
  return { available: result.success, version: result.success ? result.data : null, error: result.success ? null : result.error };
}
