import { readFile, stat } from 'node:fs/promises';
import { openAsBlob } from 'node:fs';
import path from 'node:path';

const API_URL = 'https://api.openai.com/v1/responses';

const MIME = {
  '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.md': 'text/markdown', '.txt': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.tif': 'image/tiff', '.tiff': 'image/tiff', '.heic': 'image/heic',
};

export function mimeFor(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

async function uploadFile(filePath, apiKey, mime) {
  const form = new FormData();
  form.set('purpose', 'user_data');
  form.set('file', await openAsBlob(filePath, { type: mime }), path.basename(filePath));
  const response = await fetch('https://api.openai.com/v1/files', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI file upload failed (${response.status}).`);
  return payload.id;
}

async function deleteUploadedFile(fileId, apiKey) {
  try { await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(fileId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${apiKey}` } }); } catch { /* Best-effort cleanup. */ }
}

export async function sourcePart(filePath, apiKey) {
  const mime = mimeFor(filePath);
  const file = await stat(filePath);
  if (file.size > 12 * 1024 * 1024) {
    const fileId = await uploadFile(filePath, apiKey, mime);
    const part = mime.startsWith('image/')
      ? { type: 'input_image', file_id: fileId, detail: 'original' }
      : { type: 'input_file', file_id: fileId, detail: 'auto' };
    return { part, fileId };
  }
  const bytes = await readFile(filePath);
  const data = bytes.toString('base64');
  if (mime.startsWith('image/')) {
    return { part: { type: 'input_image', image_url: `data:${mime};base64,${data}`, detail: 'original' } };
  }
  if (mime === 'text/plain' || mime === 'text/markdown') {
    return { part: { type: 'input_text', text: `SOURCE FILE: ${path.basename(filePath)}\n\n${bytes.toString('utf8')}` } };
  }
  return { part: { type: 'input_file', filename: path.basename(filePath), file_data: `data:${mime};base64,${data}`, detail: 'auto' } };
}

function extractOutputText(payload) {
  const pieces = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') pieces.push(content.text);
    }
  }
  return pieces.join('\n').trim();
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createResponse({ apiKey, model, reasoningEffort, prompt, sources = [], schema, schemaName = 'result', maxOutputTokens = 120000, signal }) {
  const content = [{ type: 'input_text', text: prompt }];
  const uploadedFileIds = [];
  let lastError;
  try {
    for (const source of sources) {
      const prepared = await sourcePart(source, apiKey);
      content.push(prepared.part);
      if (prepared.fileId) uploadedFileIds.push(prepared.fileId);
    }
    const body = {
      model,
      store: false,
      reasoning: { effort: reasoningEffort },
      max_output_tokens: maxOutputTokens,
      input: [{ role: 'user', content }],
      text: schema ? { format: { type: 'json_schema', name: schemaName, strict: true, schema } } : { format: { type: 'text' } },
    };
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = payload?.error?.message || `OpenAI request failed (${response.status}).`;
          if ((response.status === 429 || response.status >= 500) && attempt < 3) {
            lastError = new Error(message);
            await delay(1000 * (2 ** attempt));
            continue;
          }
          throw new Error(message);
        }
        if (payload.status === 'incomplete') throw new Error(`OpenAI response was incomplete: ${payload.incomplete_details?.reason || 'unknown reason'}.`);
        const text = extractOutputText(payload);
        if (!text) throw new Error('OpenAI returned no text output.');
        if (!schema) return { text, responseId: payload.id, usage: payload.usage };
        try {
          return { json: JSON.parse(text), responseId: payload.id, usage: payload.usage };
        } catch {
          throw new Error('OpenAI returned a structured response that could not be decoded.');
        }
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error('The job was cancelled.');
        lastError = error;
        if (attempt < 3 && error instanceof TypeError) {
          await delay(1000 * (2 ** attempt));
          continue;
        }
        throw error;
      }
    }
    throw lastError || new Error('OpenAI request failed.');
  } finally {
    await Promise.all(uploadedFileIds.map((fileId) => deleteUploadedFile(fileId, apiKey)));
  }
}

export async function testOpenAIKey(apiKey, model) {
  const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI connection failed (${response.status}).`);
  return payload.id;
}
