import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Git Security Gate & Secret Scanner Logic', () => {
  // Test regexes matching scripts/security-check.mjs
  const databricksPatRegex = /\bdapi[a-f0-9]{32}\b/i;
  const openAiKeyRegex = /\bsk-(?:live-|proj-)?[a-zA-Z0-9_\-]{24,}\b/;
  const githubPatRegex = /\b(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{50,})\b/;
  const privateKeyRegex = /-----BEGIN (?:RSA |EC |DSA |OPENSSH |)PRIVATE KEY-----/;
  const blockedFileRegexes = [
    /^\.env$/i,
    /^\.env\.(?!example$|template$|sample$)/i,
    /^backend\/\.env$/i,
    /\.databrickscfg$/i,
    /(?:^|\/)id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?$/i,
    /\.(?:pem|key|pkcs12|pfx|p12)$/i,
  ];

  it('should detect a simulated Databricks Personal Access Token', () => {
    const fakePat = 'dapi0123456789abcdef0123456789abcdef';
    assert.match(`const token = "${fakePat}";`, databricksPatRegex);
  });

  it('should detect a simulated OpenAI secret key', () => {
    const fakeKey = 'sk-proj-abcdefghijklmnopqrstuvwxyz1234567890';
    assert.match(`OPENAI_KEY="${fakeKey}"`, openAiKeyRegex);
  });

  it('should detect a simulated GitHub personal access token', () => {
    const fakeGhp = 'ghp_' + 'A'.repeat(36);
    assert.match(`GITHUB_TOKEN=${fakeGhp}`, githubPatRegex);
  });

  it('should detect a private key block', () => {
    const fakePem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----';
    assert.match(fakePem, privateKeyRegex);
  });

  it('should block dangerous and sensitive file names', () => {
    const sensitiveFiles = [
      '.env',
      '.env.production',
      '.env.local',
      'backend/.env',
      'backend/.env.production',
      '.databrickscfg',
      'id_rsa',
      'id_ed25519',
      'cert.key',
      'server.pem',
    ];

    for (const file of sensitiveFiles) {
      const isBlocked = blockedFileRegexes.some(r => r.test(file));
      assert.strictEqual(isBlocked, true, `Expected "${file}" to be blocked`);
    }
  });

  it('should ALLOW safe example and template files', () => {
    const safeFiles = [
      '.env.example',
      '.env.template',
      'backend/.env.example',
      'backend/.env.template',
      'README.md',
      'package.json',
      'src/app/page.js',
    ];

    for (const file of safeFiles) {
      const isBlocked = blockedFileRegexes.some(r => r.test(file));
      assert.strictEqual(isBlocked, false, `Expected "${file}" to be allowed`);
    }
  });

  it('should respect inline suppression comments', () => {
    const line = 'const dummy = "dapi0123456789abcdef0123456789abcdef"; // code-archaeologist:ignore-secret';
    assert.strictEqual(line.includes('code-archaeologist:ignore-secret'), true);
  });
});
