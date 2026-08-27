import http from 'node:http';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import Busboy from 'busboy';
import { processJob } from './pipeline.mjs';
import { testOpenAIKey } from './openai.mjs';
import {
  SETTINGS_FILE, WORK_ROOT, ensureDir, exists, readJSON, removeWorkDirectory, runCommand, safeFilename, writeTextAtomic,
} from './utils.mjs';

const VERSION = '1.0';
const PORT = Number(process.env.DOCUMENT_CLEANER_PORT || 41842);
const HOST = '127.0.0.1';
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const packagedDist = path.join(moduleDirectory, 'dist');
const sourceDist = path.resolve(moduleDirectory, '..', 'dist');
const distDirectory = await exists(packagedDist) ? packagedDist : sourceDist;
const packagedToolkit = path.resolve(moduleDirectory, '..', 'bin', 'DocumentToolkit');
const sourceToolkit = path.join(moduleDirectory, 'DocumentToolkit');
const toolkit = process.env.DOCUMENT_CLEANER_TOOLKIT || (await exists(packagedToolkit) ? packagedToolkit : sourceToolkit);
const jobs = new Map();
const allowedPaths = new Set(['news_articles', 'documents', 'hearing_transcripts', 'beacon_article', 'beacon_issue', 'beacon_volume']);
const allowedModels = new Set(['gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6-luna']);
const allowedEfforts = new Set(['medium', 'high', 'xhigh']);
const keychainService = 'com.ecanedo.documentcleaner';
const keychainAccount = 'openai-api-key';

await ensureDir(WORK_ROOT);

function corsHeaders(origin) {
  const allowed = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '') ? origin : `http://${HOST}:${PORT}`;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}

function isAllowedOrigin(origin) {
  return !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function json(response, status, payload, origin) {
  response.writeHead(status, { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function bodyJSON(request, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function settings() {
  const saved = await readJSON(SETTINGS_FILE, {});
  return {
    model: allowedModels.has(saved.model) ? saved.model : 'gpt-5.6-terra',
    reasoningEffort: allowedEfforts.has(saved.reasoningEffort) ? saved.reasoningEffort : 'high',
  };
}

async function keychainRead() {
  try {
    const result = await runCommand('/usr/bin/security', ['find-generic-password', '-s', keychainService, '-a', keychainAccount, '-w']);
    return result.stdout.trim();
  } catch {
    return '';
  }
}

async function keychainWrite(apiKey) {
  await runCommand('/usr/bin/security', ['add-generic-password', '-U', '-s', keychainService, '-a', keychainAccount, '-w', apiKey]);
}

async function settingsResponse() {
  const current = await settings();
  return { ...current, hasKey: Boolean(await keychainRead()), toolkitAvailable: await exists(toolkit), version: VERSION };
}

function publicJob(job) {
  return {
    id: job.id, path: job.path, status: job.status, stage: job.stage, progress: job.progress,
    totalFiles: job.totalFiles, completedFiles: job.completedFiles, createdAt: job.createdAt,
    ...(job.destination ? { destination: job.destination } : {}), results: job.results,
    ...(job.error ? { error: job.error } : {}),
  };
}

function notify() {
  // Jobs are held in memory; polling clients read the latest object.
}

function parseUpload(request, workDirectory) {
  return new Promise((resolve, reject) => {
    const parser = Busboy({ headers: request.headers, limits: { files: 500, fileSize: 750 * 1024 * 1024, fields: 20 } });
    const files = [];
    const fields = {};
    const writes = [];
    parser.on('field', (name, value) => { fields[name] = value; });
    parser.on('file', (name, stream, info) => {
      if (name !== 'files') { stream.resume(); return; }
      const originalName = safeFilename(path.basename(info.filename), 'source');
      const storedName = `${String(files.length + 1).padStart(3, '0')}-${crypto.randomUUID()}-${originalName}`;
      const destination = path.join(workDirectory, storedName);
      const output = createWriteStream(destination, { flags: 'wx', mode: 0o600 });
      let truncated = false;
      stream.on('limit', () => { truncated = true; });
      stream.pipe(output);
      const complete = new Promise((finish, fail) => {
        output.once('finish', () => truncated ? fail(new Error(`${originalName} exceeds the 750 MB file limit.`)) : finish());
        output.once('error', fail);
        stream.once('error', fail);
      });
      writes.push(complete);
      files.push({ path: destination, originalName, mimeType: info.mimeType });
    });
    parser.once('error', reject);
    parser.once('close', async () => {
      try { await Promise.all(writes); resolve({ fields, files }); } catch (error) { reject(error); }
    });
    request.pipe(parser);
  });
}

async function serveStatic(request, response, pathname) {
  let relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  relative = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, '');
  let target = path.join(distDirectory, relative);
  if (!(await exists(target)) || (await stat(target)).isDirectory()) target = path.join(distDirectory, 'index.html');
  const extension = path.extname(target).toLowerCase();
  const contentType = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8',
  }[extension] || 'application/octet-stream';
  response.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'Content-Security-Policy': "default-src 'self'; connect-src 'self' http://127.0.0.1:41842; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  });
  createReadStream(target).pipe(response);
}

async function startJob(request, response, origin) {
  const id = crypto.randomUUID();
  const workDirectory = path.join(WORK_ROOT, id);
  await mkdir(workDirectory, { recursive: false, mode: 0o700 });
  try {
    const upload = await parseUpload(request, workDirectory);
    if (!allowedPaths.has(upload.fields.path)) throw new Error('Select a valid cleaning path.');
    if (!upload.files.length) throw new Error('Add at least one source file.');
    const apiKey = await keychainRead();
    if (!apiKey) throw new Error('Add an OpenAI API key in Settings before cleaning.');
    const currentSettings = await settings();
    const job = {
      id, path: upload.fields.path, status: 'queued', stage: 'Queued', progress: 0,
      totalFiles: upload.files.length, completedFiles: 0, createdAt: new Date().toISOString(), results: [],
      cancelRequested: false, abortController: new AbortController(),
    };
    jobs.set(id, job);
    json(response, 202, publicJob(job), origin);
    void processJob({
      job, files: upload.files,
      config: { apiKey, model: currentSettings.model, reasoningEffort: currentSettings.reasoningEffort },
      toolkit, notify,
    }).catch((error) => {
      if (job.cancelRequested) Object.assign(job, { status: 'cancelled', stage: 'Cancelled', error: undefined });
      else Object.assign(job, { status: 'failed', stage: 'Job failed', error: error.message });
    }).finally(async () => {
      await removeWorkDirectory(workDirectory);
    });
  } catch (error) {
    await removeWorkDirectory(workDirectory);
    json(response, 400, { error: error.message }, origin);
  }
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin || '';
  if (!isAllowedOrigin(origin)) { json(response, 403, { error: 'Cross-origin requests are not allowed.' }, origin); return; }
  if (request.method === 'OPTIONS') { response.writeHead(204, corsHeaders(origin)); response.end(); return; }
  const url = new URL(request.url || '/', `http://${HOST}:${PORT}`);
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      json(response, 200, { ok: true, version: VERSION, toolkitAvailable: await exists(toolkit) }, origin);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/settings') {
      json(response, 200, await settingsResponse(), origin);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/settings') {
      const body = await bodyJSON(request);
      const current = await settings();
      const next = {
        model: allowedModels.has(body.model) ? body.model : current.model,
        reasoningEffort: allowedEfforts.has(body.reasoningEffort) ? body.reasoningEffort : current.reasoningEffort,
      };
      if (body.apiKey) {
        if (typeof body.apiKey !== 'string' || !body.apiKey.startsWith('sk-') || body.apiKey.length < 20) throw new Error('Enter a valid OpenAI API key.');
        await keychainWrite(body.apiKey.trim());
      }
      await ensureDir(path.dirname(SETTINGS_FILE));
      await writeTextAtomic(SETTINGS_FILE, `${JSON.stringify(next, null, 2)}\n`);
      json(response, 200, { ...(await settingsResponse()), message: 'Settings saved securely.' }, origin);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/settings/test') {
      const apiKey = await keychainRead();
      if (!apiKey) throw new Error('No API key is stored.');
      const current = await settings();
      const model = await testOpenAIKey(apiKey, current.model);
      json(response, 200, { ok: true, message: `Connection successful. ${model} is available.` }, origin);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/jobs') {
      await startJob(request, response, origin);
      return;
    }
    const jobMatch = url.pathname.match(/^\/api\/jobs\/([0-9a-f-]+)$/i);
    if (request.method === 'GET' && jobMatch) {
      const job = jobs.get(jobMatch[1]);
      if (!job) { json(response, 404, { error: 'Job not found.' }, origin); return; }
      json(response, 200, publicJob(job), origin);
      return;
    }
    const cancelMatch = url.pathname.match(/^\/api\/jobs\/([0-9a-f-]+)\/cancel$/i);
    if (request.method === 'POST' && cancelMatch) {
      const job = jobs.get(cancelMatch[1]);
      if (!job) { json(response, 404, { error: 'Job not found.' }, origin); return; }
      if (!['completed', 'failed', 'cancelled'].includes(job.status)) {
        job.cancelRequested = true;
        job.abortController.abort();
        job.stage = 'Cancelling…';
      }
      json(response, 200, publicJob(job), origin);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/reveal') {
      const body = await bodyJSON(request);
      if (typeof body.path !== 'string' || !path.isAbsolute(body.path) || !(await exists(body.path))) throw new Error('The output path no longer exists.');
      await runCommand('/usr/bin/open', ['-R', body.path]);
      json(response, 200, { ok: true }, origin);
      return;
    }
    if (request.method === 'GET' && !url.pathname.startsWith('/api/')) {
      await serveStatic(request, response, url.pathname);
      return;
    }
    json(response, 404, { error: 'Not found.' }, origin);
  } catch (error) {
    json(response, 400, { error: error.message || 'Request failed.' }, origin);
  }
});

server.on('clientError', (_, socket) => socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'));
server.listen(PORT, HOST, () => process.stdout.write(`Document Cleaner ${VERSION} ready at http://${HOST}:${PORT}\n`));

function shutdown() {
  for (const job of jobs.values()) job.abortController?.abort();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
