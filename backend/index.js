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
} from './services/databricksService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// In-memory Async Job Store (Section 12 Asynchronous Processing)
const jobs = new Map();

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
app.get('/api/health', (req, res) => {
  const repoPath = req.query.repo || process.cwd();
  const branch = getGitBranch(repoPath);
  const entireStatus = getEntireStatus(repoPath);
  const graphStatus = isGraphAvailable(repoPath);
  const databricksStatus = isDatabricksConfigured();
  const repoName = repoPath.split('/').filter(Boolean).pop() || 'Code-Archaeologist';

  res.json({
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
  });
});

// ── Checkpoint Endpoints (Section 4.1 & 5.2) ──
app.get('/api/checkpoints', (req, res) => {
  const repo = req.query.repo || process.cwd();
  res.json(listCheckpoints(repo));
});

app.get('/api/checkpoint/:id', (req, res) => {
  const repo = req.query.repo || process.cwd();
  const meta = getCheckpointMetadata(req.params.id, repo);
  const explanation = getCheckpointExplanation(req.params.id, repo);
  res.json({ id: req.params.id, ...meta, explanation: explanation.explanation });
});

app.get('/api/checkpoint/:id/transcript', (req, res) => {
  const repo = req.query.repo || process.cwd();
  const si = req.query.session !== undefined ? parseInt(req.query.session) : undefined;
  res.json(getCheckpointTranscript(req.params.id, repo, si));
});

app.get('/api/checkpoints/search', (req, res) => {
  if (!req.query.q) return res.status(400).json({ error: 'Query parameter "q" is required' });
  res.json(searchCheckpoints(req.query.q, req.query.repo || process.cwd()));
});

// ── Session Endpoints (Section 4.2 Entire Sessions) ──
app.get('/api/sessions', (req, res) => {
  const repo = req.query.repo || process.cwd();
  res.json(listSessions(repo));
});

app.get('/api/session/current', (req, res) => {
  const repo = req.query.repo || process.cwd();
  res.json(getCurrentSession(repo));
});

app.get('/api/session/:id', (req, res) => {
  const repo = req.query.repo || process.cwd();
  res.json(getSessionInfo(req.params.id, repo));
});

// ── Development Timeline (Section 5.3) ──
app.get('/api/timeline', (req, res) => {
  const repo = req.query.repo || process.cwd();
  res.json(buildTimeline(repo));
});

// ── Asynchronous Processing Pipeline (Section 12) ──
app.post('/api/jobs/analyze', (req, res) => {
  const { checkpointId, repoPath: reqRepo } = req.body;
  const repoPath = reqRepo || process.cwd();
  if (!checkpointId) return res.status(400).json({ error: 'checkpointId is required' });

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

  res.json({ success: true, jobId, status: 'queued' });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

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

    const claimsToVerify = [
      ...(analysis.data?.completed_work || analysis.data?.completed || []).map(c => ({ description: c.description || c, type: 'completed' })),
      ...(analysis.data?.unfinished_work || analysis.data?.unfinished || []).map(u => ({ description: u.description || u, type: 'unfinished' })),
      ...(analysis.data?.assumptions || []).map(a => ({ description: a.description || a, type: 'assumption' }))
    ];

    const graphEvidence = verifyClaimsWithGraph(claimsToVerify, repoPath);

    job.trace[job.trace.length - 1].status = 'completed';
    job.trace[job.trace.length - 1].detail = `Graph verified ${graphEvidence.filter(e => e.status === 'VERIFIED').length}/${graphEvidence.length} claims`;

    // 4. Generating Section 6 handoff
    job.progress = 90;
    job.trace.push({ step: 'handoff_generation', label: 'Generating machine-readable Agent Handoff JSON', time: Date.now() - start, status: 'running' });

    const handoff = generateHandoff(analysis.data, graphEvidence, checkpointId, repoPath);

    job.trace[job.trace.length - 1].status = 'completed';
    job.trace[job.trace.length - 1].detail = 'Handoff JSON specification ready for downstream agents';

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
        data: analysis.data
      },
      graph_verification: graphEvidence,
      handoff
    };
  } catch (err) {
    job.status = 'failed';
    job.error = err.message;
    job.trace.push({ step: 'error', label: `Analysis failed: ${err.message}`, time: Date.now() - start, status: 'failed' });
  }
}

// ── Full Synchronous Pipeline (Section 5.10 Live Analysis) ──
app.post('/api/analyze', async (req, res) => {
  const { checkpointId, repoPath: reqRepo } = req.body;
  const repoPath = reqRepo || process.cwd();
  if (!checkpointId) return res.status(400).json({ error: 'checkpointId is required' });

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
    const claimsToVerify = [
      ...(analysis.data?.completed_work || analysis.data?.completed || []).map(c => ({ description: c.description || c, type: 'completed' })),
      ...(analysis.data?.unfinished_work || analysis.data?.unfinished || []).map(u => ({ description: u.description || u, type: 'unfinished' })),
      ...(analysis.data?.assumptions || []).map(a => ({ description: a.description || a, type: 'assumption' }))
    ];
    const graphEvidence = verifyClaimsWithGraph(claimsToVerify, repoPath);
    pipelineLog[pipelineLog.length - 1].status = 'completed';
    pipelineLog[pipelineLog.length - 1].verified_count = graphEvidence.filter(e => e.status === 'VERIFIED').length;

    // Step 4: Generate Section 6 Agent Handoff
    pipelineLog.push({ step: 'handoff_generation', label: 'Generating Agent Handoff', status: 'completed', time: Date.now() - pipelineStart });
    const handoff = generateHandoff(analysis.data, graphEvidence, checkpointId, repoPath);

    res.json({
      success: true,
      checkpoint_id: checkpointId,
      repo: repoPath,
      pipeline: pipelineLog,
      pipeline_duration_ms: Date.now() - pipelineStart,
      analysis: {
        source: analysis.source,
        model: analysis.model,
        fallback_reason: analysis.reason || null,
        data: analysis.data
      },
      graph_verification: graphEvidence,
      handoff,
    });
  } catch (err) {
    pipelineLog.push({ step: 'error', error: err.message, time: Date.now() - pipelineStart });
    res.status(500).json({ success: false, error: err.message, pipeline: pipelineLog });
  }
});

// ── Graph Inspection Endpoints ──
app.get('/api/graph/search', (req, res) => {
  if (!req.query.query) return res.status(400).json({ error: 'query is required' });
  res.json(graphSearch(req.query.query, req.query.repo || process.cwd(), parseInt(req.query.topK) || 5));
});

app.get('/api/graph/impact', (req, res) => {
  if (!req.query.symbol) return res.status(400).json({ error: 'symbol is required' });
  res.json(graphImpact(req.query.symbol, req.query.repo || process.cwd()));
});

app.get('/api/graph/checkpoint/:id', (req, res) => {
  res.json(graphCheckpoint(req.params.id, req.query.repo || process.cwd()));
});

// ── Agent Handoff Direct Endpoint ──
app.post('/api/handoff', (req, res) => {
  const { analysis, graphVerification, checkpointId, repoPath } = req.body;
  res.json(generateHandoff(analysis, graphVerification, checkpointId, repoPath || process.cwd()));
});

// ── Start Server ──
app.listen(PORT, () => {
  const db = isDatabricksConfigured();
  console.log('');
  console.log('  ╔═══════════════════════════════════════════════════╗');
  console.log('  ║                                                   ║');
  console.log('  ║   ⛏  CODE ARCHAEOLOGIST — Backend API v2.0         ║');
  console.log('  ║   Checkpoint-Native Developer Intelligence        ║');
  console.log('  ║                                                   ║');
  console.log(`  ║   Server:     http://localhost:${PORT}                ║`);
  console.log(`  ║   Databricks: ${db.configured ? '✓ Connected' : '✗ Fallback Mode'}                 ║`);
  console.log('  ║                                                   ║');
  console.log('  ╚═══════════════════════════════════════════════════╝');
  console.log('');
});
