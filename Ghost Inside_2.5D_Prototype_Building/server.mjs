import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBackupResponse,
  eligibleEvidenceForInquiry,
  providerContext,
  validateAIResponse,
  validateRequest,
} from './src/ai-contract.js';

const APP_ROOT = path.dirname(fileURLToPath(import.meta.url));
const MAX_BODY_BYTES = 16 * 1024;
const PROVIDER_TIMEOUT_MS = 8_000;

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
});

const STATIC_DENY = new Set([
  'package.json',
  'package-lock.json',
  'server.mjs',
]);

function sendJson(response, statusCode, body) {
  const data = Buffer.from(JSON.stringify(body));
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(data);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('请求内容过大。'), { statusCode: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('请求必须是有效 JSON。'), { statusCode: 400 }));
      }
    });
    request.on('error', reject);
  });
}

function providerConfig(environment) {
  const url = typeof environment.GHOST_AI_URL === 'string' ? environment.GHOST_AI_URL.trim() : '';
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return {
      url: parsed.href,
      token: typeof environment.GHOST_AI_TOKEN === 'string' ? environment.GHOST_AI_TOKEN.trim() : '',
    };
  } catch {
    return null;
  }
}

function providerTimeoutMs(environment) {
  const value = Number(environment?.GHOST_AI_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : PROVIDER_TIMEOUT_MS;
}

async function callProvider(config, request, fetchImpl, timeoutMs = PROVIDER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (config.token) headers.Authorization = `Bearer ${config.token}`;
    const response = await fetchImpl(config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(providerContext(request)),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    const raw = await response.json();
    return raw?.result && typeof raw.result === 'object' ? raw.result : raw;
  } finally {
    clearTimeout(timer);
  }
}

async function respondToAI(payload, { environment, fetchImpl }) {
  const checked = validateRequest(payload);
  if (!checked.ok) return { statusCode: 400, body: { error: 'invalid_request', errors: checked.errors } };

  const request = checked.value;
  const config = providerConfig(environment);
  if (!config) return { statusCode: 200, body: buildBackupResponse(request, 'not_configured') };

  try {
    const raw = await callProvider(config, request, fetchImpl, providerTimeoutMs(environment));
    const eligibleUnlockEvidenceIds = request.mode === 'inquire' ? eligibleEvidenceForInquiry(request) : [];
    const validation = validateAIResponse(raw, {
      mode: request.mode,
      action: request.action,
      unlockedEvidenceIds: request.unlockedEvidence,
      eligibleUnlockEvidenceIds,
    });
    if (!validation.ok) {
      return {
        statusCode: 200,
        body: {
          ...buildBackupResponse(request, 'invalid_provider_response'),
          providerErrors: validation.errors,
        },
      };
    }
    return {
      statusCode: 200,
      body: {
        source: 'live',
        modeLabel: '实时 AI',
        mode: request.mode,
        ...validation.value,
      },
    };
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'timeout' : 'provider_error';
    return { statusCode: 200, body: buildBackupResponse(request, reason) };
  }
}

function safeStaticPath(rawPathname) {
  let pathname;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0')) return null;
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const normalized = path.normalize(relative);
  if (path.isAbsolute(normalized) || normalized.startsWith(`..${path.sep}`) || normalized === '..') return null;
  if (normalized.split(path.sep).some((part) => part.startsWith('.'))) return null;
  if (STATIC_DENY.has(normalized.toLowerCase()) || normalized.toLowerCase().endsWith('.md')) return null;
  const filePath = path.resolve(APP_ROOT, normalized);
  const relativeToRoot = path.relative(APP_ROOT, filePath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) return null;
  return filePath;
}

async function serveStatic(request, response, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'method_not_allowed' });
    return;
  }
  const filePath = safeStaticPath(pathname);
  if (!filePath) {
    sendJson(response, 404, { error: 'not_found' });
    return;
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not_file');
    const data = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; media-src 'self'",
    });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch {
    sendJson(response, 404, { error: 'not_found' });
  }
}

export function createAppServer(options = {}) {
  const environment = options.env ?? process.env;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('This server requires Node.js 20 or newer.');

  const server = http.createServer(async (request, response) => {
    // 浏览器中途取消连接时，未监听的 'error' 事件会直接击穿进程；本地预览服务必须吞掉它。
    request.on('error', () => {});
    response.on('error', () => {});
    let url;
    try {
      url = new URL(request.url ?? '/', 'http://localhost');
    } catch {
      sendJson(response, 400, { error: 'bad_url' });
      return;
    }

    if (url.pathname === '/api/status') {
      if (request.method !== 'GET') {
        sendJson(response, 405, { error: 'method_not_allowed' });
        return;
      }
      const configured = Boolean(providerConfig(environment));
      sendJson(response, 200, {
        providerConfigured: configured,
        mode: configured ? 'live_available' : 'backup',
        modeLabel: configured ? '实时 AI 可用' : '备用互动',
        timeoutMs: PROVIDER_TIMEOUT_MS,
      });
      return;
    }

    if (url.pathname === '/api/respond') {
      if (request.method !== 'POST') {
        sendJson(response, 405, { error: 'method_not_allowed' });
        return;
      }
      try {
        const payload = await readJsonBody(request);
        const result = await respondToAI(payload, { environment, fetchImpl });
        sendJson(response, result.statusCode, result.body);
      } catch (error) {
        if (!response.headersSent) sendJson(response, error.statusCode ?? 400, { error: 'invalid_request', message: error.message });
      }
      return;
    }

    await serveStatic(request, response, url.pathname);
  });
  server.on('clientError', (error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    else socket.destroy();
  });
  return server;
}

export function startServer(options = {}) {
  const server = createAppServer(options);
  const port = Number(options.port ?? process.env.PORT ?? 4173);
  const host = options.host ?? process.env.HOST ?? '127.0.0.1';
  server.listen(port, host, () => {
    const address = server.address();
    const activePort = typeof address === 'object' && address ? address.port : port;
    const configured = Boolean(providerConfig(options.env ?? process.env));
    console.log(`Ghost Inside: http://${host}:${activePort} (${configured ? '实时 AI 可用' : '备用互动'})`);
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}
