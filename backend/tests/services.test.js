import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDatabricksConfigured,
  generateHandoff,
  generateIntelligenceReport,
  getAgentResumePrompt,
} from '../services/databricksService.js';
import {
  getEntireStatus,
  isGraphAvailable,
} from '../services/entireService.js';

describe('Code Archaeologist Core Services', () => {
  it('should verify Databricks service configuration structure', () => {
    const status = isDatabricksConfigured();
    assert.ok(typeof status === 'object');
    assert.ok('configured' in status);
    assert.ok('model' in status);
    assert.ok('type' in status);
  });

  it('should generate Section 6 compliant Agent Handoff JSON', () => {
    const mockAnalysis = {
      original_intent: 'Build high-security developer intelligence command center',
      completed_work: ['Added Git hooks', 'Added secret scanner'],
      unfinished_work: ['Add multi-cloud secret scanning'],
      decisions: [{ title: 'Use native Node test runner', rationale: 'Zero dependencies' }],
      assumptions: [{ assumption: 'Git is installed locally', risk_level: 'LOW' }],
      risks: [{ risk: 'Secret leak before commit', severity: 'HIGH' }]
    };

    const mockGraphVerification = [
      { claim: 'Added Git hooks', status: 'VERIFIED', evidence: { file: '.githooks/pre-commit', start_line: 1 } }
    ];

    const handoff = generateHandoff(mockAnalysis, mockGraphVerification, 'test-checkpoint-1', process.cwd());

    assert.ok(handoff, 'Handoff object should exist');
    assert.equal(handoff.checkpoint_id, 'test-checkpoint-1');
    assert.equal(handoff.original_intent, 'Build high-security developer intelligence command center');
    assert.ok(Array.isArray(handoff.completed_work));
    assert.ok(Array.isArray(handoff.unfinished_work));
    assert.ok(Array.isArray(handoff.verification_evidence));
    assert.equal(handoff.verification_evidence[0].status, 'VERIFIED');
  });

  it('should generate a markdown Intelligence Report', () => {
    const mockAnalysis = {
      original_intent: 'Verify system integrity',
      completed_work: ['Verified build'],
      unfinished_work: [],
      decisions: [],
      assumptions: [],
      risks: []
    };

    const report = generateIntelligenceReport(mockAnalysis, [], 'test-cp', process.cwd(), {
      analysisSource: 'unit-test',
      model: 'system.ai.llama-4-maverick'
    });

    assert.ok(typeof report === 'string');
    assert.match(report, /# Code Archaeologist — Developer Intelligence Report/);
    assert.match(report, /test-cp/);
  });

  it('should generate an Agent Resumption Prompt directive', async () => {
    const mockAnalysis = {
      original_intent: 'Implement feature X',
      completed_work: ['Base structure'],
      unfinished_work: ['Unit tests']
    };

    const advisor = await getAgentResumePrompt(mockAnalysis, [], 'test-cp');
    assert.ok(typeof advisor === 'object');
    assert.ok('prompt' in advisor);
    assert.match(advisor.prompt, /AGENT RESUME INSTRUCTION DIRECTIVE/);
  });

  it('should verify Entire CLI and Graph service inquiries', () => {
    const entireStatus = getEntireStatus(process.cwd());
    assert.ok(typeof entireStatus === 'object');
    assert.ok('enabled' in entireStatus);

    const graphStatus = isGraphAvailable(process.cwd());
    assert.ok(typeof graphStatus === 'object');
    assert.ok('available' in graphStatus);
  });
});
