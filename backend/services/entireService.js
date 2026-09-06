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

// ── Demo Checkpoints Fixtures ──
export const DEMO_CHECKPOINTS = [
  {
    id: "cp-7f8a92-auth",
    checkpoint_id: "cp-7f8a92-auth",
    message: "feat(auth): implement JWT validation, session manager & rate limiter",
    summary: "JWT validation, session manager & rate limiter implementation",
    timestamp: "2026-09-06T08:30:00Z",
    files_count: 3,
    sessions_count: 2,
    is_demo: true,
    files_touched: [
      "backend/index.js",
      "backend/services/databricksService.js",
      "backend/services/entireService.js"
    ],
    curated_analysis: {
      intent: "Implement production-grade JWT session authentication, authorization middleware, and token rate limiting for backend API endpoints.",
      requirements: [
        { id: "REQ-1", description: "Express authentication middleware with token validation", status: "COMPLETED", confidence: 0.98, evidence: "backend/index.js routes defined" },
        { id: "REQ-2", description: "Configurable token verification and Databricks secret management", status: "COMPLETED", confidence: 0.95, evidence: "backend/services/databricksService.js environment handling" },
        { id: "REQ-3", description: "Automated test suite for token expiration and rotation", status: "MISSING", confidence: 0.92, evidence: "Transcript requested refresh token test suite, no test files created" },
        { id: "REQ-4", description: "Distributed Redis storage for multi-instance rate limiting", status: "MISSING", confidence: 0.88, evidence: "Session transcript noted rate limiting left in-memory for MVP" }
      ],
      completed: [
        { description: "backend/index.js", evidence: "Express API server with endpoint routing", confidence: 0.99 },
        { description: "backend/services/databricksService.js", evidence: "Foundation model client & fallback handling", confidence: 0.96 },
        { description: "backend/services/entireService.js", evidence: "Entire CLI and Graph integration service", confidence: 0.97 }
      ],
      unfinished: [
        { description: "Automated test suite for token expiration and rotation", evidence: "Prompt requested test cases; no tests generated in repo", confidence: 0.94, priority: "HIGH" },
        { description: "Distributed Redis storage for rate limiting across multiple server nodes", evidence: "Implemented in-memory Map only; flagged as tech debt in transcript", confidence: 0.91, priority: "MEDIUM" }
      ],
      decisions: [
        { description: "Used RS256 token verification pattern for asymmetric key separation", rationale: "Security review in agent transcript recommended public key distribution", confidence: 0.95 },
        { description: "Separated Entire CLI wrappers into standalone service module", rationale: "Ensures testability and independent mocking in containerized environments", confidence: 0.96 }
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
      next_steps: [
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
    message: "feat(ui): Mission Control dashboard with Entire Graph code verification",
    summary: "Mission Control UI dashboard with Entire Graph code verification and Handoff generator",
    timestamp: "2026-09-06T09:15:00Z",
    files_count: 4,
    sessions_count: 1,
    is_demo: true,
    files_touched: [
      "src/app/page.js",
      "src/app/globals.css",
      "src/app/layout.js",
      "next.config.mjs"
    ],
    curated_analysis: {
      intent: "Build ForgeOS / Mission Control Developer Intelligence dashboard with live checkpoint explorer, Entire Graph code verification, and Agent Handoff generator.",
      requirements: [
        { id: "REQ-1", description: "Industrial Mission Control theme with high-contrast panels", status: "COMPLETED", confidence: 0.99, evidence: "src/app/globals.css" },
        { id: "REQ-2", description: "Interactive checkpoint selection and step-by-step pipeline runner", status: "COMPLETED", confidence: 0.98, evidence: "src/app/page.js" },
        { id: "REQ-3", description: "Verification tab checking AI claims against Entire Graph", status: "COMPLETED", confidence: 0.96, evidence: "Entire Graph code search integration" },
        { id: "REQ-4", description: "Dark/light mode toggle with persistence", status: "MISSING", confidence: 0.85, evidence: "UI styled exclusively in dark theme; theme switcher not yet implemented" }
      ],
      completed: [
        { description: "src/app/page.js", evidence: "Full interactive Mission Control dashboard client component", confidence: 0.99 },
        { description: "src/app/globals.css", evidence: "Complete ForgeOS CSS styling and micro-animations", confidence: 0.98 },
        { description: "next.config.mjs", evidence: "API proxy configuration for Express backend", confidence: 0.97 }
      ],
      unfinished: [
        { description: "Dark/light mode toggle with persistence", evidence: "Mentioned in early UI wireframe requirements, deferred for hackathon launch", confidence: 0.89, priority: "LOW" },
        { description: "WebSocket live streaming for real-time Entire Checkpoint notifications", evidence: "Currently uses polling / manual scan; live streaming endpoint pending", confidence: 0.88, priority: "MEDIUM" }
      ],
      decisions: [
        { description: "Adopted Next.js App Router with client-side component state for reactive pipeline transitions", rationale: "Fast render latency and seamless step-by-step pipeline updates", confidence: 0.96 },
        { description: "Configured API rewrites in next.config.mjs instead of separate CORS proxy", rationale: "Eliminates CORS preflight overhead in development and staging", confidence: 0.97 }
      ],
      risks: [
        { description: "Polling interval for health check may exceed rate limit on large repos", severity: "LOW", evidence: "Single periodic call on scan", confidence: 0.82 }
      ],
      relevant_files: [
        "src/app/page.js",
        "src/app/globals.css",
        "next.config.mjs"
      ],
      next_steps: [
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
  let checkpoints = [];
  if (result.success) {
    const parsed = parseJsonSafe(result.data);
    if (parsed) {
      checkpoints = Array.isArray(parsed) ? parsed : (parsed.checkpoints || []);
    }
  }

  // If no checkpoints exist on this branch yet, provide curated demo checkpoints
  // so the user/judges can explore the full intelligence pipeline immediately.
  if (checkpoints.length === 0) {
    return { success: true, checkpoints: DEMO_CHECKPOINTS, is_demo: true };
  }

  return { success: true, checkpoints, is_demo: false };
}

// ── Checkpoint Metadata ──
export function getCheckpointMetadata(checkpointId, repoPath) {
  const demoCp = DEMO_CHECKPOINTS.find(c => c.id === checkpointId || c.checkpoint_id === checkpointId);
  if (demoCp) {
    return { success: true, metadata: demoCp };
  }

  const result = runEntireCommand(`checkpoint explain ${checkpointId} --json`, repoPath);
  if (!result.success) return { success: false, error: result.error };
  const parsed = parseJsonSafe(result.data);
  return { success: true, metadata: parsed || { raw: result.data } };
}

// ── Checkpoint Explanation (human-readable) ──
export function getCheckpointExplanation(checkpointId, repoPath) {
  const demoCp = DEMO_CHECKPOINTS.find(c => c.id === checkpointId || c.checkpoint_id === checkpointId);
  if (demoCp) {
    return { success: true, explanation: `${demoCp.message}\n\nFiles touched:\n${demoCp.files_touched.map(f => ` - ${f}`).join('\n')}` };
  }

  const result = runEntireCommand(`checkpoint explain ${checkpointId} --full`, repoPath);
  return { success: result.success, explanation: result.data || result.error };
}

// ── Checkpoint Transcript (JSONL / text) ──
export function getCheckpointTranscript(checkpointId, repoPath, sessionIndex) {
  const demoCp = DEMO_CHECKPOINTS.find(c => c.id === checkpointId || c.checkpoint_id === checkpointId);
  if (demoCp) {
    return { success: true, transcript: demoCp.transcript, error: null };
  }

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
    // Extract meaningful target symbol or filename for graph search
    let searchTerm = claim
      .replace(/^(Modified|Completed|Missing|Added|Removed|Implemented|Created|File modification):\s*/i, '')
      .replace(/^src\/app\//, '')
      .replace(/^backend\/(services\/)?/, '')
      .trim();

    if (searchTerm.length < 3) continue;

    // Run real Entire Graph search on the repository
    const graphResult = graphSearch(searchTerm, repoPath, 3);
    let status = 'UNVERIFIED';
    let evidence = null;

    if (graphResult.success && graphResult.results) {
      const resObj = typeof graphResult.results === 'string'
        ? parseJsonSafe(graphResult.results)
        : graphResult.results;

      const hitList = Array.isArray(resObj?.results) ? resObj.results : [];
      if (hitList.length > 0) {
        status = 'VERIFIED';
        evidence = {
          matches_count: hitList.length,
          top_matches: hitList.slice(0, 3).map(m => ({
            file: m.file_path,
            line: m.start_line,
            score: Math.round((m.score || 0) * 10) / 10,
          }))
        };
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
