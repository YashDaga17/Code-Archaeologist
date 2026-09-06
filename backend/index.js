// ═══════════════════════════════════════════════════════════════
// CODE ARCHAEOLOGIST — Backend API Server
// ═══════════════════════════════════════════════════════════════

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  getEntireStatus, listCheckpoints, getCheckpointMetadata,
  getCheckpointExplanation, getCheckpointTranscript, searchCheckpoints,
  graphSearch, graphImpact, graphCheckpoint, verifyClaimsWithGraph, isGraphAvailable,
} from './services/entireService.js';
import {
  isDatabricksConfigured, analyzeCheckpoint, generateHandoff,
} from './services/databricksService.js';

dotenv.config();
const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Health ──
app.get('/api/health', (req, res) => {
  const repoPath = req.query.repo || process.cwd();
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    services: {
      entire: { status: getEntireStatus(repoPath).enabled ? 'online' : 'offline', version: getEntireStatus(repoPath).version },
      graph: { status: isGraphAvailable(repoPath).available ? 'online' : 'offline', version: isGraphAvailable(repoPath).version },
      databricks: { ...isDatabricksConfigured(), status: isDatabricksConfigured().configured ? 'online' : 'not_configured' },
    },
  });
});

// ── Checkpoints ──
app.get('/api/checkpoints', (req, res) => {
  res.json(listCheckpoints(req.query.repo || process.cwd()));
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
  if (!req.query.q) return res.status(400).json({ error: 'Query "q" required' });
  res.json(searchCheckpoints(req.query.q, req.query.repo || process.cwd()));
});

// ── Full Analysis Pipeline ──
app.post('/api/analyze', async (req, res) => {
  const { checkpointId, repoPath: reqRepo } = req.body;
  const repoPath = reqRepo || process.cwd();
  if (!checkpointId) return res.status(400).json({ error: 'checkpointId required' });

  const pipelineStart = Date.now();
  const pipelineLog = [];

  try {
    // Step 1: Extract checkpoint context
    pipelineLog.push({ step: 'checkpoint_extraction', status: 'running', time: Date.now() - pipelineStart });
    const meta = getCheckpointMetadata(checkpointId, repoPath);
    const transcriptResult = getCheckpointTranscript(checkpointId, repoPath);
    const explanation = getCheckpointExplanation(checkpointId, repoPath);
    pipelineLog.push({ step: 'checkpoint_extraction', status: meta.success ? 'completed' : 'error', time: Date.now() - pipelineStart });

    // Step 2: Databricks AI analysis
    pipelineLog.push({ step: 'databricks_analysis', status: 'running', time: Date.now() - pipelineStart });
    const analysis = await analyzeCheckpoint(meta.metadata || {}, transcriptResult.transcript || explanation.explanation || '');
    pipelineLog.push({ step: 'databricks_analysis', status: 'completed', source: analysis.source, model: analysis.model, time: Date.now() - pipelineStart });

    // Step 3: Graph verification
    pipelineLog.push({ step: 'graph_verification', status: 'running', time: Date.now() - pipelineStart });
    const claimsToVerify = [
      ...(analysis.data?.completed || []).map(c => c.description || c),
      ...(analysis.data?.unfinished || []).map(u => u.description || u),
    ];
    const graphEvidence = verifyClaimsWithGraph(claimsToVerify, repoPath);
    pipelineLog.push({ step: 'graph_verification', status: 'completed', claims_checked: graphEvidence.length, verified: graphEvidence.filter(e => e.status === 'VERIFIED').length, time: Date.now() - pipelineStart });

    // Step 4: Generate handoff
    const handoff = generateHandoff(analysis.data, graphEvidence, checkpointId, repoPath);
    pipelineLog.push({ step: 'handoff_generation', status: 'completed', time: Date.now() - pipelineStart });

    res.json({
      success: true, checkpoint_id: checkpointId, repo: repoPath,
      pipeline: pipelineLog, pipeline_duration_ms: Date.now() - pipelineStart,
      analysis: { source: analysis.source, model: analysis.model, fallback_reason: analysis.reason || null, data: analysis.data },
      graph_verification: graphEvidence, handoff,
    });
  } catch (err) {
    pipelineLog.push({ step: 'error', error: err.message, time: Date.now() - pipelineStart });
    res.status(500).json({ success: false, error: err.message, pipeline: pipelineLog });
  }
});

// ── Databricks Status ──
app.get('/api/databricks/status', (req, res) => res.json(isDatabricksConfigured()));

// ── Graph ──
app.get('/api/graph/search', (req, res) => {
  if (!req.query.query) return res.status(400).json({ error: 'query required' });
  res.json(graphSearch(req.query.query, req.query.repo || process.cwd(), parseInt(req.query.topK) || 5));
});

app.get('/api/graph/impact', (req, res) => {
  if (!req.query.symbol) return res.status(400).json({ error: 'symbol required' });
  res.json(graphImpact(req.query.symbol, req.query.repo || process.cwd()));
});

app.get('/api/graph/checkpoint/:id', (req, res) => {
  res.json(graphCheckpoint(req.params.id, req.query.repo || process.cwd()));
});

// ── Handoff ──
app.post('/api/handoff', (req, res) => {
  const { analysis, graphVerification, checkpointId, repoPath } = req.body;
  res.json(generateHandoff(analysis, graphVerification, checkpointId, repoPath));
});

// ── Start ──
app.listen(PORT, () => {
  const db = isDatabricksConfigured();
  console.log('');
  console.log('  ╔═══════════════════════════════════════════════════╗');
  console.log('  ║                                                   ║');
  console.log('  ║   ⛏  CODE ARCHAEOLOGIST — Backend API             ║');
  console.log('  ║   AI Development Intelligence Engine              ║');
  console.log('  ║                                                   ║');
  console.log(`  ║   Server:     http://localhost:${PORT}                ║`);
  console.log(`  ║   Databricks: ${db.configured ? '✓ Connected' : '✗ Not configured'}                    ║`);
  console.log('  ║                                                   ║');
  console.log('  ╚═══════════════════════════════════════════════════╝');
  console.log('');
});
