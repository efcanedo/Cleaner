import { readFileSync } from 'node:fs';

function loadSpecification() {
  const candidates = [new URL('./specification.md', import.meta.url), new URL('../docs/Document_Cleaner_App_Instructions_Updated_v2.md', import.meta.url)];
  for (const candidate of candidates) {
    try { return readFileSync(candidate, 'utf8'); } catch { /* Try the next source or packaged location. */ }
  }
  return '';
}

const fullSpecification = loadSpecification();
const sectionMarkers = {
  news_articles: ['# DIRTY NEWS ARTICLES', '# DIRTY DOCUMENTS'],
  documents: ['# DIRTY DOCUMENTS', '# DIRTY HEARING TRANSCRIPTS'],
  hearing_transcripts: ['# DIRTY HEARING TRANSCRIPTS', '# DIRTY BEACON ARTICLE'],
  beacon_article: ['# DIRTY BEACON ARTICLE', '# DIRTY BEACON ISSUE'],
  beacon_issue: ['# DIRTY BEACON ISSUE', '# DIRTY BEACON VOLUME'],
  beacon_volume: ['# DIRTY BEACON VOLUME', '# General App Safeguards'],
};

function exactRules(path) {
  const markers = sectionMarkers[path];
  if (!markers || !fullSpecification) return '';
  const start = fullSpecification.indexOf(markers[0]);
  const end = fullSpecification.indexOf(markers[1], start + markers[0].length);
  const safeguardsStart = fullSpecification.indexOf('# General App Safeguards');
  const section = start >= 0 ? fullSpecification.slice(start, end >= 0 ? end : undefined).trim() : '';
  const safeguards = safeguardsStart >= 0 ? fullSpecification.slice(safeguardsStart).trim() : '';
  return `\nEXACT PRODUCT REQUIREMENTS FOR THIS PATH\n${section}\n\n${safeguards}`;
}

export const PATH_LABELS = {
  news_articles: 'Dirty news articles',
  documents: 'Dirty documents',
  hearing_transcripts: 'Dirty hearing transcripts',
  beacon_article: 'Dirty Beacon article',
  beacon_issue: 'Dirty Beacon issue',
  beacon_volume: 'Dirty Beacon volume',
};

const fidelity = `
SOURCE AUTHORITY AND FIDELITY
- The source is authoritative. Restore and convert it; do not summarize, rewrite, modernize, fact-check, embellish, or improve its substance.
- Preserve every substantive statement, qualification, correction, name, title, date, number, amount, citation, hyperlink, list, table relationship, caption, and source note.
- Correct only mechanical scraping, OCR, extraction, spacing, line-wrap, or transcription artifacts when the intended reading is sufficiently supported.
- Never invent missing text, metadata, identities, issue boundaries, article boundaries, visual relationships, or numbers.
- Use [unclear], [inaudible], or [uncertain: possible reading] when source evidence cannot support a confident reading.
- Preserve source order. Reconstruct order only where extraction visibly scrambled columns, tables, page regions, or continuation pages.
- Favor preservation when it is genuinely uncertain whether content is substantive.
- Return only the requested deliverable. Do not add a summary of changes or app commentary to cleaned Markdown.
`;

const pathRules = {
  news_articles: `
This source represents one scraped news article or post. Preserve the existing file title at the very top and the original source URL immediately below it. Preserve the article title, date/year, byline, genuine subtitle/dek, complete article text, article headings, quotations, meaningful lists, article captions/credits, and legitimate inline links.

Remove webpage material that is not part of the article: navigation, menus, search/weather/account controls, unrelated current headlines, ads, newsletter/app/subscription prompts, social sharing controls, promotional embeds, READ MORE/RELATED/TRENDING/RECOMMENDED blocks, tags, categories, comments prompts, boilerplate, copyright/terms/privacy, footers, subsequent unrelated articles, gallery controls, stray image URLs, and large blocks captured from the current website rather than the historical article.

Use editorial judgment to establish the real beginning and end. Do not alter the journalism. Preserve the original filename-derived title line and source URL even if similar metadata appears again in the article.
`,
  documents: `
Inspect and classify the complete document before cleaning. It may be continuous prose, testimony, a memo, letter, agenda, witness list, report, table, inventory, organizational chart, slide deck, form, legal/administrative record, or a mixed document. Visible layout may establish reading order, heading hierarchy, row associations, labels, grouping, hierarchy, captions, footnotes, and continuation.

Preserve the complete substantive document and its organization. Use Markdown headings only for source headings; preserve genuine paragraphs and lists; use Markdown tables when faithful; use structured labeled records for tables too complex for Markdown tables; use nested bullets for supported hierarchies; keep form labels attached to values; retain footnotes, endnotes, citations, links, signatures, and appendices.

Significant visuals must be represented by all applicable functions: (1) embed the faithful source-page or extracted visual asset using the supplied relative asset path, (2) transcribe reliably recoverable structured information, and (3) provide a concise, source-grounded narrative description. Do not infer chart values from geometry alone or invent reporting relationships. Decorative page furniture may be omitted. If the supplied source-page assets contain a significant visual, embed the relevant asset as ![Source page showing the visual](assets/source-page-N.png) at the appropriate point.

Repair OCR and extraction errors conservatively. Join wrapped lines into paragraphs. Preserve deliberate emphasis and meaningful capitalization. Remove only clearly non-substantive extraction debris, duplicated page furniture, viewer chrome, scanner annotations, meaningless glyphs, and accidental repeats.
`,
  hearing_transcripts: `
Restore a complete hearing transcript rather than summarizing it. When supported, begin with "# YYYY.MM.DD Hearing Name" using the official or best-supported title. Preserve opening/call to order, notices, testimony, oaths, questions, answers, exchanges, procedure, recesses, interruptions, corrections, closing, record statements, and adjournment.

Collapse cumulative live-caption buildup, overlapping caption windows, duplicated partial fragments, duplicated speaker labels, and other mechanical refresh artifacts. Preserve genuinely spoken repetition, hesitation, false starts, self-corrections, qualifications, and corrected-number sequences. Restore normal capitalization, punctuation, spacing, and readable paragraphing without making speech more elegant.

Format each turn as **Speaker Name:** Speech. Use the most specific supported identity: name; title and name; established role; generic role; then Unknown Speaker. Infer identity only from strong transcript evidence such as introductions, self-identification, direct address, witness sequence, or surrounding question-and-answer context. Keep canonical labels consistent. Never merge different speakers, questions with answers, or rapid exchanges. Preserve meaningful [Laughter], [Applause], [Poor audio], [Inaudible], and [Recess] markers.

Be especially conservative with names, amounts, dates, percentages, legal citations, bill numbers, agencies, schools, and technical terminology. Preserve conventional acronyms and proper names only when supported. Return only the transcript.
`,
  beacon_article: `
The source is one discrete Beacon article or item. Visually reconstruct the headline, subtitle/dek, byline, publication date when printed, body, headings, quotations, meaningful lists, and belonging captions/credits. Follow columns in visible order and reunite all continuation segments into one article. Omit purely navigational "continued on page" notices once reunited. Do not pull in neighboring articles, advertisements, or unrelated captions. Correct OCR only when the page supports the intended reading. Return one coherent article in Markdown.
`,
};

export function cleaningPrompt(path, sourceName, assetNote = '') {
  if (!pathRules[path]) throw new Error(`No single-source prompt exists for ${path}.`);
  return `You are performing source-faithful archival document restoration.

SELECTED CLEANING PATH: ${PATH_LABELS[path]}
SOURCE FILENAME: ${sourceName}
${assetNote}
${fidelity}
PATH-SPECIFIC RULES
${pathRules[path]}
${exactRules(path)}

Before returning the Markdown, silently inspect the complete source, choose the correct reading strategy, and check the result sequentially against the source. Your response must be only the cleaned Markdown, with no code fence.`;
}

export function auditPrompt(path, sourceName, cleanedMarkdown, assetNote = '') {
  return `Perform a separate, strict fidelity audit of the proposed cleaned Markdown against the attached original source.

SELECTED PATH: ${PATH_LABELS[path]}
SOURCE: ${sourceName}
${assetNote}
${fidelity}
${exactRules(path)}
Audit sequentially from beginning to end. Do not use word-count similarity. Verify every substantive unit, source order, high-risk field, speaker transition where applicable, table/visual relationship where applicable, and all substantial deletion or deduplication decisions. Correct the Markdown whenever the source supports a correction. Do not make uncertain text appear certain.

Classify the result exactly as one of:
- Cleaned and verified
- Cleaned and verified with uncertainties
- Unable to verify

PROPOSED CLEANED MARKDOWN
---
${cleanedMarkdown}
---

Return the required structured result. final_markdown must contain only the corrected cleaned deliverable. uncertainty_summary must be concise and empty when fully verified. audit_notes should concisely identify what the audit checked and any material corrections; it is for the app report, not the Markdown file.`;
}

export const auditSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'uncertainty_summary', 'audit_notes', 'final_markdown'],
  properties: {
    status: { type: 'string', enum: ['Cleaned and verified', 'Cleaned and verified with uncertainties', 'Unable to verify'] },
    uncertainty_summary: { type: 'string' },
    audit_notes: { type: 'string' },
    final_markdown: { type: 'string' },
  },
};

export function fastArticlePrompt(sourceName) {
  return `Clean this scraped news article in one source-faithful pass and perform a silent sequential fidelity check before returning the structured result.

SOURCE: ${sourceName}
${fidelity}
${pathRules.news_articles}
${exactRules('news_articles')}

Set requires_second_audit to true only when a genuinely separate review is warranted: the article boundary remains ambiguous, substantive text or metadata is uncertain, the source may contain multiple captured articles, OCR or layout corruption is material, or the result cannot be classified as fully verified. A normal article with clearly removable website chrome should not require a second audit.

final_markdown must contain only the cleaned article, without a code fence. audit_notes should briefly identify the source boundary and the principal removed debris. uncertainty_summary and risk_reason must be empty when the article is fully verified.`;
}

export const fastArticleSchema = {
  type: 'object', additionalProperties: false,
  required: ['status', 'uncertainty_summary', 'audit_notes', 'final_markdown', 'requires_second_audit', 'risk_reason'],
  properties: {
    status: { type: 'string', enum: ['Cleaned and verified', 'Cleaned and verified with uncertainties', 'Unable to verify'] },
    uncertainty_summary: { type: 'string' }, audit_notes: { type: 'string' }, final_markdown: { type: 'string' },
    requires_second_audit: { type: 'boolean' }, risk_reason: { type: 'string' },
  },
};

export function issuePrompt(sourceName) {
  return `You are recovering one complete historical Beacon issue from the attached source: ${sourceName}.
${exactRules('beacon_issue')}
${fidelity}
Visually inventory the entire issue page by page before extraction. Establish publication date, volume/issue number, page order, masthead, article boundaries, multi-column reading order, and continuation pages. Ignore advertisements and purely promotional material. Identify every substantive article or editorial item, including short items. Each discrete article remains one item across columns, ads, and page continuations. Do not contaminate an article with neighbors, ads, or unrelated captions.

For every article, return complete source-faithful Markdown containing its headline, subtitle/dek, byline, body, headings, quotations/lists, and belonging captions/credits. Do not summarize or rewrite. Correct OCR only when supported and mark unresolved text. Use the printed issue date as YYYY.MM.DD when established. Also return a separate complete masthead Markdown transcription. Page numbers are 1-based source PDF pages.

Return the structured issue record only.`;
}

export const issueSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['publication_date', 'volume_number', 'issue_number', 'page_count', 'articles', 'masthead', 'uncertainties'],
  properties: {
    publication_date: { type: 'string' },
    volume_number: { type: 'string' },
    issue_number: { type: 'string' },
    page_count: { type: 'integer' },
    articles: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'date', 'pages', 'markdown', 'uncertainty'],
        properties: {
          title: { type: 'string' }, date: { type: 'string' }, pages: { type: 'array', items: { type: 'integer' } },
          markdown: { type: 'string' }, uncertainty: { type: 'string' },
        },
      },
    },
    masthead: { type: 'string' },
    uncertainties: { type: 'array', items: { type: 'string' } },
  },
};

export function issueAuditPrompt(sourceName, issueRecord) {
  return `Audit this recovered Beacon issue page by page against the attached source ${sourceName}.
${exactRules('beacon_issue')}
${fidelity}
Verify issue identity, page order, every substantive article, all continuation segments, masthead, columns, titles, bylines, captions, absence of advertisement or neighboring-article contamination, and all uncertain OCR. Repair the structured record where the source supports it. Do not omit short articles. Return the same structured issue schema.

PROPOSED ISSUE RECORD
${JSON.stringify(issueRecord)}`;
}

export function volumeManifestPrompt(sourceName, pageCount) {
  return `Inspect the complete attached Beacon volume PDF ${sourceName} (${pageCount} source pages) before splitting it.
${exactRules('beacon_volume')}
${fidelity}
Determine the volume number, every identifiable issue boundary, issue number, publication date, page order, missing/duplicated pages, separator pages, and completeness. Do not assume fixed issue lengths. Use printed metadata, mastheads, dates, page numbering, repeated title pages, and other visible evidence. Page numbers in the response must be inclusive, 1-based source PDF pages. Issue ranges must not overlap. Do not invent unknown identifiers; use empty strings and explain uncertainty. Return only the structured manifest.`;
}

export const volumeManifestSchema = {
  type: 'object', additionalProperties: false,
  required: ['volume_number', 'source_page_count', 'appears_complete', 'issues', 'uncertainties'],
  properties: {
    volume_number: { type: 'string' }, source_page_count: { type: 'integer' }, appears_complete: { type: 'boolean' },
    issues: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['issue_number', 'publication_date', 'start_page', 'end_page', 'confidence', 'notes'],
        properties: {
          issue_number: { type: 'string' }, publication_date: { type: 'string' }, start_page: { type: 'integer' }, end_page: { type: 'integer' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] }, notes: { type: 'string' },
        },
      },
    },
    uncertainties: { type: 'array', items: { type: 'string' } },
  },
};
