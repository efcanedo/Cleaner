import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import mammoth from 'mammoth';
import { PDFDocument } from 'pdf-lib';
import { createResponse } from './openai.mjs';
import {
  adaptiveCleaningPrompt, adaptiveCleaningSchema, auditPrompt, auditSchema, cleaningPrompt, issueAuditPrompt, issuePrompt, issueSchema,
  volumeManifestPrompt, volumeManifestSchema,
} from './prompts.mjs';
import { usageCost } from './pricing.mjs';
import {
  DOWNLOADS, basenameWithoutExtension, copyPreserving, ensureDir, exists, fileSize, runCommand,
  safeFilename, timestamp, uniqueDirectory, writeTextAtomic,
} from './utils.mjs';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.heic']);
const SIMPLE_PATHS = new Set(['news_articles', 'documents', 'hearing_transcripts']);

function stripFence(text) {
  const trimmed = String(text || '').trim();
  const match = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  return match ? match[1].trim() : trimmed;
}

function assertNotCancelled(job) {
  if (job.cancelRequested) throw new Error('The job was cancelled.');
}

function update(job, notify, values) {
  Object.assign(job, values);
  notify(job);
}

async function pricedResponse(job, notify, options) {
  const response = await createResponse(options);
  const cost = usageCost(options.model, response.usage);
  update(job, notify, { actualCostUSD: Number(job.actualCostUSD || 0) + cost });
  return response;
}

function resultFor(sourceName, status, outputs, uncertainty = '', error = '') {
  return { sourceName, status, outputs, ...(uncertainty ? { uncertainty } : {}), ...(error ? { error } : {}) };
}

function shouldRunAdaptiveAudit(review) {
  return review.requires_second_audit
    || review.status !== 'Cleaned and verified'
    || Boolean(review.uncertainty_summary?.trim());
}

function adaptiveOutputLimit(cleaningPath, sourceBytes) {
  const settings = {
    news_articles: { minimum: 12_000, maximum: 48_000, divisor: 3, reserve: 3_000 },
    documents: { minimum: 16_000, maximum: 96_000, divisor: 2, reserve: 8_000 },
    hearing_transcripts: { minimum: 16_000, maximum: 120_000, divisor: 3, reserve: 8_000 },
  }[cleaningPath];
  if (!settings) return 120_000;
  return Math.max(settings.minimum, Math.min(settings.maximum, Math.ceil(sourceBytes / settings.divisor) + settings.reserve));
}

async function pdfPageCount(filePath) {
  const bytes = await readFile(filePath);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  return pdf.getPageCount();
}

async function splitPDF(source, destination, startPage, endPage) {
  const bytes = await readFile(source);
  const input = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const output = await PDFDocument.create();
  const indexes = [];
  for (let page = startPage; page <= endPage; page += 1) indexes.push(page - 1);
  const copied = await output.copyPages(input, indexes);
  copied.forEach((page) => output.addPage(page));
  await writeFile(destination, await output.save({ useObjectStreams: true }));
}

async function createPDFfromImages(toolkit, images, destination) {
  if (!toolkit || !(await exists(toolkit))) throw new Error('The bundled document toolkit is unavailable.');
  await runCommand(toolkit, ['imagepdf', destination, ...images]);
}

async function improvePDF(toolkit, source, destination) {
  if (!toolkit || !(await exists(toolkit))) throw new Error('The bundled document toolkit is unavailable.');
  const { stdout } = await runCommand(toolkit, ['ocr', source, destination]);
  return JSON.parse(stdout || '{}');
}

async function renderPages(toolkit, source, destination) {
  if (!toolkit || !(await exists(toolkit))) return { rendered: 0, note: 'Page rendering toolkit unavailable.' };
  await ensureDir(destination);
  const { stdout } = await runCommand(toolkit, ['render', source, destination]);
  return JSON.parse(stdout || '{}');
}

async function extractDocxText(source) {
  try {
    const result = await mammoth.extractRawText({ path: source });
    return result.value.trim();
  } catch {
    return '';
  }
}

async function prepareDocumentAssets(toolkit, source, outputDirectory) {
  const extension = path.extname(source).toLowerCase();
  const base = safeFilename(basenameWithoutExtension(source));
  if (extension !== '.pdf') {
    const text = extension === '.docx' ? await extractDocxText(source) : '';
    return { sources: [source], assetNote: text ? `A deterministic DOCX text extraction is supplied below as a cross-check; the attached source remains authoritative.\n\nDOCX TEXT CROSS-CHECK\n${text.slice(0, 120000)}` : '', assetPaths: [] };
  }
  const assetDirectory = path.join(outputDirectory, 'assets', base);
  try {
    const rendered = await renderPages(toolkit, source, assetDirectory);
    const relativePrefix = `assets/${base}/source-page-`;
    return {
      sources: [source],
      assetNote: `Rendered source pages are preserved alongside the Markdown as ${relativePrefix}N.png (${rendered.rendered || 0} pages). Embed only pages containing significant visuals, using those exact relative paths.`,
      assetPaths: Array.from({ length: rendered.rendered || 0 }, (_, index) => path.join(assetDirectory, `source-page-${index + 1}.png`)),
    };
  } catch (error) {
    return { sources: [source], assetNote: `Page rendering was unavailable: ${error.message}. Inspect the attached PDF directly.`, assetPaths: [] };
  }
}

function outputFolderName(cleaningPath) {
  const prefix = {
    news_articles: 'Cleaned Articles', documents: 'Cleaned Documents', hearing_transcripts: 'Cleaned Hearing Transcripts',
  }[cleaningPath];
  return `${prefix} - ${timestamp()}`;
}

function markdownFilename(cleaningPath, sourceName, markdown) {
  const originalBase = safeFilename(basenameWithoutExtension(sourceName));
  if (cleaningPath === 'hearing_transcripts') {
    const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
    if (heading && /^\d{4}[.-]\d{2}[.-]\d{2}\b/.test(heading)) return `${safeFilename(heading)} [cleaned].md`;
  }
  return `${originalBase} [cleaned].md`;
}

async function cleanAndAudit({ job, notify, source, sourceName, cleaningPath, outputDirectory, config, toolkit }) {
  assertNotCancelled(job);
  const prepared = cleaningPath === 'documents'
    ? await prepareDocumentAssets(toolkit, source, outputDirectory)
    : { sources: [source], assetNote: '', assetPaths: [] };
  const sourceBytes = await fileSize(source);
  const maxOutputTokens = adaptiveOutputLimit(cleaningPath, sourceBytes);
  update(job, notify, { stage: `Cleaning and checking ${sourceName}`, status: 'processing' });
  const first = await pricedResponse(job, notify, {
    ...config,
    reasoningEffort: 'medium',
    maxOutputTokens,
    prompt: adaptiveCleaningPrompt(cleaningPath, sourceName, prepared.assetNote),
    sources: prepared.sources,
    schema: adaptiveCleaningSchema,
    schemaName: `clean_${cleaningPath}`,
    signal: job.abortController.signal,
  });
  let review = first.json;
  const firstRiskReason = review.risk_reason;
  const requiresAudit = shouldRunAdaptiveAudit(review);
  let auditNotes = review.audit_notes;
  if (requiresAudit) {
    assertNotCancelled(job);
    update(job, notify, { stage: `Risk-triggered audit of ${sourceName}`, status: 'auditing' });
    const audited = await pricedResponse(job, notify, {
      ...config,
      reasoningEffort: config.reasoningEffort === 'medium' ? 'high' : config.reasoningEffort,
      maxOutputTokens,
      prompt: auditPrompt(cleaningPath, sourceName, stripFence(review.final_markdown), prepared.assetNote),
      sources: prepared.sources,
      schema: auditSchema,
      schemaName: `${cleaningPath}_risk_audit`,
      signal: job.abortController.signal,
    });
    review = audited.json;
    auditNotes = `${auditNotes || ''}${auditNotes ? ' ' : ''}Second audit: ${audited.json.audit_notes || firstRiskReason || 'Triggered by first-pass risk.'}`;
  }
  const finalMarkdown = stripFence(review.final_markdown);
  const filename = markdownFilename(cleaningPath, sourceName, finalMarkdown);
  await writeTextAtomic(path.join(outputDirectory, filename), `${finalMarkdown.trim()}\n`);
  return {
    result: resultFor(sourceName, review.status, [filename, ...prepared.assetPaths.map((item) => path.relative(outputDirectory, item))], review.uncertainty_summary),
    auditNotes,
  };
}

async function processSimpleBatch({ job, notify, files, config, toolkit }) {
  const outputDirectory = await uniqueDirectory(DOWNLOADS, outputFolderName(job.path));
  update(job, notify, { destination: outputDirectory, stage: 'Preparing output folder', status: 'preparing' });
  const internalAudit = [];
  for (let index = 0; index < files.length; index += 1) {
    const source = files[index];
    assertNotCancelled(job);
    try {
      const processed = await cleanAndAudit({ job, notify, source: source.path, sourceName: source.originalName, cleaningPath: job.path, outputDirectory, config, toolkit });
      job.results.push(processed.result);
      internalAudit.push({ source: source.originalName, status: processed.result.status, notes: processed.auditNotes });
    } catch (error) {
      if (job.cancelRequested) throw error;
      job.results.push(resultFor(source.originalName, 'Unable to verify', [], '', error.message));
      internalAudit.push({ source: source.originalName, status: 'Unable to verify', error: error.message });
    }
    update(job, notify, { completedFiles: index + 1, progress: ((index + 1) / files.length) * 100 });
  }
  job.internalAudit = internalAudit;
  return outputDirectory;
}

function beaconAuditText(details) {
  const lines = [
    '# Processing audit', '',
    `- Source inspection: ${details.inspection || 'Completed'}`,
    `- Original source preserved: ${details.originalPreserved ? 'Yes' : 'No'}`,
    `- OCR or re-OCR: ${details.ocr || 'Completed'}`,
    `- Improved PDF: ${details.improvedPDF || 'Not created'}`,
    `- Markdown output: ${details.markdown || 'Not created'}`,
    `- Columns or continuations: ${details.structure || 'No special reconstruction reported'}`,
    `- Verification status: ${details.status || 'Unable to verify'}`,
    `- Unresolved uncertainty: ${details.uncertainty || 'None reported'}`,
  ];
  if (details.extra?.length) lines.push('', '## Additional accounting', '', ...details.extra.map((item) => `- ${item}`));
  return `${lines.join('\n')}\n`;
}

async function beaconSourcePDF({ toolkit, files, outputDirectory, baseName }) {
  const first = files[0];
  if (files.length === 1 && path.extname(first.path).toLowerCase() === '.pdf') {
    const sourcePDF = path.join(outputDirectory, first.originalName);
    await copyPreserving(first.path, sourcePDF);
    return { sourcePDF, preserved: [first.originalName], baseName: safeFilename(basenameWithoutExtension(first.originalName)) };
  }
  const preserved = [];
  for (const source of files) {
    const destination = path.join(outputDirectory, safeFilename(source.originalName));
    await copyPreserving(source.path, destination);
    preserved.push(path.basename(destination));
  }
  const sourcePDF = path.join(outputDirectory, `${safeFilename(baseName)}.pdf`);
  await createPDFfromImages(toolkit, files.map((item) => item.path), sourcePDF);
  return { sourcePDF, preserved: [...preserved, path.basename(sourcePDF)], baseName: safeFilename(baseName) };
}

async function processBeaconArticleItem({ job, notify, files, config, toolkit, batchParent }) {
  const first = files[0];
  const base = safeFilename(basenameWithoutExtension(first.originalName));
  const outputDirectory = await uniqueDirectory(batchParent || DOWNLOADS, base);
  if (!job.destination) update(job, notify, { destination: batchParent || outputDirectory });
  update(job, notify, { destination: batchParent || outputDirectory, stage: `Preserving ${first.originalName}`, status: 'preparing' });
  const source = await beaconSourcePDF({ toolkit, files, outputDirectory, baseName: base });
  const improvedName = `${source.baseName} [improved].pdf`;
  const improvedPath = path.join(outputDirectory, improvedName);
  let ocrReport;
  try {
    update(job, notify, { stage: `Re-OCRing ${first.originalName}` });
    ocrReport = await improvePDF(toolkit, source.sourcePDF, improvedPath);
  } catch (error) {
    await copyPreserving(source.sourcePDF, improvedPath);
    ocrReport = { warning: error.message, pages: 0 };
  }
  const cleanSource = improvedPath;
  const cleaned = await pricedResponse(job, notify, { ...config, prompt: cleaningPrompt('beacon_article', first.originalName), sources: [cleanSource], signal: job.abortController.signal });
  const audited = await pricedResponse(job, notify, { ...config, prompt: auditPrompt('beacon_article', first.originalName, stripFence(cleaned.text)), sources: [cleanSource], schema: auditSchema, schemaName: 'beacon_article_audit', signal: job.abortController.signal });
  const audit = audited.json;
  const markdownName = `${source.baseName}.md`;
  await writeTextAtomic(path.join(outputDirectory, markdownName), `${stripFence(audit.final_markdown).trim()}\n`);
  const uncertainty = [audit.uncertainty_summary, ocrReport.warning].filter(Boolean).join(' ');
  const status = uncertainty && audit.status === 'Cleaned and verified' ? 'Cleaned and verified with uncertainties' : audit.status;
  await writeTextAtomic(path.join(outputDirectory, 'audit.md'), beaconAuditText({
    originalPreserved: true, ocr: ocrReport.warning ? `Improved PDF copied but OCR warning: ${ocrReport.warning}` : `Completed for ${ocrReport.pages || 'all'} page(s)`,
    improvedPDF: improvedName, markdown: markdownName, status, uncertainty,
    structure: audit.audit_notes,
  }));
  return resultFor(first.originalName, status, [path.relative(batchParent || outputDirectory, path.join(outputDirectory, markdownName)), path.relative(batchParent || outputDirectory, improvedPath), path.relative(batchParent || outputDirectory, path.join(outputDirectory, 'audit.md'))], uncertainty);
}

async function processBeaconArticles({ job, notify, files, config, toolkit }) {
  const batchParent = files.length > 1 ? await uniqueDirectory(DOWNLOADS, `Batch - ${timestamp()}`) : null;
  if (batchParent) update(job, notify, { destination: batchParent });
  for (let index = 0; index < files.length; index += 1) {
    assertNotCancelled(job);
    const source = files[index];
    try {
      job.results.push(await processBeaconArticleItem({ job, notify, files: [source], config, toolkit, batchParent }));
    } catch (error) {
      if (job.cancelRequested) throw error;
      job.results.push(resultFor(source.originalName, 'Unable to verify', [], '', error.message));
    }
    update(job, notify, { completedFiles: index + 1, progress: ((index + 1) / files.length) * 100 });
  }
  return job.destination;
}

function normalizedDate(value) {
  const match = String(value || '').match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  return match ? `${match[1]}.${match[2].padStart(2, '0')}.${match[3].padStart(2, '0')}` : '';
}

async function writeIssueOutputs(outputDirectory, issue, context = {}) {
  const created = [];
  const usedNames = new Set();
  for (const article of issue.articles || []) {
    const date = normalizedDate(article.date || issue.publication_date) || 'Unknown Date';
    const base = safeFilename(`${date} ${article.title || 'Untitled Article'}`);
    let filename = `${base}.md`;
    let suffix = 2;
    while (usedNames.has(filename.toLowerCase()) || await exists(path.join(outputDirectory, filename))) {
      filename = `${base} (${suffix}).md`;
      suffix += 1;
    }
    usedNames.add(filename.toLowerCase());
    await writeTextAtomic(path.join(outputDirectory, filename), `${stripFence(article.markdown).trim()}\n`);
    created.push(filename);
  }
  const date = normalizedDate(issue.publication_date) || 'Unknown Date';
  const mastheadName = `${date} Masthead.md`;
  await writeTextAtomic(path.join(outputDirectory, mastheadName), `${stripFence(issue.masthead || '# Masthead\n\n[unclear]').trim()}\n`);
  created.push(mastheadName);

  const uncertainties = [...(issue.uncertainties || []), ...(issue.articles || []).map((item) => item.uncertainty).filter(Boolean)];
  const auditLines = [
    '# Issue audit', '',
    `- Publication date: ${issue.publication_date || 'Uncertain'}`,
    `- Volume number: ${issue.volume_number || 'Uncertain'}`,
    `- Issue number: ${issue.issue_number || 'Uncertain'}`,
    `- Source page count: ${issue.page_count || context.pageCount || 'Uncertain'}`,
    `- Original PDF preserved: ${context.originalName || 'Yes'}`,
    `- OCR/re-OCR status: ${context.ocrStatus || 'Completed'}`,
    `- Improved PDF: ${context.improvedName || 'Created'}`,
    `- Articles produced: ${(issue.articles || []).length}`,
    `- Masthead: ${mastheadName}`,
    '', '## Article files', '', ...(created.slice(0, -1).map((item) => `- ${item}`)),
    '', '## Continuations, difficult pages, and uncertainties', '',
    ...(uncertainties.length ? uncertainties.map((item) => `- ${item}`) : ['- None reported after the page-by-page audit.']),
    ...(context.notes?.length ? ['', '## Processing notes', '', ...context.notes.map((item) => `- ${item}`)] : []),
  ];
  await writeTextAtomic(path.join(outputDirectory, 'audit.md'), `${auditLines.join('\n')}\n`);
  created.push('audit.md');
  return { created, uncertainties };
}

async function recoverIssue({ job, notify, sourcePDF, outputDirectory, sourceName, improvedName, config, toolkit, preserveOriginal = true }) {
  if (preserveOriginal) await copyPreserving(sourcePDF, path.join(outputDirectory, sourceName));
  const improvedPath = path.join(outputDirectory, improvedName);
  let ocrStatus = 'Completed';
  try {
    update(job, notify, { stage: `Re-OCRing ${sourceName}`, status: 'processing' });
    const report = await improvePDF(toolkit, sourcePDF, improvedPath);
    ocrStatus = `Completed for ${report.pages || 'all'} page(s)`;
  } catch (error) {
    if (!(await exists(improvedPath))) await copyPreserving(sourcePDF, improvedPath);
    ocrStatus = `Warning: ${error.message}`;
  }
  assertNotCancelled(job);
  update(job, notify, { stage: `Identifying articles in ${sourceName}` });
  const extracted = await pricedResponse(job, notify, { ...config, prompt: issuePrompt(sourceName), sources: [improvedPath], schema: issueSchema, schemaName: 'beacon_issue', signal: job.abortController.signal });
  update(job, notify, { stage: `Auditing every page of ${sourceName}`, status: 'auditing' });
  const audited = await pricedResponse(job, notify, { ...config, prompt: issueAuditPrompt(sourceName, extracted.json), sources: [improvedPath], schema: issueSchema, schemaName: 'beacon_issue_audit', signal: job.abortController.signal });
  const issue = audited.json;
  const outputs = await writeIssueOutputs(outputDirectory, issue, { originalName: sourceName, improvedName, ocrStatus, pageCount: await pdfPageCount(sourcePDF) });
  if (ocrStatus.startsWith('Warning')) outputs.uncertainties.push(ocrStatus);
  const status = outputs.uncertainties.length ? 'Cleaned and verified with uncertainties' : 'Cleaned and verified';
  return { issue, status, outputs: outputs.created, uncertainty: outputs.uncertainties.join(' ') };
}

async function processBeaconIssues({ job, notify, files, config, toolkit }) {
  const allImages = files.every((item) => IMAGE_EXTENSIONS.has(path.extname(item.path).toLowerCase()));
  const groups = allImages ? [files] : files.map((item) => [item]);
  job.totalFiles = groups.length;
  const batchParent = groups.length > 1 ? await uniqueDirectory(DOWNLOADS, `Batch - ${timestamp()}`) : null;
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const first = group[0];
    const base = safeFilename(basenameWithoutExtension(first.originalName));
    const outputDirectory = await uniqueDirectory(batchParent || DOWNLOADS, base);
    if (!job.destination) update(job, notify, { destination: batchParent || outputDirectory });
    try {
      const source = await beaconSourcePDF({ toolkit, files: group, outputDirectory, baseName: base });
      const improvedName = `${source.baseName} [improved].pdf`;
      const recovered = await recoverIssue({ job, notify, sourcePDF: source.sourcePDF, outputDirectory, sourceName: path.basename(source.sourcePDF), improvedName, config, toolkit, preserveOriginal: false });
      job.results.push(resultFor(first.originalName, recovered.status, recovered.outputs.map((item) => path.relative(batchParent || outputDirectory, path.join(outputDirectory, item))), recovered.uncertainty));
    } catch (error) {
      if (job.cancelRequested) throw error;
      job.results.push(resultFor(first.originalName, 'Unable to verify', [], '', error.message));
    }
    update(job, notify, { completedFiles: index + 1, progress: ((index + 1) / groups.length) * 100 });
  }
  return job.destination;
}

function validateManifest(manifest, actualPageCount) {
  const issues = [...(manifest.issues || [])].sort((a, b) => a.start_page - b.start_page);
  let lastEnd = 0;
  for (const issue of issues) {
    if (!Number.isInteger(issue.start_page) || !Number.isInteger(issue.end_page) || issue.start_page < 1 || issue.end_page < issue.start_page || issue.end_page > actualPageCount) {
      throw new Error(`The proposed issue range ${issue.start_page}-${issue.end_page} is outside the ${actualPageCount}-page source.`);
    }
    if (issue.start_page <= lastEnd) throw new Error('The proposed issue ranges overlap.');
    lastEnd = issue.end_page;
  }
  if (!issues.length) throw new Error('No issue boundaries could be established from the volume.');
  return { ...manifest, source_page_count: actualPageCount, issues };
}

async function processBeaconVolume({ job, notify, files, config, toolkit }) {
  const source = files[0];
  const base = safeFilename(basenameWithoutExtension(source.originalName));
  const outputDirectory = await uniqueDirectory(DOWNLOADS, base);
  update(job, notify, { destination: outputDirectory, stage: 'Preserving complete volume', status: 'preparing' });
  const preservedVolume = path.join(outputDirectory, source.originalName);
  await copyPreserving(source.path, preservedVolume);
  const pageCount = await pdfPageCount(source.path);
  update(job, notify, { stage: 'Inspecting complete volume and establishing issue boundaries', status: 'processing', progress: 4 });
  const manifestResponse = await pricedResponse(job, notify, { ...config, prompt: volumeManifestPrompt(source.originalName, pageCount), sources: [source.path], schema: volumeManifestSchema, schemaName: 'beacon_volume_manifest', signal: job.abortController.signal });
  const manifest = validateManifest(manifestResponse.json, pageCount);
  job.totalFiles = manifest.issues.length;
  const issueSummaries = [];

  for (let index = 0; index < manifest.issues.length; index += 1) {
    assertNotCancelled(job);
    const issue = manifest.issues[index];
    const volumeLabel = manifest.volume_number || 'Unknown';
    const issueLabel = issue.issue_number || `${index + 1} Uncertain`;
    const issueBase = safeFilename(`Volume ${volumeLabel} Issue ${issueLabel}`);
    const issueDirectory = await uniqueDirectory(outputDirectory, issueBase);
    const splitName = `${issueBase}.pdf`;
    const splitPath = path.join(issueDirectory, splitName);
    update(job, notify, { stage: `Splitting issue ${index + 1} of ${manifest.issues.length}` });
    await splitPDF(source.path, splitPath, issue.start_page, issue.end_page);
    const improvedName = `${issueBase} [improved].pdf`;
    try {
      const recovered = await recoverIssue({ job, notify, sourcePDF: splitPath, outputDirectory: issueDirectory, sourceName: splitName, improvedName, config, toolkit, preserveOriginal: false });
      const uncertainty = [issue.confidence !== 'high' ? `Boundary confidence: ${issue.confidence}. ${issue.notes}` : '', recovered.uncertainty].filter(Boolean).join(' ');
      const status = uncertainty && recovered.status === 'Cleaned and verified' ? 'Cleaned and verified with uncertainties' : recovered.status;
      issueSummaries.push({ issue, issueBase, status, articleCount: recovered.issue.articles?.length || 0, uncertainty, outputs: recovered.outputs });
      job.results.push(resultFor(issueBase, status, recovered.outputs.map((item) => path.join(issueBase, item)), uncertainty));
    } catch (error) {
      if (job.cancelRequested) throw error;
      issueSummaries.push({ issue, issueBase, status: 'Unable to verify', articleCount: 0, uncertainty: error.message, outputs: [splitName] });
      job.results.push(resultFor(issueBase, 'Unable to verify', [path.join(issueBase, splitName)], '', error.message));
    }
    update(job, notify, { completedFiles: index + 1, progress: 8 + ((index + 1) / manifest.issues.length) * 92 });
  }

  const rootAudit = [
    '# Volume audit', '',
    `- Source volume: ${source.originalName}`,
    `- Volume number: ${manifest.volume_number || 'Uncertain'}`,
    `- Source page count: ${pageCount}`,
    `- Issues identified: ${manifest.issues.length}`,
    `- Appears complete: ${manifest.appears_complete ? 'Yes' : 'No or uncertain'}`,
    '', '## Issue accounting', '',
    ...issueSummaries.flatMap((summary) => [
      `### ${summary.issueBase}`,
      `- Source pages: ${summary.issue.start_page}-${summary.issue.end_page}`,
      `- Publication date: ${summary.issue.publication_date || 'Uncertain'}`,
      `- Boundary confidence: ${summary.issue.confidence}`,
      `- Split PDF: ${summary.issueBase}/${summary.issueBase}.pdf`,
      `- Improved PDF: ${summary.issueBase}/${summary.issueBase} [improved].pdf`,
      `- Articles produced: ${summary.articleCount}`,
      `- Status: ${summary.status}`,
      `- Notes: ${summary.uncertainty || summary.issue.notes || 'None'}`,
      '',
    ]),
    '## Volume uncertainties', '',
    ...(manifest.uncertainties?.length ? manifest.uncertainties.map((item) => `- ${item}`) : ['- None reported.']),
  ];
  await writeTextAtomic(path.join(outputDirectory, 'audit.md'), `${rootAudit.join('\n')}\n`);
  return outputDirectory;
}

export async function processJob({ job, files, config, toolkit, notify }) {
  if (!files.length) throw new Error('No source files were supplied.');
  if (job.path === 'beacon_volume' && (files.length !== 1 || path.extname(files[0].path).toLowerCase() !== '.pdf')) {
    throw new Error('A Beacon volume job requires exactly one PDF.');
  }
  let destination;
  if (SIMPLE_PATHS.has(job.path)) destination = await processSimpleBatch({ job, notify, files, config, toolkit });
  else if (job.path === 'beacon_article') destination = await processBeaconArticles({ job, notify, files, config, toolkit });
  else if (job.path === 'beacon_issue') destination = await processBeaconIssues({ job, notify, files, config, toolkit });
  else if (job.path === 'beacon_volume') destination = await processBeaconVolume({ job, notify, files, config, toolkit });
  else throw new Error(`Unsupported cleaning path: ${job.path}.`);
  update(job, notify, { destination, stage: job.cancelRequested ? 'Cancelled' : 'Cleaning and verification complete', status: job.cancelRequested ? 'cancelled' : 'completed', progress: 100 });
  return destination;
}

export const testables = { adaptiveOutputLimit, stripFence, normalizedDate, markdownFilename, shouldRunAdaptiveAudit, validateManifest, safeFilename };
