# Document Cleaner implementation requirements

This file records the product requirements implemented by version 1.0. The detailed cleaning rules supplied for the project remain the substantive specification; runtime prompts in `native/prompts.mjs` encode the path-specific rules and audit criteria.

## Governing safeguards

- Preserve the unchanged source; never overwrite it.
- Create new Markdown outputs and unique timestamped folders where specified.
- Treat each cleaning path independently. Do not transfer rules between paths unless shared safeguards expressly require it.
- Use deterministic local processing for file handling, copying, naming, PDF splitting, rendering, OCR PDF assembly, and output accounting.
- Use OpenAI for document understanding, visual reading order, OCR interpretation, structure, speakers, article boundaries, supported corrections, and source-fidelity auditing.
- The source remains authoritative. Do not fabricate text, metadata, names, dates, values, identities, article boundaries, or issue boundaries.
- Preserve uncertainty when evidence is insufficient.
- Isolate batch failures.
- Report `Cleaned and verified`, `Cleaned and verified with uncertainties`, or `Unable to verify` per logical source.

## Output conventions

- News: one `[cleaned].md` per source in `Cleaned Articles - YYYY.MM.DD HH.MM.SS`.
- Documents: one `[cleaned].md` per source in `Cleaned Documents - YYYY.MM.DD HH.MM.SS`, with preserved visual assets where applicable.
- Transcripts: one archival `[cleaned].md` per hearing in `Cleaned Hearing Transcripts - YYYY.MM.DD HH.MM.SS`.
- Beacon article: source, `[improved].pdf`, one article `.md`, and `audit.md` in an item folder; batches use a timestamped parent.
- Beacon issue: preserved source, improved PDF, one `.md` per article, dated masthead, and `audit.md`.
- Beacon volume: preserved volume, one subfolder per issue with split/improved PDFs and extracted content, issue audits, and a root `audit.md`.

## Verification

Ordinary sources receive a second, separate sequential fidelity request whose structured result contains the corrected final Markdown, status, uncertainty summary, and internal audit notes. Beacon issues receive a second page-by-page issue audit. Volumes validate model-proposed page ranges deterministically before splitting and checkpoint each issue before proceeding.
