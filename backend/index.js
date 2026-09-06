// ═══════════════════════════════════════════════════════════════
// CODE ARCHAEOLOGIST — Backend API Server
// ═══════════════════════════════════════════════════════════════

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import {
  getEntireStatus, listCheckpoints, getCheckpointMetadata,
  getCheckpointExplanation, getCheckpointTranscript, searchCheckpoints,
  listSessions, getCurrentSession, getSessionInfo, buildTimeline,
  graphSearch, graphImpact, graphCheckpoint, verifyClaimsWithGraph, isGraphAvailable,
} from './services/entireService.js';
import {
  isDatabricksConfigured, analyzeCheckpoint, generateHandoff,
  generateIntelligenceReport, saveToLakehouse, getLakehouseHistory, getAgentResumePrompt,
} from './services/databricksService.js';
import {
  buildRepoAccessPolicy,
  envFlag,
  HttpError,
  isLoopbackAddress,
  parseBoundedInteger,
  redactSensitiveText,
  requestToken,
  requirePlainObject,
  requireSafeIdentifier,
  requireSafeText,
  resolveAllowedRepoPath,
  sanitizeErrorMessage,
  sanitizeForClient,
  timingSafeEqualString,
} from './services/security.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const app = express();
const APP_ROOT = path.resolve(__dirname, '..');
const repoPolicy = buildRepoAccessPolicy({ appRoot: APP_ROOT });
const PORT = process.env.BACKEND_PORT || 3001;
const BIND_HOST = process.env.BACKEND_BIND_HOST || process.env.HOST || '127.0.0.1';
const JSON_BODY_LIMIT = process.env.API_JSON_BODY_LIMIT || '2mb';
const API_TOKEN = process.env.CODE_ARCHAEOLOGIST_API_TOKEN || process.env.API_AUTH_TOKEN || '';
const REQUIRE_API_AUTH = envFlag('CODE_ARCHAEOLOGIST_REQUIRE_API_AUTH') || (!isLoopbackAddress(BIND_HOST) && BIND_HOST !== 'localhost');
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  `http://localhost:${process.env.DATABRICKS_APP_PORT || 8000}`,
  `http://127.0.0.1:${process.env.DATABRICKS_APP_PORT || 8000}`,
];
const ALLOWED_ORIGINS = new Set(
  (process.env.CODE_ARCHAEOLOGIST_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
);

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || ALLOWED_ORIGINS.has(origin));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Code-Archaeologist-Token'],
  maxAge: 600,
}));
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use('/api', requireApiAccess);

// In-memory Async Job Store (Section 12 Asynchronous Processing)
const jobs = new Map();

function isLoopbackRequest(req) {
  return [req.ip, req.socket?.remoteAddress, req.connection?.remoteAddress].some(isLoopbackAddress);
}

function requireApiAccess(req, res, next) {
  if (!REQUIRE_API_AUTH && isLoopbackRequest(req)) {
    return next();
  }

  if (API_TOKEN && timingSafeEqualString(requestToken(req), API_TOKEN)) {
    return next();
  }

  const status = API_TOKEN ? 401 : 403;
  return sendJson(res.status(status), {
    success: false,
    error: API_TOKEN ? 'Authentication required' : 'Remote API access is disabled until CODE_ARCHAEOLOGIST_API_TOKEN is configured'
  });
}

function route(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

function requestRepo(rawRepo) {
  return resolveAllowedRepoPath(rawRepo, repoPolicy);
}

function sendJson(res, payload, repoPath) {
  return res.json(sanitizeForClient(payload, {
    repoPaths: [repoPath, repoPolicy.defaultRepo, APP_ROOT].filter(Boolean)
  }));
}

function graphClaimTypeForRequirement(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'MISSING') return 'unfinished';
  if (normalized === 'PARTIAL') return 'partial';
  return 'completed';
}

function buildClaimsToVerify(analysisData = {}) {
  const claims = [
    ...(analysisData.requirements || []).map(req => ({
      description: req.description || req.requirement || req,
      type: graphClaimTypeForRequirement(req.status)
    })),
    ...(analysisData.completed_work || analysisData.completed || []).map(item => ({
      description: item.description || item,
      type: 'completed'
    })),
    ...(analysisData.partial_work || analysisData.partial || []).map(item => ({
      description: item.description || item,
      type: 'partial'
    })),
    ...(analysisData.unfinished_work || analysisData.unfinished || []).map(item => ({
      description: item.description || item,
      type: 'unfinished'
    })),
    ...(analysisData.assumptions || []).map(item => ({
      description: item.description || item,
      type: 'assumption'
    }))
  ];

  const seen = new Set();
  return claims.filter(claim => {
    if (!claim.description) return false;
    const key = `${claim.type}:${claim.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getGitBranch(repoPath) {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: repoPath || process.cwd(),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
  } catch {
    return 'master';
  }
}

// ── Health & Overview (Section 5.1 Dashboard Metrics) ──
app.get('/api/health', route((req, res) => {
  const repoPath = requestRepo(req.query.repo);
  const branch = getGitBranch(repoPath);
  const entireStatus = getEntireStatus(repoPath);
  const graphStatus = isGraphAvailable(repoPath);
  const databricksStatus = isDatabricksConfigured();
  const repoName = path.basename(repoPath) || 'Code-Archaeologist';

  sendJson(res, {
    status: 'operational',
    repository: repoName,
    branch,
    timestamp: new Date().toISOString(),
    services: {
      entire: {
        status: entireStatus.enabled ? 'online' : 'offline',
        version: entireStatus.version,
        details: entireStatus.output
      },
      graph: {
        status: graphStatus.available ? 'online' : 'offline',
        version: graphStatus.version
      },
      databricks: {
        ...databricksStatus,
        status: databricksStatus.configured ? 'online' : 'not_configured'
      },
    },
  }, repoPath);
}));

// ── Checkpoint Endpoints (Section 4.1 & 5.2) ──
app.get('/api/checkpoints', route((req, res) => {
  const repo = requestRepo(req.query.repo);
  sendJson(res, listCheckpoints(repo), repo);
}));

app.get('/api/checkpoint/:id', route((req, res) => {
  const repo = requestRepo(req.query.repo);
  const checkpointId = requireSafeIdentifier(req.params.id, 'checkpoint id');
  const meta = getCheckpointMetadata(checkpointId, repo);
  const explanation = getCheckpointExplanation(checkpointId, repo);
  sendJson(res, { id: checkpointId, ...meta, explanation: redactSensitiveText(explanation.explanation) }, repo);
}));

app.get('/api/checkpoint/:id/transcript', route((req, res) => {
  const repo = requestRepo(req.query.repo);
  const checkpointId = requireSafeIdentifier(req.params.id, 'checkpoint id');
  const sessionIndex = parseBoundedInteger(req.query.session, 'session', { min: 0, max: 100 });
  const transcript = getCheckpointTranscript(checkpointId, repo, sessionIndex);
  sendJson(res, { ...transcript, redacted: true }, repo);
}));

app.get('/api/checkpoints/search', route((req, res) => {
  const repo = requestRepo(req.query.repo);
  const query = requireSafeText(req.query.q, 'query parameter "q"', { maxLength: 500 });
  sendJson(res, searchCheckpoints(query, repo), repo);
}));

// ── Session Endpoints (Section 4.2 Entire Sessions) ──
app.get('/api/sessions', route((req, res) => {
  const repo = requestRepo(req.query.repo);
  sendJson(res, listSessions(repo), repo);
}));

app.get('/api/session/current', route((req, res) => {
  const repo = requestRepo(req.query.repo);
  sendJson(res, getCurrentSession(repo), repo);
}));

app.get('/api/session/:id', route((req, res) => {
  const repo = requestRepo(req.query.repo);
  const sessionId = requireSafeIdentifier(req.params.id, 'session id');
  sendJson(res, getSessionInfo(sessionId, repo), repo);
}));

// ── Development Timeline (Section 5.3) ──
app.get('/api/timeline', route((req, res) => {
  const repo = requestRepo(req.query.repo);
  sendJson(res, buildTimeline(repo), repo);
}));

// ── Asynchronous Processing Pipeline (Section 12) ──
app.post('/api/jobs/analyze', route((req, res) => {
  const body = requirePlainObject(req.body);
  const checkpointId = requireSafeIdentifier(body.checkpointId, 'checkpointId');
  const repoPath = requestRepo(body.repoPath);

  const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const job = {
    id: jobId,
    checkpointId,
    repoPath,
    status: 'queued', // queued | processing | analyzing | verifying | completed | failed
    progress: 10,
    trace: [
      { step: 'queued', label: 'Analysis job placed in queue', time: 0, status: 'completed' }
    ],
    result: null,
    error: null,
    created_at: new Date().toISOString()
  };

  jobs.set(jobId, job);

  // Run in background
  executePipelineAsync(jobId, checkpointId, repoPath);

  sendJson(res, { success: true, jobId, status: 'queued' }, repoPath);
}));

app.get('/api/jobs/:id', route((req, res) => {
  const jobId = requireSafeIdentifier(req.params.id, 'job id');
  const job = jobs.get(jobId);
  if (!job) throw new HttpError(404, 'Job not found');
  sendJson(res, job, job.repoPath);
}));

async function executePipelineAsync(jobId, checkpointId, repoPath) {
  const job = jobs.get(jobId);
  if (!job) return;
  const start = Date.now();

  try {
    // 1. Loading Entire Checkpoint
    job.status = 'processing';
    job.progress = 25;
    job.trace.push({ step: 'loading_checkpoint', label: 'Loading Entire Checkpoint & Session context', time: Date.now() - start, status: 'running' });

    const meta = getCheckpointMetadata(checkpointId, repoPath);
    const transcriptResult = getCheckpointTranscript(checkpointId, repoPath);
    const explanation = getCheckpointExplanation(checkpointId, repoPath);

    job.trace[job.trace.length - 1].status = 'completed';
    job.trace[job.trace.length - 1].detail = `Checkpoint context loaded (${meta.metadata?.files_touched?.length || 0} files touched)`;

    // 2. Extracting intent & Databricks analysis
    job.status = 'analyzing';
    job.progress = 50;
    job.trace.push({ step: 'databricks_analysis', label: 'Databricks AI intelligence analysis & intent extraction', time: Date.now() - start, status: 'running' });

    const analysis = await analyzeCheckpoint(meta.metadata || {}, transcriptResult.transcript || explanation.explanation || '');

    job.trace[job.trace.length - 1].status = 'completed';
    job.trace[job.trace.length - 1].detail = `Structured intent and requirements extracted (${analysis.source})`;

    // 3. Verifying findings with Entire Graph
    job.status = 'verifying';
    job.progress = 75;
    job.trace.push({ step: 'graph_verification', label: 'Verifying claims against local codebase using Entire Graph', time: Date.now() - start, status: 'running' });

    const graphEvidence = verifyClaimsWithGraph(buildClaimsToVerify(analysis.data), repoPath);

    job.trace[job.trace.length - 1].status = 'completed';
    job.trace[job.trace.length - 1].detail = `Graph verified ${graphEvidence.filter(e => e.status === 'VERIFIED').length}/${graphEvidence.length} claims`;

    // 4. Generating Section 6 handoff
    job.progress = 90;
    job.trace.push({ step: 'handoff_generation', label: 'Generating machine-readable Agent Handoff JSON', time: Date.now() - start, status: 'running' });

    const handoff = generateHandoff(analysis.data, graphEvidence, checkpointId, repoPath);
    const report = generateIntelligenceReport(analysis.data, graphEvidence, checkpointId, repoPath, {
      analysisSource: analysis.source,
      model: analysis.model,
      fallbackReason: analysis.reason
    });

    job.trace[job.trace.length - 1].status = 'completed';
    job.trace[job.trace.length - 1].detail = 'Report and handoff JSON specification ready for downstream agents';

    // Job completed
    job.status = 'completed';
    job.progress = 100;
    job.result = {
      checkpoint_id: checkpointId,
      repo: repoPath,
      duration_ms: Date.now() - start,
      analysis: {
        source: analysis.source,
        model: analysis.model,
        fallback_reason: analysis.reason || null,
        context: analysis.context || null,
        data: analysis.data
      },
      graph_verification: graphEvidence,
      handoff,
      report
    };
  } catch (err) {
    const safeError = sanitizeErrorMessage(err);
    job.status = 'failed';
    job.error = safeError;
    job.trace.push({ step: 'error', label: `Analysis failed: ${safeError}`, time: Date.now() - start, status: 'failed' });
  }
}

// ── Full Synchronous Pipeline (Section 5.10 Live Analysis) ──
app.post('/api/analyze', route(async (req, res) => {
  const body = requirePlainObject(req.body);
  const checkpointId = requireSafeIdentifier(body.checkpointId, 'checkpointId');
  const repoPath = requestRepo(body.repoPath);

  const pipelineStart = Date.now();
  const pipelineLog = [];

  try {
    // Step 1: Extract Entire checkpoint context
    pipelineLog.push({ step: 'checkpoint_extraction', label: 'Loading Entire Checkpoint', status: 'completed', time: Date.now() - pipelineStart });
    const meta = getCheckpointMetadata(checkpointId, repoPath);
    const transcriptResult = getCheckpointTranscript(checkpointId, repoPath);
    const explanation = getCheckpointExplanation(checkpointId, repoPath);

    // Step 2: Databricks AI analysis
    pipelineLog.push({ step: 'databricks_analysis', label: 'Databricks Intelligence Analysis', status: 'running', time: Date.now() - pipelineStart });
    const analysis = await analyzeCheckpoint(meta.metadata || {}, transcriptResult.transcript || explanation.explanation || '');
    pipelineLog[pipelineLog.length - 1].status = 'completed';
    pipelineLog[pipelineLog.length - 1].source = analysis.source;

    // Step 3: Entire Graph verification (4 states: VERIFIED, PARTIALLY_VERIFIED, UNVERIFIED, CONTRADICTED)
    pipelineLog.push({ step: 'graph_verification', label: 'Entire Graph Code Verification', status: 'running', time: Date.now() - pipelineStart });
    const graphEvidence = verifyClaimsWithGraph(buildClaimsToVerify(analysis.data), repoPath);
    pipelineLog[pipelineLog.length - 1].status = 'completed';
    pipelineLog[pipelineLog.length - 1].verified_count = graphEvidence.filter(e => e.status === 'VERIFIED').length;

    // Step 4: Generate Section 6 Agent Handoff
    pipelineLog.push({ step: 'handoff_generation', label: 'Generating Agent Handoff', status: 'completed', time: Date.now() - pipelineStart });
    const handoff = generateHandoff(analysis.data, graphEvidence, checkpointId, repoPath);
    const report = generateIntelligenceReport(analysis.data, graphEvidence, checkpointId, repoPath, {
      analysisSource: analysis.source,
      model: analysis.model,
      fallbackReason: analysis.reason
    });

    sendJson(res, {
      success: true,
      checkpoint_id: checkpointId,
      repo: repoPath,
      pipeline: pipelineLog,
      pipeline_duration_ms: Date.now() - pipelineStart,
      analysis: {
        source: analysis.source,
        model: analysis.model,
        fallback_reason: analysis.reason || null,
        context: analysis.context || null,
        data: analysis.data
      },
      graph_verification: graphEvidence,
      handoff,
      report,
    }, repoPath);
  } catch (err) {
    const safeError = sanitizeErrorMessage(err);
    pipelineLog.push({ step: 'error', error: safeError, time: Date.now() - pipelineStart });
    sendJson(res.status(500), { success: false, error: safeError, pipeline: pipelineLog }, repoPath);
  }
}));

// ── Graph Inspection Endpoints ──
app.get('/api/graph/search', route((req, res) => {
  const repo = requestRepo(req.query.repo);
  const query = requireSafeText(req.query.query, 'query', { maxLength: 500 });
  const topK = parseBoundedInteger(req.query.topK, 'topK', { defaultValue: 5, min: 1, max: 20 });
  sendJson(res, graphSearch(query, repo, topK), repo);
}));

app.get('/api/graph/impact', route((req, res) => {
  const repo = requestRepo(req.query.repo);
  const symbol = requireSafeText(req.query.symbol, 'symbol', { maxLength: 512 });
  sendJson(res, graphImpact(symbol, repo), repo);
}));

app.get('/api/graph/checkpoint/:id', route((req, res) => {
  const repo = requestRepo(req.query.repo);
  const checkpointId = requireSafeIdentifier(req.params.id, 'checkpoint id');
  sendJson(res, graphCheckpoint(checkpointId, repo), repo);
}));

// ── Agent Handoff Direct Endpoint ──
app.post('/api/handoff', route((req, res) => {
  const body = requirePlainObject(req.body);
  const checkpointId = requireSafeIdentifier(body.checkpointId, 'checkpointId');
  const repoPath = requestRepo(body.repoPath);
  sendJson(res, generateHandoff(body.analysis, body.graphVerification, checkpointId, repoPath), repoPath);
}));

// ── Databricks Lakehouse & Advisor Endpoints ──
app.post('/api/databricks/store', route((req, res) => {
  const body = requirePlainObject(req.body);
  const checkpointId = requireSafeIdentifier(body.checkpointId, 'checkpointId');
  const repoPath = requestRepo(body.repoPath);
  sendJson(res, saveToLakehouse(body.analysis, body.handoff, checkpointId, repoPath, body.report), repoPath);
}));

app.get('/api/databricks/lakehouse', route((req, res) => {
  sendJson(res, getLakehouseHistory(), repoPolicy.defaultRepo);
}));

app.post('/api/databricks/advisor', route(async (req, res) => {
  const body = requirePlainObject(req.body);
  const checkpointId = requireSafeIdentifier(body.checkpointId, 'checkpointId');
  sendJson(res, await getAgentResumePrompt(body.analysis, body.graphVerification, checkpointId), repoPolicy.defaultRepo);
}));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const isJsonParseError = err instanceof SyntaxError && 'body' in err;
  const status = isJsonParseError ? 400 : (err.status || 500);
  const message = isJsonParseError
    ? 'Invalid JSON request body'
    : (status >= 500 ? 'Internal server error' : sanitizeErrorMessage(err));
  sendJson(res.status(status), { success: false, error: message }, repoPolicy.defaultRepo);
});

// ── Start Server ──
app.listen(PORT, BIND_HOST, () => {
  const db = isDatabricksConfigured();
  console.log('');
  console.log('  ╔═══════════════════════════════════════════════════╗');
  console.log('  ║                                                   ║');
  console.log('  ║   ⛏  CODE ARCHAEOLOGIST — Backend API v2.0         ║');
  console.log('  ║   Checkpoint-Native Developer Intelligence        ║');
  console.log('  ║                                                   ║');
  console.log(`  ║   Server:     http://${BIND_HOST}:${PORT}                  ║`);
  console.log(`  ║   Databricks: ${db.configured ? '✓ Connected' : '✗ Fallback Mode'}                 ║`);
  console.log('  ║                                                   ║');
  console.log('  ╚═══════════════════════════════════════════════════╝');
  console.log('');
});
