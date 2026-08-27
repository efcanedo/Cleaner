# Document Cleaner 1.2

Document Cleaner is a local Apple-silicon macOS app that converts difficult source files into source-faithful Markdown. Its interface and native packaging follow the interaction model of [Document Harvester](https://github.com/efcanedo/Document-Harvester), while its processing engine is designed for local file selection, OpenAI-assisted restoration, adaptive fidelity audits, and archival output to Downloads.

## Cleaning paths

- **News articles** removes site chrome, promotions, unrelated blocks, and scraping debris while preserving the complete article, its supplied title line, source URL, metadata, inline links, and journalism.
- **Documents** restores prose, tables, forms, reports, filings, slides, hierarchies, and visual evidence. Rendered PDF pages are preserved as Markdown assets when visual evidence may be significant.
- **Hearing transcripts** removes caption buildup, restores punctuation and paragraphs, identifies speakers only when supported, and conditionally audits uncertain turns, numbers, names, corrections, and deduplication.
- **Beacon article** preserves the original, creates an OCR-improved PDF, reconstructs one article across columns or continuations, and writes `audit.md`.
- **Beacon issue** preserves and re-OCRs an issue, inventories it page by page, creates one Markdown file per article plus a masthead, and writes an issue audit.
- **Beacon volume** preserves the complete volume, establishes issue boundaries from source evidence, creates split and improved issue PDFs, checkpoints each issue, extracts its articles and masthead, and writes issue- and volume-level audits.

Supported inputs are Markdown, plain text, Word, PDF, and—on Beacon paths—PNG, JPEG, TIFF, and HEIC images. Batch failures are isolated by source. Original files are never overwritten.

## Privacy and API behavior

The user supplies an OpenAI API key in Settings. The key is stored in macOS Keychain under the service `com.ecanedo.documentcleaner`; it is never stored in browser data or a repository file. Requests go directly from the local helper to the OpenAI Responses API with response storage disabled. Temporary uploads are stored with restrictive permissions under `~/Library/Application Support/Document Cleaner/jobs` and removed after the job ends.

The default model is `gpt-5.6-terra`, with `gpt-5.6-sol` and `gpt-5.6-luna` selectable. The implementation follows the official [Responses API reference](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses/methods/create) for file/image inputs and structured outputs.

Before a job begins, the run bar displays an approximate API-cost range based on selected file sizes, cleaning path, model, and current published token prices. Completed jobs display the cost calculated from the API's reported token usage. Estimates for PDFs and images are intentionally wider because their tokenization depends on page and image content.

News articles, documents, and hearing transcripts use one medium-reasoning structured cleaning and fidelity pass. A separate higher-reasoning audit runs only when the first pass reports uncertainty or path-specific risk. For documents, triggers include uncertain reading order, material OCR damage, and complex tables, forms, hierarchies, or significant visuals. For transcripts, triggers include uncertain speakers or turns, questionable deduplication, unsupported dates or titles, and high-risk names, numbers, amounts, or citations. Beacon paths retain their independent audit passes.

## Architecture

- `src/` — React and TypeScript interface.
- `native/helper-server.mjs` — loopback-only local API, uploads, Keychain settings, job lifecycle, and static app server.
- `native/pipeline.mjs` — deterministic file handling plus the six cleaning pipelines.
- `native/prompts.mjs` — path-specific source-fidelity and audit requirements.
- `docs/Document_Cleaner_App_Instructions_Updated_v2.md` — the complete supplied cleaning specification, preserved verbatim and packaged for path-specific prompting.
- `native/openai.mjs` — direct Responses API client with retries, structured output, cancellation, and `store: false`.
- `native/DocumentToolkit.swift` — bundled PDF rendering, Vision OCR, searchable improved-PDF generation, and image-to-PDF conversion.
- `native/AppDelegate.swift` — native menu-bar launcher.
- `scripts/build-app.sh` — reproducible arm64 `.app` and ZIP build.
- `tests/` — deterministic naming, validation, and schema regression tests.

The installed app runs a server bound only to `127.0.0.1:41842`, opens the interface in the user's default browser, and embeds its own arm64 Node runtime and native document toolkit.

## Build

See [BUILDING.md](BUILDING.md). On a compatible Mac:

```bash
./scripts/build-app.sh
```

The verified distributable is created at `outputs/Document Cleaner 1.2.app.zip`.

## Operational limits

Document restoration quality depends on source legibility, OpenAI API access, account limits, model availability, and the model selected by the user. The app reports uncertainty rather than treating model confidence as proof. Very large or severely damaged sources may be marked `Unable to verify`; successfully completed files in the same batch remain available.
