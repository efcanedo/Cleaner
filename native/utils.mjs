import { access, copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

export const APP_SUPPORT = process.env.DOCUMENT_CLEANER_APP_SUPPORT || path.join(os.homedir(), 'Library', 'Application Support', 'Document Cleaner');
export const WORK_ROOT = path.join(APP_SUPPORT, 'jobs');
export const SETTINGS_FILE = path.join(APP_SUPPORT, 'settings.json');
export const DOWNLOADS = process.env.DOCUMENT_CLEANER_DOWNLOADS || path.join(os.homedir(), 'Downloads');

export async function ensureDir(directory) {
  await mkdir(directory, { recursive: true });
  return directory;
}

export function safeFilename(value, fallback = 'Untitled') {
  const cleaned = String(value || '').replace(/[\u0000-\u001f/:]/g, '-').replace(/\s+/g, ' ').replace(/[. ]+$/g, '').trim();
  return (cleaned || fallback).slice(0, 180);
}

export function basenameWithoutExtension(filename) {
  return path.basename(filename, path.extname(filename));
}

export function timestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}.${parts.minute}.${parts.second}`;
}

export async function uniqueDirectory(parent, baseName) {
  await ensureDir(parent);
  let candidate = path.join(parent, safeFilename(baseName));
  let suffix = 2;
  while (await exists(candidate)) {
    candidate = path.join(parent, `${safeFilename(baseName)} (${suffix})`);
    suffix += 1;
  }
  await mkdir(candidate);
  return candidate;
}

export async function exists(target) {
  try { await access(target, constants.F_OK); return true; } catch { return false; }
}

export async function writeTextAtomic(target, content) {
  await ensureDir(path.dirname(target));
  const temporary = `${target}.temporary-${process.pid}-${Date.now()}`;
  await writeFile(temporary, content, 'utf8');
  await rename(temporary, target);
}

export async function copyPreserving(source, destination) {
  await ensureDir(path.dirname(destination));
  if (await exists(destination)) throw new Error(`Refusing to overwrite ${path.basename(destination)}.`);
  await copyFile(source, destination, constants.COPYFILE_EXCL);
}

export async function readJSON(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}

export async function removeWorkDirectory(directory) {
  if (!directory.startsWith(`${WORK_ROOT}${path.sep}`)) return;
  await rm(directory, { recursive: true, force: true });
}

export function runCommand(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
    const stdout = [];
    const stderr = [];
    child.stdout?.on('data', (chunk) => stdout.push(chunk));
    child.stderr?.on('data', (chunk) => stderr.push(chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      const output = Buffer.concat(stdout).toString('utf8');
      const errors = Buffer.concat(stderr).toString('utf8');
      if (code === 0) resolve({ stdout: output, stderr: errors });
      else reject(new Error(errors.trim() || `${path.basename(executable)} exited with status ${code}.`));
    });
  });
}

export async function fileSize(target) {
  return (await stat(target)).size;
}
