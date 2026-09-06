import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import path from 'path';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.publicMessage = message;
  }
}

export function envFlag(name, defaultValue = false, env = process.env) {
  const value = env[name];
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const SENSITIVE_TEXT_PATTERNS = [
  {
    regex: /((?:api[_-]?key|access[_-]?token|auth[_-]?token|bearer[_-]?token|refresh[_-]?token|id[_-]?token|secret|password|private[_-]?key|client[_-]?secret|databricks[_-]?token|openai[_-]?api[_-]?key|github[_-]?token|slack[_-]?token)["']?\s*[:=]\s*)(["']?)([^"',\s}]{6,})(\2)/gi,
    replacement: (match, prefix, quote) => `${prefix}${quote}[REDACTED_SECRET]${quote}`
  },
  {
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY]'
  },
  {
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    replacement: '[REDACTED_OPENAI_KEY]'
  },
  {
    regex: /\bdapi[a-f0-9]{32,}\b/gi,
    replacement: '[REDACTED_DATABRICKS_TOKEN]'
  },
  {
    regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
    replacement: '[REDACTED_GITHUB_TOKEN]'
  },
  {
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    replacement: '[REDACTED_SLACK_TOKEN]'
  },
  {
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    replacement: '[REDACTED_AWS_ACCESS_KEY]'
  },
  {
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    replacement: '[REDACTED_JWT]'
  },
  {
    regex: /(Bearer\s+)[A-Za-z0-9._~+/=-]{16,}/gi,
    replacement: (match, prefix) => `${prefix}[REDACTED_BEARER_TOKEN]`
  },
  {
    regex: /(https?:\/\/)([^/\s:@]+):([^/\s@]+)@/gi,
    replacement: (match, protocol) => `${protocol}[REDACTED_CREDENTIALS]@`
  },
  {
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: '[REDACTED_EMAIL]'
  }
];

const SENSITIVE_FIELD_NAME_REGEX = /(?:api[_-]?key|access[_-]?token|auth[_-]?token|bearer[_-]?token|refresh[_-]?token|id[_-]?token|secret|password|private[_-]?key|client[_-]?secret|databricks[_-]?token|openai[_-]?api[_-]?key|github[_-]?token|slack[_-]?token)/i;
const RAW_CHECKPOINT_FIELD_NAME_REGEX = /^(?:transcript|rawTranscript|raw_transcript|prompt|prompts|rawPrompt|raw_prompt|rawResponse|raw_response|explanation_raw|messages)$/i;

export function redactSensitiveTextWithStats(value) {
  let text = String(value ?? '');
  let redactions = 0;

  for (const { regex, replacement } of SENSITIVE_TEXT_PATTERNS) {
    text = text.replace(regex, (...args) => {
      redactions += 1;
      return typeof replacement === 'function' ? replacement(...args) : replacement;
    });
  }

  return { text, redactions };
}

export function redactSensitiveText(value) {
  return redactSensitiveTextWithStats(value).text;
}

export function redactSensitiveValue(value, key = '', seen = new WeakSet()) {
  if (value === undefined || value === null) return value;
  if (SENSITIVE_FIELD_NAME_REGEX.test(key)) return '[REDACTED_SECRET]';
  if (typeof value === 'string') return redactSensitiveText(value);
  if (Array.isArray(value)) return value.map(item => redactSensitiveValue(item, '', seen));
  if (typeof value === 'object') {
    if (seen.has(value)) return '[REDACTED_CIRCULAR]';
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redactSensitiveValue(entryValue, entryKey, seen)])
    );
  }
  return value;
}

export function stripRawCheckpointFields(value, key = '', seen = new WeakSet()) {
  if (RAW_CHECKPOINT_FIELD_NAME_REGEX.test(key)) return '[WITHHELD_BY_PRIVACY_BOUNDARY]';
  if (value === undefined || value === null) return value;
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '[REDACTED_CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => stripRawCheckpointFields(item, '', seen));
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [entryKey, stripRawCheckpointFields(entryValue, entryKey, seen)])
  );
}

export function sanitizeForClient(value, options = {}) {
  const stripped = stripRawCheckpointFields(value);
  const redacted = redactSensitiveValue(stripped);
  return redactRepoPaths(redacted, options.repoPaths || []);
}

export function sanitizeErrorMessage(error, fallback = 'Request failed') {
  const message = error?.publicMessage || error?.message || String(error || fallback);
  return redactSensitiveText(message).slice(0, 300) || fallback;
}

function splitConfiguredPaths(value) {
  return String(value || '')
    .split(/[,\n;]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function safeRealpath(candidate) {
  try {
    return fs.realpathSync(candidate);
  } catch {
    return null;
  }
}

function isWithinRoot(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

export function buildRepoAccessPolicy({ appRoot = process.cwd(), env = process.env } = {}) {
  const configuredDefault = env.CODE_ARCHAEOLOGIST_REPO_ROOT || appRoot;
  const defaultRepo = safeRealpath(path.resolve(configuredDefault)) || path.resolve(configuredDefault);
  const configuredAllowedRoots = splitConfiguredPaths(env.CODE_ARCHAEOLOGIST_ALLOWED_REPO_ROOTS);
  const rawRoots = configuredAllowedRoots.length > 0 ? configuredAllowedRoots : [defaultRepo];
  const allowedRoots = [...new Set(rawRoots.map(root => safeRealpath(path.resolve(root)) || path.resolve(root)))];
  return { defaultRepo, allowedRoots };
}

export function resolveAllowedRepoPath(candidate, policy) {
  const raw = candidate === undefined || candidate === null || candidate === ''
    ? policy.defaultRepo
    : String(candidate);

  if (raw.length > 1000 || /[\0\r\n]/.test(raw)) {
    throw new HttpError(400, 'Repository path is invalid');
  }

  const absolutePath = path.resolve(raw);
  const realPath = safeRealpath(absolutePath);
  if (!realPath) {
    throw new HttpError(400, 'Repository path does not exist or is inaccessible');
  }

  let stat;
  try {
    stat = fs.statSync(realPath);
  } catch {
    throw new HttpError(400, 'Repository path does not exist or is inaccessible');
  }

  if (!stat.isDirectory()) {
    throw new HttpError(400, 'Repository path must be a directory');
  }

  if (!policy.allowedRoots.some(root => isWithinRoot(realPath, root))) {
    throw new HttpError(403, 'Repository path is outside the configured allowed roots');
  }

  return realPath;
}

export function redactRepoPaths(value, repoPaths = []) {
  const paths = [...new Set(repoPaths.filter(Boolean).map(String))]
    .sort((a, b) => b.length - a.length);
  if (paths.length === 0) return value;

  if (typeof value === 'string') {
    return paths.reduce((text, repoPath) => text.split(repoPath).join('[REPO_ROOT]'), value);
  }
  if (Array.isArray(value)) return value.map(item => redactRepoPaths(item, paths));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redactRepoPaths(entryValue, paths)])
    );
  }
  return value;
}

export function requireSafeIdentifier(value, label, { maxLength = 160 } = {}) {
  const text = String(value || '').trim();
  if (!text) throw new HttpError(400, `${label} is required`);
  if (text.length > maxLength || !/^[A-Za-z0-9._:-]+$/.test(text)) {
    throw new HttpError(400, `${label} contains unsupported characters`);
  }
  return text;
}

export function requireSafeText(value, label, { maxLength = 1000 } = {}) {
  const text = String(value || '').trim();
  if (!text) throw new HttpError(400, `${label} is required`);
  if (text.length > maxLength || /[\0\r\n]/.test(text)) {
    throw new HttpError(400, `${label} is too long or invalid`);
  }
  return text;
}

export function parseBoundedInteger(value, label, { defaultValue, min = 0, max = 100 } = {}) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, `${label} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export function requirePlainObject(value, label = 'Request body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, `${label} must be a JSON object`);
  }
  return value;
}

export function isLoopbackAddress(address) {
  const raw = String(address || '').replace(/^::ffff:/, '');
  return raw === '::1' || raw === 'localhost' || raw.startsWith('127.');
}

export function requestToken(req) {
  const auth = req.get?.('authorization') || '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer || req.get?.('x-code-archaeologist-token') || '';
}

export function timingSafeEqualString(actual, expected) {
  if (!actual || !expected) return false;
  const actualHash = crypto.createHash('sha256').update(String(actual)).digest();
  const expectedHash = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(actualHash, expectedHash);
}

function isPrivateHostname(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const octets = host.split('.').map(Number);
    return octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168);
  }
  if (ipVersion === 6) {
    return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:');
  }
  return false;
}

function maskHostname(hostname) {
  const parts = String(hostname || '').split('.').filter(Boolean);
  if (parts.length === 0) return null;
  return `${parts[0]}...`;
}

export function normalizeDatabricksHost(rawHost, env = process.env) {
  const raw = String(rawHost || '').trim();
  if (!raw) return { ok: false, error: 'Databricks host is not configured' };
  if (raw.length > 300 || /[\0\s]/.test(raw)) {
    return { ok: false, error: 'Databricks host is invalid' };
  }

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: 'Databricks host is invalid' };
  }

  if (url.username || url.password) {
    return { ok: false, error: 'Databricks host must not include embedded credentials' };
  }

  if (!['https:', 'http:'].includes(url.protocol)) {
    return { ok: false, error: 'Databricks host must use HTTP or HTTPS' };
  }

  if (url.protocol !== 'https:' && !envFlag('DATABRICKS_ALLOW_INSECURE_HOST', false, env)) {
    return { ok: false, error: 'Databricks host must use HTTPS' };
  }

  if (isPrivateHostname(url.hostname) && !envFlag('DATABRICKS_ALLOW_PRIVATE_HOST', false, env)) {
    return { ok: false, error: 'Databricks host must not target localhost or private network addresses' };
  }

  return {
    ok: true,
    baseUrl: url.origin,
    hostname: url.hostname,
    safeHost: maskHostname(url.hostname)
  };
}
