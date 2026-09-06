import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildRepoAccessPolicy,
  isLoopbackAddress,
  normalizeDatabricksHost,
  redactSensitiveText,
  resolveAllowedRepoPath,
  stripRawCheckpointFields,
  timingSafeEqualString,
} from '../services/security.js';

describe('Security helpers', () => {
  it('redacts common credential values from text', () => {
    const text = 'DATABRICKS_TOKEN=dapi0123456789abcdef0123456789abcdef and OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890';
    const redacted = redactSensitiveText(text);

    assert.doesNotMatch(redacted, /dapi0123456789abcdef/i);
    assert.doesNotMatch(redacted, /sk-proj-/);
    assert.match(redacted, /\[REDACTED_/);
  });

  it('strips raw checkpoint prompt and transcript fields', () => {
    const stripped = stripRawCheckpointFields({
      transcript: '[USER]: secret task',
      rawResponse: 'model output',
      advisor_prompt: 'safe generated directive',
      nested: { prompt: 'raw prompt' },
    });

    assert.equal(stripped.transcript, '[WITHHELD_BY_PRIVACY_BOUNDARY]');
    assert.equal(stripped.rawResponse, '[WITHHELD_BY_PRIVACY_BOUNDARY]');
    assert.equal(stripped.advisor_prompt, 'safe generated directive');
    assert.equal(stripped.nested.prompt, '[WITHHELD_BY_PRIVACY_BOUNDARY]');
  });

  it('restricts repository paths to configured allowed roots', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ca-allowed-'));
    const child = path.join(root, 'repo');
    fs.mkdirSync(child);
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'ca-denied-'));
    const policy = buildRepoAccessPolicy({
      appRoot: root,
      env: { CODE_ARCHAEOLOGIST_ALLOWED_REPO_ROOTS: root },
    });

    assert.equal(resolveAllowedRepoPath(child, policy), fs.realpathSync(child));
    assert.throws(() => resolveAllowedRepoPath(outside, policy), /outside the configured allowed roots/);
  });

  it('rejects unsafe Databricks hosts by default', () => {
    assert.equal(normalizeDatabricksHost('https://dbc-example.cloud.databricks.com/').ok, true);
    assert.equal(normalizeDatabricksHost('http://dbc-example.cloud.databricks.com/').ok, false);
    assert.equal(normalizeDatabricksHost('https://127.0.0.1:8080/').ok, false);
    assert.equal(normalizeDatabricksHost('https://user:pass@example.com/').ok, false);
  });

  it('handles loopback and API token comparisons safely', () => {
    assert.equal(isLoopbackAddress('127.0.0.1'), true);
    assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true);
    assert.equal(isLoopbackAddress('10.0.0.5'), false);
    assert.equal(timingSafeEqualString('token-a', 'token-a'), true);
    assert.equal(timingSafeEqualString('token-a', 'token-b'), false);
  });
});
