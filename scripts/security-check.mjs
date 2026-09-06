#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// CODE ARCHAEOLOGIST — Git Security Gate & Secret Scanner
// ═══════════════════════════════════════════════════════════════
// Scans files for:
// 1. Sensitive files (.env, private keys, cloud credentials)
// 2. Hardcoded secrets, API tokens, and credentials
// 3. Unsafe / debug configurations (debugger;, disabled TLS)
// ═══════════════════════════════════════════════════════════════

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const isStagedOnly = process.argv.includes('--staged');
const isAllTracked = process.argv.includes('--all');

// ── 1. Forbidden Sensitive File Patterns ──
const BLOCKED_FILE_PATTERNS = [
  /^\.env$/i,
  /^\.env\.(?!example$|template$|sample$)/i,
  /^backend\/\.env$/i,
  /^backend\/\.env\.(?!example$|template$|sample$)/i,
  /\.databrickscfg$/i,
  /(?:^|\/)id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?$/i,
  /\.(?:pem|key|pkcs12|pfx|p12)$/i,
  /(?:service-account|gcp-credentials|aws-credentials).*\.json$/i,
  /\.(?:sqlite|sqlite3|dump)$/i,
  /^backend\/data\/lakehouse\/.*\.jsonl$/i,
];

// ── 2. Hardcoded Secret Patterns ──
const SECRET_RULES = [
  {
    id: 'DATABRICKS_PAT',
    name: 'Databricks Personal Access Token (PAT)',
    regex: /\bdapi[a-f0-9]{32}\b/i,
  },
  {
    id: 'OPENAI_API_KEY',
    name: 'OpenAI / Anthropic API Key',
    regex: /\bsk-(?:live-|proj-)?[a-zA-Z0-9_\-]{24,}\b/,
  },
  {
    id: 'GITHUB_PAT',
    name: 'GitHub Personal Access Token',
    regex: /\b(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{50,})\b/,
  },
  {
    id: 'GOOGLE_API_KEY',
    name: 'Google Cloud / Gemini API Key',
    regex: /\bAIza[0-9A-Za-z\\-_]{35}\b/,
  },
  {
    id: 'AWS_ACCESS_KEY',
    name: 'AWS Access Key ID',
    regex: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    id: 'PRIVATE_KEY_BLOCK',
    name: 'Private Key PEM Header',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |)PRIVATE KEY-----/,
  },
  {
    id: 'SLACK_TOKEN',
    name: 'Slack Bot or User Token',
    regex: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/,
  },
  {
    id: 'GENERIC_SECRET_ASSIGNMENT',
    name: 'High-Entropy Secret Assignment',
    regex: /(?:api_key|apikey|secret_key|client_secret|auth_token)\s*[:=]\s*['"][a-zA-Z0-9_\-.~!@#$%^&*]{20,}['"]/i,
  },
];

// ── 3. Unsafe / Debug Patterns ──
const UNSAFE_CONFIG_RULES = [
  {
    id: 'DEBUGGER_STATEMENT',
    name: 'Uncommitted JavaScript debugger statement',
    regex: /\bdebugger;\b/,
    fileFilter: /\.(?:js|mjs|jsx|ts|tsx)$/,
    excludeTestFiles: true,
  },
  {
    id: 'DISABLED_TLS',
    name: 'Disabled TLS/SSL Certificate Verification',
    regex: /(?:NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?|rejectUnauthorized:\s*false)/,
    fileFilter: /\.(?:js|mjs|jsx|ts|tsx|json)$/,
  },
];

// ── Allowed / Safe Exceptions ──
const EXEMPT_FILE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot',
  '.zip', '.gz', '.tar', '.pdf',
]);

function isExemptFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (EXEMPT_FILE_EXTENSIONS.has(ext)) return true;
  
  // Allow documentation examples and test mocks to reference dummy tokens
  if (filePath.endsWith('.md')) return true;
  if (filePath.endsWith('.example') || filePath.endsWith('.template')) return true;
  if (filePath.includes('backend/tests/') || filePath.includes('__tests__/')) return true;
  if (filePath.includes('backend/data/fixtures/')) return true;
  if (filePath === 'scripts/security-check.mjs') return true; // Scanner itself defines regexes
  return false;
}

function runGit(args, options = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
}

function redactSnippet(line, rule) {
  if (!line) return '';
  const redacted = rule?.regex ? line.replace(rule.regex, '[REDACTED_SECRET]') : line;
  return redacted.replace(/(["'=:\s])[^"'=\s]{20,}/g, '$1[REDACTED_VALUE]').substring(0, 100);
}

function getFilesToScan() {
  try {
    if (isStagedOnly) {
      const output = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACM']).trim();
      return output ? output.split('\n').filter(Boolean) : [];
    } else if (isAllTracked) {
      const output = runGit(['ls-files']).trim();
      return output ? output.split('\n').filter(Boolean) : [];
    } else {
      // Default: inspect staged files if any exist, otherwise inspect uncommitted files
      const staged = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACM']).trim();
      if (staged) return staged.split('\n').filter(Boolean);
      const modified = runGit(['diff', '--name-only', '--diff-filter=ACM']).trim();
      return modified ? modified.split('\n').filter(Boolean) : [];
    }
  } catch (err) {
    console.error('Error executing git command:', err.message);
    return [];
  }
}

function getFileContent(filePath) {
  try {
    if (isStagedOnly) {
      // Read staged blob from git index
      return runGit(['show', `:${filePath}`]);
    }
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

export function runSecurityScan() {
  const files = getFilesToScan();
  const violations = [];

  console.log('');
  console.log('  ╔════════════════════════════════════════════════════════════╗');
  console.log('  ║   🛡  CODE ARCHAEOLOGIST — Git Security & Secret Gate       ║');
  console.log('  ╚════════════════════════════════════════════════════════════╝');
  console.log(`  Scanning ${files.length} file(s) [Mode: ${isStagedOnly ? 'STAGED' : (isAllTracked ? 'ALL' : 'WORKING TREE')}]...\n`);

  for (const file of files) {
    // 1. Check for blocked sensitive file names
    for (const pattern of BLOCKED_FILE_PATTERNS) {
      if (pattern.test(file)) {
        violations.push({
          type: 'BLOCKED_FILE',
          file,
          line: 0,
          rule: 'SENSITIVE_FILE_NAME',
          description: `Attempted to commit forbidden sensitive file: "${file}"`,
          remediation: `Remove "${file}" from staging (\`git reset HEAD ${file}\`) and ensure it is listed in .gitignore.`
        });
      }
    }

    if (isExemptFile(file)) continue;

    // 2. Scan file content
    const content = getFileContent(file);
    if (!content) continue;

    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNum = lineIndex + 1;

      // Allow inline suppression: // code-archaeologist:ignore-secret
      if (line.includes('code-archaeologist:ignore-secret')) continue;

      // Check Secret Patterns
      for (const rule of SECRET_RULES) {
        if (rule.regex.test(line)) {
          // Ignore obvious dummy/template strings
          if (line.includes('your-token') || line.includes('dapixxxxx') || line.includes('placeholder')) {
            continue;
          }
          violations.push({
            type: 'HARDCODED_SECRET',
            file,
            line: lineNum,
            rule: rule.id,
            description: rule.name,
            snippet: redactSnippet(line.trim(), rule),
            remediation: 'Replace hardcoded credential with process.env variable. If this is a false alarm, add "// code-archaeologist:ignore-secret" on this line.'
          });
        }
      }

      // Check Unsafe / Debug Patterns
      for (const rule of UNSAFE_CONFIG_RULES) {
        if (rule.fileFilter && !rule.fileFilter.test(file)) continue;
        if (rule.excludeTestFiles && (file.includes('test') || file.includes('spec'))) continue;

        if (rule.regex.test(line)) {
          violations.push({
            type: 'UNSAFE_CONFIG',
            file,
            line: lineNum,
            rule: rule.id,
            description: rule.name,
            snippet: redactSnippet(line.trim(), rule),
            remediation: 'Remove debug / unsafe flag before committing to production repository.'
          });
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error(`  ❌ SECURITY GATE BLOCKED: Found ${violations.length} violation(s):\n`);
    violations.forEach((v, i) => {
      console.error(`  [${i + 1}] [${v.type}] ${v.file}:${v.line}`);
      console.error(`      Rule:        ${v.rule} (${v.description})`);
      if (v.snippet) console.error(`      Snippet:     ${v.snippet}`);
      console.error(`      Action:      ${v.remediation}`);
      console.error('');
    });
    console.error('  ⛔ Commit/Push rejected. Correct the issues above and try again.\n');
    return false;
  }

  console.log('  ✓ Security Gate Passed: No sensitive files or hardcoded credentials detected.\n');
  return true;
}

// Direct execution CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runSecurityScan();
  process.exit(success ? 0 : 1);
}
