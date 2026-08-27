# Document Cleaner App — Cleaning Instructions

## App Overview

You will build a **Document Cleaner** app.

This app will be given a single “dirty” file, or a set of files for batch processing. It will clean the source files according to the document type selected by the user, produce cleaned Markdown versions, and save the cleaned files to a uniquely named folder in the user’s Downloads folder.

The interface should be based on the **Document Harvester** app.

The app can read:

- Markdown (`.md`)
- plain text (`.txt`)
- Word (`.docx`)
- PDF (`.pdf`)

The user will select one of the following input types:

- Dirty news articles
- Dirty documents
- Dirty hearing transcripts
- Dirty Beacon article
- Dirty Beacon issue
- Dirty Beacon volume

The app must follow the cleaning path associated with the selected document type.

## ChatGPT API Integration

The Document Cleaner app will utilize the **ChatGPT API** as a core processing component.

The app should use the ChatGPT API where appropriate for tasks that require document understanding and editorial or structural judgment, including:

- inspecting source documents and determining document type and complexity;
- selecting an appropriate processing strategy;
- interpreting OCR or extracted text in context;
- resolving multi-column reading order;
- distinguishing substantive content from extraction artifacts;
- reconstructing document structure;
- identifying speakers in hearing transcripts;
- identifying article boundaries and continuation pages;
- correcting OCR or transcription errors when the intended reading is sufficiently supported;
- preserving tables, lists, hierarchies, and other meaningful relationships;
- performing fidelity audits against the original source.

The app should not treat the ChatGPT API as a generic text-rewriting service. Prompts and processing steps must emphasize source fidelity, uncertainty handling, and preservation of substantive content.

When visual inspection is necessary, the app should provide the model with the rendered source pages or page images needed to evaluate layout, columns, tables, charts, diagrams, or other visual structure.

Where a task can be handled reliably through deterministic local processing, such as file naming, folder creation, PDF splitting, basic format conversion, or copying files, the app should perform those operations directly rather than asking the model to simulate them.

The source file must remain authoritative. Model-generated reconstructions or corrections should never override clear source evidence.

---


Do not apply rules from one cleaning path to another unless those rules are explicitly incorporated into both paths.

When processing multiple files, process each file independently unless the selected cleaning path explicitly requires treating multiple files or pages as parts of a single source.

---

# DIRTY NEWS ARTICLES

Clean each file individually. Ultimately you will be producing a clean MD file for each article.

Do not use a simple mechanical rule for every file. Examine each article independently and use editorial judgment to determine where the actual article begins and ends and what material belongs to the article.

For each file:

1. Preserve the existing file title at the very top.

2. Preserve the original source URL immediately below it.

3. Retain the substantive article or post itself. In most cases this should include:
   - article/post title;
   - publication date or year;
   - author/byline, when present;
   - subtitle, dek, or introductory description when it is genuinely part of the article;
   - the complete article/post text;
   - meaningful section headings that are part of the article;
   - quotations, lists, captions, or other material that is substantively part of the article.

4. Preserve hyperlinks that occur naturally within the article text when they support or form part of the article. Do not strip legitimate inline source/document links merely because they are hyperlinks.

5. Remove extraneous material before the article begins, including:
   - website navigation;
   - menus;
   - search controls;
   - weather information;
   - current-site headlines;
   - unrelated stories;
   - login/account material;
   - newsletter prompts;
   - app-download prompts;
   - site branding that is not part of the article;
   - category menus;
   - advertisements.

6. Remove social-media sharing material, including links or buttons for Twitter/X, Facebook, Instagram, LinkedIn, Reddit, Pinterest, WhatsApp, and similar platforms. Also remove standalone embedded social-media promotional material unless the actual content of the social-media post is substantively necessary to the article.

7. Remove advertisements and promotional interruptions appearing inside the article body. Be careful not to delete nearby legitimate article paragraphs.

8. Remove unrelated “READ MORE,” “RELATED,” “TRENDING,” “RECOMMENDED,” “MORE STORIES,” “POPULAR,” or similar blocks unless the linked material is actually discussed as part of the article itself.

9. Remove tags, filing categories, topic lists, comments prompts, sharing prompts, subscription solicitations, newsletter forms, copyright notices, terms/privacy links, footer information, and other site boilerplate.

10. At the end of the article, remove:
    - related-story lists;
    - recommended articles;
    - subsequent unrelated articles accidentally captured in the same file;
    - site footers;
    - current headlines;
    - advertisements;
    - other material that clearly begins after the original article has ended.

11. If an image caption or photo credit clearly belongs to the article, you may retain it. Remove stray image-navigation text, image URLs, thumbnails, gallery controls, and unrelated promotional image material.

12. Do not summarize, rewrite, modernize, fact-check, or otherwise alter the substantive article text. The goal is cleanup, not editing the journalism. Preserve the author’s wording and paragraph order.

13. Correct only obvious scraping artifacts when necessary for readability, such as duplicated blank lines, isolated navigation symbols, malformed spacing, or text fragments caused solely by page extraction. Do not silently rewrite substantive prose.

14. Be especially alert for files where the webpage scraper captured material from the current version of the website rather than from the historical article. Remove that material even when it occupies hundreds of lines before or after the target article.

15. When uncertain whether something is part of the article, use context and editorial judgment rather than deleting it automatically. Favor preservation of substantive article content and removal of obvious website chrome or unrelated content.

## Output Requirements — Dirty News Articles

- Create a separate cleaned Markdown file for every source file.
- Do not combine multiple articles into one Markdown file.
- Use exactly the same original filename, but append ` [cleaned]` immediately before the `.md` extension.

Example:

`2022-01-05 Example Article (Outlet).md`

becomes:

`2022-01-05 Example Article (Outlet) [cleaned].md`

When all selected news articles are finished, save them into a new folder in the user’s Downloads folder named:

`Cleaned Articles - YYYY.MM.DD HH.MM.SS`

Use the current local date and time as a unique identifier so that an existing output folder is never overwritten.

---

# DIRTY DOCUMENTS

Clean each source document individually. Ultimately, produce one cleaned Markdown file for each source document unless the selected source itself clearly contains multiple discrete documents that must be separated to preserve their identity.

A dirty document may be a PDF, DOCX, Markdown file, plain-text file, or another supported document source. It may contain prose, testimony, agendas, witness lists, tables, charts, diagrams, organizational charts, presentation slides, lists, forms, legal or administrative records, or a mixture of these.

Do not use a single mechanical cleanup rule for every document. First determine what kind of document you are dealing with and how its meaning is carried by both text and layout.

The objective is:

**Preserve the substantive content, organization, relationships, and evidentiary meaning of the source while removing extraction and OCR artifacts that interfere with faithful reading.**

This is document restoration and faithful Markdown conversion, not summarization or rewriting.

---

## 1. Inspect and Classify the Document Before Cleaning

Inspect the complete source before deciding how to clean it.

When the source is a PDF or other visually structured document, examine the rendered pages as well as any available OCR or extracted text.

Determine whether the document is primarily:

- continuous prose;
- written testimony;
- memorandum or letter;
- agenda or witness list;
- report;
- table or inventory;
- spreadsheet-like record;
- organizational chart;
- presentation or slide deck;
- form;
- legal or administrative filing;
- mixed-format document.

Do not assume that the extracted text alone captures the document correctly.

Visual layout may establish:

- reading order;
- heading hierarchy;
- table columns;
- row associations;
- organizational reporting relationships;
- labels attached to charts or diagrams;
- footnotes;
- source notes;
- captions;
- grouping;
- continuation from one page to another.

When the text extraction and the visible page disagree, use the visible source to determine the intended structure while preserving the actual source content.

---

## 2. Preserve the Complete Substantive Document

Retain all substantive material that belongs to the document.

Depending on the source, this may include:

- title;
- subtitle;
- date;
- author or preparer;
- agency or organization;
- recipient;
- subject line;
- introductory metadata;
- headings and subheadings;
- paragraphs;
- lists;
- numbered sections;
- witness lists;
- agenda items;
- tables;
- charts and chart labels;
- figure captions;
- source notes;
- footnotes and endnotes;
- citations;
- hyperlinks;
- case numbers;
- docket numbers;
- names and titles;
- appendices;
- signatures or signature blocks when substantively part of the document;
- page-specific labels when needed to preserve meaning.

Do not delete material merely because it appears administrative, technical, repetitive in format, or visually secondary.

Remove only material that is clearly non-substantive extraction debris, duplicated page furniture, or an artifact of OCR or conversion.

---

## 3. Preserve Source Order and Logical Structure

Maintain the source document's substantive order.

Do not rearrange material into what seems like a more logical sequence unless the extraction itself scrambled the source order and the correct order can be established from the visible document.

Preserve:

- section order;
- paragraph order;
- list order;
- agenda order;
- witness order;
- table row order;
- slide order;
- page-to-page continuation;
- hierarchy among headings and subheadings.

If OCR interleaves columns, table cells, or separate regions incorrectly, reconstruct the intended order from the page layout.

---

# Text Restoration

## 4. Correct OCR and Extraction Errors Conservatively

Correct obvious OCR or extraction errors when the intended text is clear from the source.

Examples include:

- words incorrectly split across lines;
- hyphenation introduced only by line wrapping;
- duplicated characters;
- missing spaces;
- inserted spaces inside words;
- obvious OCR substitutions;
- broken apostrophes or quotation marks;
- malformed bullets;
- line-break artifacts;
- repeated headers or footers accidentally inserted into body text;
- page numbers embedded in sentences;
- text fragments duplicated by extraction.

Use visual inspection when needed to confirm the correction.

Do not silently guess when the intended wording is uncertain.

If a substantive word, name, number, or phrase cannot be established confidently, preserve the uncertainty rather than inventing a correction.

Use markers such as:

`[unclear]`

or, where useful:

`[uncertain: possible reading]`

Do not overuse uncertainty markers for minor formatting issues that can be resolved confidently from the page.

---

## 5. Do Not Rewrite the Source

Do not:

- summarize;
- paraphrase;
- modernize;
- simplify;
- improve arguments;
- fact-check;
- harmonize inconsistencies;
- correct factual claims;
- rewrite awkward prose;
- change tone;
- convert informal wording into formal wording;
- eliminate substantive repetition;
- silently correct a statement merely because it appears mistaken.

The cleaned Markdown file should reproduce the document's substantive content, not produce a better-written version of it.

---

## 6. Capitalization and Deliberate Emphasis

Do not automatically normalize capitalization in ordinary documents.

Unlike live-caption transcripts, ALL CAPS in a source document may be deliberate typography or emphasis.

Preserve deliberate emphasis when it appears substantively intentional.

If ALL CAPS is used only because an entire heading or design element is typographically styled in capitals, you may represent it as a normal Markdown heading with conventional capitalization when the wording is unambiguous.

Preserve conventional capitalization for proper names, acronyms, agencies, organizations, statutes, case names, and official titles.

Do not convert intentional emphasis into ordinary lowercase merely for stylistic uniformity.

---

## 7. Paragraphs and Line Breaks

Repair line wrapping caused solely by PDF extraction or OCR.

Join lines that belong to the same paragraph.

Preserve genuine paragraph breaks.

Do not preserve a PDF's visual line endings as Markdown line breaks unless they carry meaning.

Do not merge distinct paragraphs simply because the OCR omitted spacing between them.

Use the visible source to determine paragraph boundaries when necessary.

---

# Structural Elements

## 8. Headings

Represent substantive document headings with appropriate Markdown heading levels.

Preserve the hierarchy shown by the source.

Do not create new topical headings merely to improve readability.

Do not flatten an obvious heading hierarchy into plain paragraphs.

---

## 9. Lists and Agendas

Preserve numbered and bulleted structures.

For agendas, witness lists, and similar documents:

- preserve Roman numerals when they are part of the original organization;
- preserve numbered witness order;
- preserve distinctions such as `Public Witnesses` and `Government Witnesses`;
- preserve dates, times, locations, legislation numbers, and official hearing descriptions;
- preserve substantive URLs that appear in the source.

Do not convert an agenda into prose.

Do not omit an item because it appears formulaic.

---

## 10. Tables and Structured Inventories

When the source contains a table, preserve the table as a table whenever Markdown can represent it faithfully.

Maintain:

- column names;
- column order;
- row order;
- row-to-column associations;
- numbers;
- dates;
- amounts;
- case numbers;
- statuses;
- labels;
- totals;
- notes associated with rows or columns.

Do not flatten a table into an undifferentiated paragraph.

For wide or complex tables, use the clearest Markdown representation that preserves the relationships among fields.

If a table cannot be represented reliably as a standard Markdown table because of merged cells, nested headers, or extreme width, use a structured representation that preserves each record and its fields without changing the data.

Never discard columns merely to make the Markdown simpler.

Exercise particular caution with legal, financial, personnel, case, and administrative tables.

A row must not become associated with data from the row above or below.

---

## 11. Charts, Graphs, Images, and Other Visual Material

Charts, graphs, photographs, maps, diagrams, organizational charts, illustrations, presentation graphics, and other substantive visual material must be preserved and reproduced with fidelity whenever technically feasible.

Do not treat OCR, extracted text, a Markdown table, or a narrative description as an automatic substitute for the original visual. Visual arrangement may itself communicate substantive information.

When reproducing a substantive visual, preserve as faithfully as possible:

- the complete visual rather than a cropped or partial version;
- title and subtitle;
- axes and axis labels;
- scales;
- legends and keys;
- categories and series;
- data labels and values;
- annotations;
- captions;
- source notes and credits;
- colors, symbols, line types, shading, or other distinctions when they carry meaning;
- spatial relationships;
- hierarchy;
- connecting lines or arrows;
- labels attached to specific objects or regions;
- other visual relationships necessary to understand the source.

Do not redraw, simplify, beautify, reinterpret, or modernize a visual in a way that changes its evidentiary meaning.

### Visual Reproduction

When the output system permits embedding or preserving images, reproduce substantive charts, photographs, diagrams, maps, organizational charts, and other significant visuals in the cleaned document.

The reproduction should remain faithful to the source. Do not substitute a newly generated approximation when the original visual can be preserved.

If technical limitations prevent faithful reproduction, document that limitation in the audit.

### Structured Transcription

When a chart, graph, diagram, or other visual contains recoverable structured information, also transcribe that information into Markdown when doing so improves searchability, accessibility, or archival usefulness.

For example:

- a data chart may also be represented as a Markdown table;
- an organizational chart may also be represented as a nested hierarchy;
- a labeled diagram may also have its labels and relationships transcribed;
- a map may have clearly stated labels, legend entries, or explicitly identified locations transcribed.

Do not infer numerical values solely from the apparent height, length, position, angle, or area of graphical elements unless the values can be established reliably from labels, scales, or other source evidence.

The structured transcription supplements the visual. It does not replace the visual when the visual itself carries substantive information.

### Narrative Description of Significant Visuals

Determine whether each visual is significant to understanding the document.

A visual should generally be treated as significant when it:

- communicates substantive information not fully conveyed by surrounding text;
- presents evidence, data, comparisons, trends, relationships, or findings;
- depicts an organizational or procedural relationship;
- provides historically, legally, administratively, or contextually meaningful visual evidence;
- is specifically discussed or relied upon in the document;
- materially contributes to understanding the document.

For every visual deemed significant, provide a concise narrative description in addition to reproducing the visual.

The narrative description should explain what the visual shows and the substantive information or relationships it visibly communicates.

For a chart or graph, the description should identify, when supported:

- what is being measured or compared;
- relevant time periods;
- categories or series;
- important visible trends;
- notable comparisons;
- significant explicitly displayed values;
- the relationship among variables;
- source information shown with the visual.

For a photograph or other documentary image, the description should identify:

- the relevant visible subject matter;
- setting or context when visibly established or supplied by the source;
- important objects, signs, text, or features;
- actions visibly occurring;
- the source caption or credit when present and substantive.

For a map, diagram, or organizational chart, the description should explain the principal structure, relationships, branches, flows, locations, or connections shown.

Descriptions must remain descriptive and source-grounded.

Do not:

- speculate about identity when it is not established;
- infer motives or intentions;
- make unsupported causal claims;
- characterize emotions or attitudes without clear support;
- infer trends that the visual does not actually establish;
- add historical or factual context not contained in or otherwise supplied with the source;
- substitute interpretation for description.

If the identity of a person, place, organization, or object is established by a source caption, label, or surrounding document text, that supported identification may be included.

### Decorative and Incidental Visuals

Purely decorative elements do not require reproduction or narrative description unless they have archival or contextual significance.

Examples may include:

- ornamental lines;
- generic background graphics;
- repeated logos used solely as page furniture;
- decorative shapes;
- non-substantive icons.

Do not classify a visual as decorative merely because its information is inconvenient to reproduce.

### Three Distinct Preservation Functions

Treat these as separate functions:

1. **Visual reproduction** preserves what the source looked like and the information encoded visually.
2. **Structured transcription** makes recoverable textual or numerical information searchable and accessible.
3. **Narrative description** explains significant visual content and relationships in words.

One function does not automatically replace the others.

A significant chart may therefore require all three:

- the faithfully reproduced chart;
- a Markdown transcription of its recoverable data;
- a concise narrative description of what the chart visibly communicates.

A significant organizational chart may require:

- the reproduced chart;
- a nested Markdown representation of the hierarchy;
- a narrative description of the principal reporting structure.

A significant photograph may require:

- the reproduced photograph;
- its original caption and credit when present;
- a narrative description of the relevant visible content.

The governing objective is preservation of both the textual and visual evidence contained in the source document.
## 12. Organizational Charts and Hierarchical Diagrams

Organizational charts must be reconstructed from the visual relationships in the source, not merely from OCR reading order.

Preserve:

- the top-level position;
- branches;
- reporting relationships;
- unit names;
- individual names;
- titles;
- subordinate positions;
- vacant positions;
- dates such as `As of` dates.

Represent the hierarchy in Markdown using nested bullets or another clear hierarchical structure.

Do not infer a reporting relationship solely because two titles appear near each other in extracted text.

If the visual structure is ambiguous, flag the uncertainty rather than inventing a hierarchy.

---

## 13. Presentation and Slide Decks

For a presentation, preserve the slide sequence.

Use each slide title as an appropriate Markdown heading.

Retain substantive:

- bullets;
- sub-bullets;
- tables;
- charts;
- quotations;
- callouts;
- source notes;
- footnotes;
- dates;
- labels.

Do not summarize each slide.

Do not omit a slide merely because it is a section divider. Preserve meaningful section-divider titles.

Routine repeated design elements such as company logos, decorative shapes, and repeated copyright/page-number furniture may be omitted unless they carry substantive information.

If a slide contains a table or chart, reconstruct the table or chart information from the rendered slide rather than relying only on linear OCR text.

---

## 14. Forms and Labeled Fields

For forms or field-based documents, preserve each meaningful label and its associated value.

Do not detach values from their labels.

Represent checkboxes, selections, or marked fields only when their state can be determined confidently.

If a field is blank in the source, do not invent a value.

---

## 15. Footnotes, Endnotes, Sources, and Citations

Preserve substantive footnotes, endnotes, source notes, and citations.

Place them near the relevant text when practical, or preserve them in a clearly labeled notes section if that more faithfully reflects the source.

Do not discard a source note because it appears in small type.

For slide decks and reports, source lines beneath charts and tables should be retained when substantive.

---

## 16. Hyperlinks

Preserve hyperlinks when they are part of the substantive document.

If visible anchor text has an embedded hyperlink and the target is available, preserve the link in Markdown.

Do not retain purely navigational, tracking, or conversion-system links that were not part of the source document.

---

# Material That May Be Removed

## 17. Remove Only Non-Substantive Artifacts

Remove material that clearly exists because of extraction, OCR, scanning, or file conversion rather than because it is part of the document.

Examples include:

- duplicated page numbers;
- repeated running headers or footers that add no substantive information;
- duplicated copyright marks repeated on every page when they function only as page furniture;
- OCR confidence text;
- scanner annotations;
- conversion watermarks added by a processing system;
- meaningless glyphs;
- duplicated bullets;
- blank extraction fragments;
- page-image filenames;
- accidental repeated text;
- navigation controls or viewer chrome captured from a webpage.

Do not remove source material merely because it appears on every page if it has substantive significance.

---

# Fidelity Audit

## 18. Perform a Page-by-Page Fidelity Audit

After producing the cleaned Markdown file, compare it against the source from beginning to end.

For a paginated source, audit page by page.

Verify that all substantive content has been preserved and that the Markdown representation has not altered relationships encoded by layout.

Do not use word-count similarity as evidence of fidelity.

---

## 19. Audit According to Document Type

For prose documents, verify every paragraph, heading, quotation, name, date, number, meaningful emphasis, footnote, and citation.

For agendas and witness lists, verify every agenda item, witness, role and title, numbering, meeting metadata, and substantive URL.

For tables and inventories, verify every column, row, field, row alignment, total, status, case number, and amount.

For organizational charts, verify every position, named person, unit, reporting relationship, vacant position, and hierarchy.

For presentations, verify every slide, slide order, title, bullet, table, chart value or label, significant image, and source note.

For all significant visual material, verify that the visual reproduction is faithful, that no meaningful portion was inadvertently cropped or omitted, that any structured transcription preserves the visible data or relationships, and that the narrative description is accurate, source-grounded, and does not introduce unsupported interpretation.

---

## 20. High-Risk Fields

During the audit, specifically check:

- personal names;
- agency names;
- union names;
- school names;
- case names;
- case numbers;
- legislation numbers;
- dates;
- times;
- dollar amounts;
- percentages;
- counts;
- totals;
- statuses;
- table row associations;
- chart labels;
- organizational reporting relationships;
- chart scales and legends;
- chart and graph values;
- diagram relationships;
- map labels and legends;
- significant image content;
- captions and image credits;
- narrative descriptions of significant visuals.

Do not silently repair uncertain high-risk fields.

If the source remains ambiguous, preserve or flag the ambiguity.

---

# Markdown Output

## 21. Markdown Style

Use straightforward Markdown optimized for reading, searching, and archival use.

Use headings for source headings, normal paragraphs for prose, Markdown lists for lists, Markdown tables for tabular data when feasible, nested lists for hierarchical diagrams, Markdown links for substantive hyperlinks, and restrained bold or italics when they correspond to meaningful source emphasis.

Do not reproduce decorative layout merely for appearance.

Do preserve layout-derived relationships when they affect meaning.

---

## 22. Output Filename

Create one cleaned Markdown file for each source document.

Use the original base filename and append:

` [cleaned].md`

Replace the original extension rather than adding `.md` after it.

Example:

`Q.56_OLRCB Litigation & Related Matters.pdf`

becomes:

`Q.56_OLRCB Litigation & Related Matters [cleaned].md`

Do not overwrite the original source.

---

## 23. Batch Processing

When multiple dirty documents are selected:

- process each source independently;
- determine the appropriate structural treatment for each file independently;
- do not assume all files in the batch share the same format;
- audit each file separately;
- continue processing other files if one source contains unresolved problems.

One difficult document must not prevent the rest of the batch from completing.

---

## 24. Completion Status

For each file, internally record one of:

- `Cleaned and verified`
- `Cleaned and verified with uncertainties`
- `Unable to verify`

Use `Cleaned and verified with uncertainties` when the document can be reconstructed but one or more substantive words, values, relationships, or structural elements remain uncertain.

Use `Unable to verify` when the source is too damaged or ambiguous to produce a sufficiently faithful Markdown representation.

---

## 25. Destination Folder

When all selected dirty documents have been processed, save the cleaned Markdown files into a new folder in the user's Downloads folder named:

`Cleaned Documents - YYYY.MM.DD HH.MM.SS`

Use the current local date and time to make the folder unique.

---

## Governing Principle — Dirty Documents

The Markdown output must preserve not only the words in the source, but also the substantive relationships and visual evidence communicated by the source's structure, charts, images, diagrams, maps, and other significant visual material.

Significant visuals should be reproduced with fidelity and accompanied by a concise narrative description. Where useful and reliably recoverable, their structured information should also be transcribed into Markdown.

When OCR text and visual organization conflict, inspect the source visually.

When stylistic simplification would destroy meaning, preserve structure.

When a correction is clear, repair it.

When a correction is uncertain, do not guess.


# DIRTY HEARING TRANSCRIPTS

Clean each transcript individually. Ultimately, produce one clean Markdown transcript for each source hearing transcript.

A dirty hearing transcript may originate from live captions, automated speech recognition, OCR, copied web captions, TXT exports, DOCX files, PDFs, or other imperfect transcript sources. Different files may contain very different kinds and degrees of corruption.

Do not apply one simple mechanical cleanup rule to every transcript. Examine each transcript independently and reconstruct a readable transcript while preserving the substance of what was actually said.

The objective is:

**Preserve the hearing faithfully while removing mechanical transcription and caption artifacts.**

This is transcript restoration and formatting, not summarization or rewriting.

---

## 1. Determine the Hearing Identity

Before cleaning the body, determine from the available source material, when possible:

- hearing date;
- committee;
- hearing type;
- official or most appropriate hearing title;
- chair or presiding member;
- major agencies or subjects involved.

Use information contained in the source file itself when available.

Do not invent missing metadata.

If the date or hearing title cannot be established confidently, retain the best-supported information available and flag the unresolved metadata internally for the app’s completion report.

---

## 2. Preserve the Complete Substantive Hearing

Retain the complete substantive hearing from beginning to end.

This normally includes:

- the chair’s opening and call to order;
- hearing notices or descriptions read into the record;
- opening statements by councilmembers;
- introductions of witnesses;
- witness testimony;
- administration of oaths;
- questions and answers;
- exchanges among councilmembers, witnesses, agency representatives, staff, or other participants;
- substantive procedural statements;
- recesses or resumptions when they are part of the hearing record;
- interruptions when substantively meaningful;
- corrections made by speakers;
- closing statements;
- statements concerning the record;
- adjournment.

Do not delete material merely because it is procedural, repetitive in subject matter, informal, awkwardly phrased, or not directly related to the main policy topic.

The cleaned transcript should remain a transcript of the hearing, not an edited summary of the hearing.

---

# Transcript Restoration

## 3. Remove Mechanical Live-Caption Buildup and Duplication

Live-caption systems frequently generate successive partial versions of the same utterance.

For example, a dirty source may effectively contain:

`I'M`

`I'M CALLING`

`I'M CALLING TO`

`I'M CALLING TO ORDER`

`I'M CALLING TO ORDER THIS MEETING`

This represents one utterance:

`I'm calling to order this meeting.`

Collapse cumulative caption buildup into the most complete supported utterance.

Also remove:

- duplicated words caused by caption refresh;
- duplicated phrases caused by caption refresh;
- repeated sentence fragments caused by overlapping caption windows;
- partial-word buildup;
- successive partial versions of the same sentence;
- duplicated speaker labels;
- duplicated punctuation generated by extraction;
- portions of previous caption lines repeated at the beginning of subsequent lines.

Do not require exact character-for-character duplication before recognizing caption buildup. Caption windows can overlap imperfectly.

Determine whether repetition is mechanical by examining sequence, overlap, syntax, and context.

### Mechanical Repetition vs. Spoken Repetition

Remove repetition only when it is clearly a transcription or caption artifact.

Preserve repetition when the speaker actually repeats something for:

- emphasis;
- correction;
- hesitation;
- rhetorical effect;
- clarification;
- restarting a thought;
- answering an interruption;
- deliberately repeating a number, name, question, or point.

For example:

`No, no, that's not what I'm saying.`

should remain repeated if the repetition appears to have been spoken.

When uncertain whether repetition is mechanical or substantive, favor preservation.

---

## 4. Restore Normal Capitalization

Convert caption-style ALL CAPS, all-lowercase text, or inconsistent capitalization into normal written capitalization.

Correct:

- sentence beginnings;
- the pronoun `I`;
- personal names;
- governmental entities;
- agencies;
- offices;
- committees;
- councils;
- boards;
- unions;
- schools;
- organizations;
- courts;
- statutes;
- programs;
- geographic names;
- formal titles when used as part of a name;
- recognized acronyms.

Examples include:

- `District of Columbia Public Schools`
- `Office of Employee Appeals`
- `Public Employee Relations Board`
- `D.C. Council`
- `Washington Teachers' Union`
- `DCPS`
- `OEA`
- `PERB`
- `WTU`
- `CBA`

Do not preserve ALL CAPS merely because the caption source used ALL CAPS.

Likewise, do not preserve erroneous lowercase forms such as:

`phil mendelson`

when the transcript clearly establishes:

`Phil Mendelson`

Use ordinary lowercase for generic references such as:

- `the agency`;
- `the council`;
- `the board`;
- `the union`;
- `the chair`;
- `the superintendent`;

unless the context establishes that the wording is being used as a formal name or title.

---

## 5. Correct Mechanical Spacing and Punctuation

Add or repair punctuation and spacing necessary to make the transcript readable.

This includes:

- sentence-ending punctuation;
- commas;
- apostrophes;
- quotation marks when clearly required;
- spaces between words;
- malformed contractions;
- obvious extraction line breaks;
- punctuation separated incorrectly from words;
- duplicated punctuation.

Join lines that were broken solely because of caption or page formatting.

Do not treat every source line as a paragraph.

Do not change substantive wording merely to create more elegant prose.

---

## 6. Restore Paragraph Structure

Create normal readable paragraphs within each speaker’s turn.

Use paragraph breaks when the speaker:

- changes subject;
- begins a distinct argument;
- moves from prepared testimony to another point;
- begins a new question;
- changes from one example to another;
- shifts from background to analysis;
- makes a substantial rhetorical transition;
- speaks for long enough that one continuous paragraph would impair readability.

Do not create a separate paragraph for every caption line.

Do not collapse an extended speech or prepared testimony into one enormous paragraph.

Preserve the sequence of the original speech.

---

# Speaker Identification

## 7. Identify Speakers Whenever the Source Supports Identification

Every substantive speaker turn should receive a speaker label whenever the speaker can be established with reasonable confidence.

Use evidence from the entire surrounding transcript, not merely the individual caption line.

Relevant evidence may include:

- explicit introductions;
- witness lists;
- self-identification;
- the chair calling on a person;
- another participant addressing the person by name;
- a sequence of questions and answers;
- role descriptions;
- testimony introductions;
- oath administration;
- statements such as `Councilmember Allen?`;
- statements such as `Director Barfield, please proceed`;
- later context that clearly resolves an earlier anonymous turn.

If someone says:

`My name is Paul Blake. I'm the agency fiscal officer...`

subsequent clearly attributable turns may be labeled:

`**Paul Blake:**`

even if the raw caption source contains only `>>`.

---

## 8. Speaker-Label Hierarchy

Use the most specific supported speaker identity.

Prefer, in order:

1. person’s name;
2. person’s established title plus name when helpful;
3. established role;
4. generic role;
5. `Unknown Speaker`.

Examples:

`**Chair Phil Mendelson:**`

`**Councilmember Charles Allen:**`

`**Sheila Barfield:**`

`**Agency Representative:**`

`**Witness:**`

`**Unknown Speaker:**`

Do not invent a person’s identity simply because the likely speaker can be guessed from the hearing topic.

If the evidence supports the role but not the name, use the role.

If neither can be established safely, use:

`**Unknown Speaker:**`

rather than assigning speech to the wrong person.

---

## 9. Keep Speaker Names Consistent

Once a speaker has been confidently identified, use one consistent label throughout the transcript.

Do not alternate among caption variants such as:

- `MR. MENDELSON`
- `CHAIR`
- `CHAIRMAN`
- `MENDELSON`
- `PHIL`

when they all refer to the same person and the identity is established.

Select an appropriate canonical label and use it consistently.

Formal titles may be retained when useful to distinguish participants.

---

## 10. Preserve Rapid Exchanges Accurately

Do not merge separate speakers simply because their statements occur on the same source line.

Raw captions may contain:

`>> yes. >> thank you. >> I have another question.`

These may represent three separate turns.

Determine speaker transitions from context and preserve each turn separately.

Questions must not be merged into answers.

Answers must not be attributed to the questioner.

Interruptions must not be silently reassigned.

When speaker identity cannot be determined, preserve the transition with an appropriate generic or unknown speaker label rather than merging the speech.

---

# Textual Correction

## 11. Correct Obvious Transcription Errors Only When the Intended Wording Is Clear

Automated transcripts frequently contain speech-recognition errors.

You may correct an error when the intended wording is strongly supported by context.

Examples may include:

- obviously malformed contractions;
- a proper name whose correct spelling is established elsewhere in the transcript;
- an agency acronym established elsewhere;
- a word split incorrectly by extraction;
- a caption error that produces an impossible grammatical fragment when the intended word is unambiguous;
- duplicated fragments caused by ASR processing.

Use contextual evidence from elsewhere in the transcript whenever possible.

---

## 12. Do Not Silently Guess at Uncertain Substantive Words

Be substantially more conservative when changing:

- names;
- dollar amounts;
- dates;
- percentages;
- counts;
- legal citations;
- bill numbers;
- statute names;
- agency names;
- school names;
- technical terminology;
- quotations;
- words where two or more plausible readings would alter meaning.

If the source is unclear, preserve uncertainty.

Use:

`[unclear]`

`[inaudible]`

or, when useful:

`[uncertain: possible wording]`

Do not manufacture fluent language merely because the source language is awkward.

A grammatically strange statement may have actually been spoken that way.

---

## 13. Preserve False Starts When They Are Genuinely Spoken

Distinguish live-caption buildup from spoken false starts.

A real spoken passage such as:

`What I'm asking—let me put it another way. Why wasn't this corrected last year?`

should retain the restart.

Do not automatically transform it into:

`Why wasn't this corrected last year?`

False starts, corrections, hesitations, and reformulations may contain substantive information about how the speaker framed the question.

Remove only false-start fragments demonstrably created by caption rendering rather than speech.

---

## 14. Preserve Substantive Corrections

If a speaker corrects themselves, retain the correction.

For example:

`The amount is $69,000—I'm sorry, $92,851.`

Do not silently replace the entire statement with:

`The amount is $92,851.`

The correction is part of the hearing record.

Similarly preserve:

- revised dates;
- corrected names;
- corrected figures;
- changed answers;
- qualifications added after an initial statement.

---

## 15. Preserve Numbers Exactly Unless Correction Is Strongly Supported

Exercise particular caution with:

- dollar amounts;
- dates;
- percentages;
- fiscal years;
- counts;
- vote totals;
- bill numbers;
- telephone numbers;
- statutory references.

Do not infer a number merely because another number seems more plausible.

If the transcript contains conflicting numbers and the speaker appears to correct the figure, preserve the correction sequence.

If the transcription of the number itself is uncertain, mark it as uncertain rather than silently substituting another value.

---

# Proper Names and Formal Terminology

## 16. Normalize Supported Proper Names

When a name or title is established elsewhere in the source, use its correct spelling and capitalization consistently.

This includes people, agencies, offices, committees, organizations, schools, unions, legislation, programs, and governmental entities.

For example, if a witness is clearly introduced as:

`Hemchand Hemraj`

later caption variants should not remain:

`hemshan hemraj`

when the intended identity is established.

However, do not make such a correction merely because two names sound similar. There must be sufficient contextual support.

---

## 17. Acronyms

Restore conventional capitalization for acronyms that are supported by the transcript.

Examples:

- `DCPS`
- `OEA`
- `PERB`
- `WTU`
- `OSSE`
- `CFO`

Do not invent an acronym.

Do not expand an acronym unless the expansion is stated in the source or otherwise directly supported by the source material available to the cleaner.

If both full name and acronym appear naturally in the hearing, preserve that usage.

---

## 18. Titles and Honorifics

Normalize mechanically corrupted honorifics such as:

- `MR.`
- `MISS`
- `DR.`

when necessary for readability.

Do not introduce honorifics that are not supported by context.

Where the app uses a speaker-label convention such as:

`**Councilmember Allen:**`

it is not necessary to reproduce caption-style `MR. ALLEN` every time.

---

# Markdown Style

## 19. Speaker Format

Format speaker turns as:

`**Speaker Name:** Speech begins here.`

For longer turns:

`**Speaker Name:** First paragraph of the speaker's remarks.`

`Second paragraph of the same speaker's remarks.`

Do not repeat the speaker label before every paragraph of the same uninterrupted turn.

Add a new speaker label whenever the speaker changes.

---

## 20. Hearing Title

When the hearing identity is known, begin with a concise Markdown heading:

`# YYYY.MM.DD Hearing Name`

Do not invent a hearing title.

Use the official hearing title when the source provides one.

---

## 21. Formal Segments

Retain clearly established formal hearing segments when useful, but do not over-structure the transcript.

Possible headings include:

- `## Opening Statements`
- `## Public Witnesses`
- `## Government Witnesses`
- `## Office of Employee Appeals`

Use such headings only when they are actually supported by the hearing’s organization.

Do not manufacture topical headings for every subject discussed.

---

## 22. Stage Directions and Nonverbal Events

Retain meaningful nonverbal information when present, including:

- `[Laughter]`
- `[Applause]`
- `[Poor audio]`
- `[Inaudible]`
- `[Recess]`

when it contributes to understanding the hearing.

Remove purely mechanical caption-system messages that do not represent the hearing.

Do not invent stage directions.

---

# Material to Remove

## 23. Remove Transcription-System Artifacts

Remove material that exists solely because of the caption or extraction system, including:

- cumulative caption refresh text;
- duplicated caption windows;
- isolated caption control text;
- timestamps that are purely system-generated unless timestamps are specifically requested;
- meaningless line numbers introduced by extraction;
- duplicated headers and footers;
- repeated page furniture;
- player controls;
- webpage navigation accidentally captured with the transcript;
- social-media sharing controls;
- unrelated website material;
- encoding debris;
- meaningless extraction symbols.

Do not remove substantive hearing speech merely because it discusses Zoom, livestreaming, technical problems, scheduling, or hearing procedure.

If participants actually said it during the hearing, it is ordinarily part of the transcript.

---

# What Not to Do

## 24. Do Not Rewrite the Speakers

Do not:

- summarize;
- paraphrase;
- shorten testimony;
- improve arguments;
- modernize language;
- remove politically or legally significant wording;
- convert informal speech into formal prose;
- eliminate substantive redundancy;
- change a speaker’s tone;
- add facts;
- fact-check the speakers inside the transcript;
- harmonize conflicting testimony;
- resolve disputed claims;
- silently substitute what the cleaner believes the speaker meant.

The cleaned transcript should sound like the people who spoke at the hearing, not like an editor rewriting them.

---

# Fidelity Audit

## 25. Perform a Separate Sequential Fidelity Audit

After producing the cleaned transcript, perform a separate audit against the dirty source.

Do not rely on word-count similarity.

Compare the dirty source and cleaned transcript sequentially from beginning to end.

For each source segment, determine what substantive utterance or utterances the caption material represents and confirm that each appears in the cleaned transcript.

Caption buildup may occupy many times more text than the corresponding spoken sentence. That is acceptable.

The relevant question is not whether the cleaned transcript has a similar number of words.

The relevant question is:

**Has every substantive spoken utterance been preserved?**

---

## 26. Specifically Verify Preservation Of

Check every section for:

- every question;
- every answer;
- every speaker turn;
- every substantive interruption;
- qualifications;
- caveats;
- hedges;
- exceptions;
- corrections;
- examples;
- illustrative details;
- names;
- titles;
- dates;
- times;
- fiscal years;
- percentages;
- dollar amounts;
- counts;
- other numerical information;
- agency names;
- office names;
- committee names;
- union names;
- board names;
- court references;
- statutes;
- regulations;
- cases;
- legislation;
- legal terminology;
- changes of topic;
- material expressions of uncertainty;
- wording whose alteration could affect meaning, responsibility, chronology, certainty, degree, or legal significance.

---

## 27. Audit Speaker Attribution Separately

During the audit, specifically inspect:

- every transition from one speaker to another;
- rapid exchanges;
- interruptions;
- unidentified `>>` turns;
- places where captions combine multiple speakers on one line;
- places where a speaker’s identity was inferred from surrounding context.

Confirm that no speech has accidentally been:

- assigned to the wrong person;
- merged into another speaker’s remarks;
- separated from its actual speaker;
- omitted because the speaker could not be identified.

If identity remains uncertain, use `Unknown Speaker` or the best-supported role rather than guessing.

---

## 28. Audit Caption Deduplication Separately

Review every substantial deletion caused by duplication removal.

Confirm that the deleted language represents:

- caption buildup;
- overlapping caption windows;
- duplicated transcription;
- repeated partial fragments;

and not an actual repeated utterance.

Substantive repetition must remain.

---

# Final Verification Pass

## 29. Before Finalizing Each Transcript, Search Specifically For

- accidental omissions;
- merged speakers;
- misattributed speakers;
- missing questions;
- missing answers;
- missing qualifications;
- missing corrections;
- altered numbers;
- altered dollar amounts;
- altered dates;
- altered names;
- malformed proper nouns;
- lowercase acronyms;
- remaining ALL-CAPS caption text;
- remaining cumulative caption duplication;
- excessive one-line caption formatting;
- giant unstructured paragraphs;
- accidental paraphrasing;
- invented wording;
- substantive repetitions mistakenly removed;
- unresolved garbled passages that should be marked `[unclear]` or `[inaudible]`.

If the final verification results in a substantive correction, recheck that corrected section directly against the dirty source before completing the file.

Do not mark a transcript as successfully verified until this pass is complete.

---

# Conventional Italics

## 30. Apply Italics Conservatively

Use conventional Markdown italics when appropriate.

Italicize:

- case names, such as `*Smith v. District of Columbia*`;
- titles of books;
- titles of newspapers;
- titles of journals;
- formally titled standalone publications when confidently identified;
- established Latin legal terms when conventional legal style calls for italics.

Do not italicize:

- statutes;
- regulations;
- legislation;
- agencies;
- committees;
- councils;
- acronyms;
- ordinary quotations;
- words merely because a speaker emphasized them orally.

When uncertain, do not add italics.

---

# Output Requirements — Dirty Hearing Transcripts

## 31. Output Format

Create one cleaned Markdown file for every source transcript.

Do not combine separate hearings into one file.

Do not insert:

- a summary;
- an editorial note;
- an explanation of changes;
- a fidelity report;
- cleaning statistics;
- app commentary;

into the cleaned transcript itself.

The Markdown file should contain only the cleaned transcript and appropriate transcript metadata/headings.

---

## 32. Filename

The preferred archival filename is:

`YYYY.MM.DD Hearing Name [cleaned].md`

Use the hearing date and official or best-supported hearing name.

Prefer, in order:

1. the official title contained in the source;
2. an official title supplied in source metadata;
3. the clearest hearing name supported by the transcript.

Preserve useful distinctions such as:

- `Performance Oversight Hearing`;
- `Budget Oversight Hearing`;
- `Public Hearing`;
- `Public Roundtable`;
- `Roundtable`.

Example:

`2026.02.04 Performance Oversight Hearing - Office of Employee Appeals [cleaned].md`

Do not invent a date or hearing title.

If the incoming filename already accurately supplies the hearing date and title, retain that base filename and append:

` [cleaned]`

immediately before `.md`.

---

## 33. Destination Folder

When all selected hearing transcripts have been processed, save the cleaned Markdown files into a new folder in the user’s Downloads folder named:

`Cleaned Hearing Transcripts - YYYY.MM.DD HH.MM.SS`

Use the current local date and time to create a unique identifier so that an existing output folder is never overwritten.

Example:

`Cleaned Hearing Transcripts - 2026.08.27 14.30.00`

---

## 34. Batch Processing

When multiple transcripts are selected:

- process each transcript independently;
- do not allow speaker identities, hearing metadata, dates, terminology, or corrections from one hearing to contaminate another hearing;
- run the complete cleanup and fidelity audit on each transcript separately;
- save each completed transcript separately;
- continue processing other files if one file contains unresolved passages.

One difficult transcript should not prevent successful transcripts in the batch from being completed.

---

## 35. Completion Status

For each input file, the app should internally record one of the following statuses:

- `Cleaned and verified`
- `Cleaned and verified with uncertainties`
- `Unable to verify`

Use `Cleaned and verified with uncertainties` when the transcript can be completed but contains unresolved `[unclear]`, `[inaudible]`, uncertain speaker identities, or uncertain metadata.

Use `Unable to verify` only when corruption is severe enough that the app cannot establish a sufficiently faithful transcript.

Do not represent an uncertain transcript as fully verified.

---

## 36. User-Facing Completion Report

After processing is finished, the app should display a concise completion report showing:

- number of input files;
- number successfully cleaned;
- number containing unresolved uncertainties;
- number that could not be verified;
- destination folder;
- filenames produced.

For transcripts containing unresolved uncertainty, identify the affected file and briefly state the type of uncertainty.

Do not insert this report into the Markdown transcript itself.

---

## Governing Principle — Dirty Hearing Transcripts

When choosing between producing smoother prose and preserving the evidentiary fidelity of the hearing, preserve fidelity.

Correct what is clearly mechanical.

Restore what can be established confidently.

Flag what cannot be established confidently.

Never make an uncertain transcript appear more certain than the source permits.

---

# DIRTY BEACON ARTICLE

If a batch is supplied, process each input item independently and completely before moving to the next item.

The ARTICLE path is for a source that represents one discrete Beacon article or item rather than an entire issue.

## 1. Inspect the Source

Inspect the image or PDF file to determine its condition and complexity and to determine the most appropriate OCR approach or model.

If the source is an image, create a PDF from the image as part of this step.

Inspect visually for page count, columns, headline, byline, article boundaries, continuation notices, photographs and captions, page damage, skew, low contrast, unusual typography, and OCR difficulty.

Do not rely solely on an existing text layer.

## 2. Create the Output Folder and Preserve the Source

For a single item, create a folder within the user's Downloads folder using the base name of the PDF, without the `.pdf` extension.

Copy the original PDF into that folder.

If the source began as an image, preserve the original image when practical and also save the PDF created from it.

For a batch, create one parent folder named:

`Batch - YYYY.MM.DD HH.MM.SS`

Within that batch folder, create a separate subfolder for each input item using that item's base filename.

Use the current local date and time to make the batch identifier unique.

Never overwrite an existing folder or source file.

## 3. OCR or Re-OCR the Article

OCR or re-OCR the PDF, even if it already contains a text layer, when doing so can materially improve extraction.

Use the OCR approach or model best suited to the source complexity observed during inspection.

Visually verify difficult regions as needed.

Save the improved PDF in the item's folder.

Use the same base filename and append:

` [improved].pdf`

Do not replace or overwrite the original PDF.

## 4. Produce the Article Markdown File

Produce one Markdown file for the discrete Beacon article represented by the input item.

Do not split a single article into multiple Markdown files merely because it spans pages or columns.

Use the OCR text as the working transcription, but verify reading order visually.

Carefully reconstruct the headline, subtitle or dek when present, byline, publication date when present, body text, section headings, quotations, meaningful lists, and photo captions or credits when they substantively belong to the article.

Follow columns in the correct reading order.

If the article continues on another page, combine the continuation with the original article in one Markdown file.

A purely navigational continuation notice such as `continued on page...` may be omitted after the continuation has been reunited with the article.

Correct garbled OCR when the intended text can be established confidently from the page.

Do not summarize, rewrite, modernize, or improve the journalism.

When wording is uncertain, preserve the best-supported reading and flag unresolved uncertainty rather than inventing text.

Name the Markdown file from the source item's base filename, replacing the source extension with `.md`.

Save the Markdown file in the item's output folder.

## 5. Create `audit.md`

Create an `audit.md` file in the item's output folder.

The audit should state whether source inspection succeeded, whether the original source was preserved, whether OCR or re-OCR completed successfully, whether the improved PDF and Markdown article were created successfully, whether columns or continuation pages required special reconstruction, whether any text remains uncertain or illegible, and any substantive decisions or failures.

Do not claim full success when unresolved problems remain.

## Governing Principle — Beacon Article

Preserve the article as a single coherent historical document.

Use visual inspection to resolve columns, continuation pages, captions, and OCR uncertainty.

Do not allow OCR reading order to override the visible article structure.

# DIRTY BEACON ISSUE

The ISSUE path is for one complete Beacon issue.

## 1. Inspect the Issue

Inspect the image or PDF file before processing.

If the source is an image or set of images representing the issue, create a PDF in correct page order.

Determine, as far as possible, publication date, volume and issue number, total page count, page order, article layout, column structure, masthead location, continuation patterns, advertisements, photographs and captions, and damaged or difficult pages.

Do not rely solely on an existing text layer.

## 2. Create the Output Folder and Preserve the Original

Create a folder within the user's Downloads folder using the base filename of the issue PDF, without the `.pdf` extension.

Copy the original PDF into this folder.

If the issue was created from source images, preserve those original images when practical and save the newly created source PDF as well.

Never overwrite the original source.

## 3. OCR or Re-OCR the Complete Issue

OCR or re-OCR the issue, even if it already has a text layer, when doing so can materially improve extraction.

Use the OCR approach or model best suited to the source complexity observed during inspection.

Use visual inspection to resolve multi-column pages, unusual fonts, photographs intersecting columns, continuation pages, skewed or degraded text, and page-order problems.

Save the improved issue PDF in the output folder using the same base filename with:

` [improved].pdf`

appended.

Do not overwrite the original PDF.

## 4. Identify All Articles and the Masthead

Inventory the issue before extraction.

Identify every substantive article or editorial item that belongs to the issue, plus the masthead.

Ignore advertisements and purely promotional material.

Treat each discrete article as one item even when it spans multiple columns, continues on another page, is interrupted by advertisements, includes photographs or captions, or crosses a page break.

Do not mistake an advertisement, caption, unrelated neighboring article, or continuation from another article for part of the target article.

Do not omit an article merely because it is short.

## 5. Produce One Markdown File Per Article

For each article, reconstruct the correct reading order from the visible page, follow columns carefully, combine all continuation segments into one file, and preserve headline, subtitle or dek when present, byline, substantive section headings, complete article text, meaningful quotations and lists, and photo captions and credits when they belong to the article.

Use the OCR text as the working transcription, but visually verify confusing passages and page transitions.

Correct garbled OCR only when the intended wording is sufficiently supported.

Do not summarize, rewrite, modernize, or embellish the article.

Do not silently invent missing words.

When text remains uncertain, flag that uncertainty.

Name each article:

`YYYY.MM.DD Article Title.md`

Use the publication date printed or otherwise reliably established for the issue.

Sanitize only filename characters that the operating system cannot accept.

Save each article Markdown file in the issue folder.

## 6. Produce the Masthead Markdown File

Create one separate Markdown file containing the masthead information.

Preserve substantive names, roles, positions, publication information, and other editorial or production credits.

Use:

`YYYY.MM.DD Masthead.md`

when the issue date is known.

Do not combine the masthead with an article.

## 7. Verify Article Completeness

Before considering the issue complete, perform an issue-level audit.

Check the issue page by page to verify that every substantive article has been identified, every article has a corresponding Markdown file, continuation pages have been reunited correctly, no article has been truncated or contaminated by a neighboring article or advertisement, columns have been read in the correct order, the masthead has been captured, and unresolved OCR uncertainties are documented.

Do not use the number of extracted files alone as proof of completeness.

## 8. Create `audit.md`

Create an `audit.md` file in the issue folder.

The audit should include issue identity, publication date, volume and issue number when established, source page count, whether the original PDF was preserved, OCR/re-OCR status, improved PDF filename, number and list of article files produced, masthead filename, continuation-page decisions, difficult pages or columns, unresolved OCR or metadata uncertainties, omitted advertisements or clearly non-editorial material, and failures if any.

If the issue appears incomplete or an article cannot be recovered reliably, state that explicitly.

## Governing Principle — Beacon Issue

The unit of preservation is the complete issue and each discrete article within it.

Use the visible issue to establish article boundaries, reading order, and continuation.

Never let linear OCR extraction scramble the newspaper's column structure.

# DIRTY BEACON VOLUME

The VOLUME path is for a PDF containing multiple Beacon issues that together constitute all or part of a volume.

Process the volume in checkpoints. Preserve each successfully completed issue before beginning the next issue.

## 1. Inspect the Complete Volume

Inspect the complete PDF visually before splitting it.

Determine, as far as possible, volume number, number of issues present, issue boundaries, issue numbers, publication dates, page order, missing or duplicated pages, covers or separator pages, masthead patterns, and whether the volume appears complete.

Do not assume that issue boundaries occur at fixed page intervals.

Use printed issue metadata, mastheads, dates, page numbering, repeated title pages, and other source evidence to identify boundaries.

## 2. Create the Volume Output Folder and Preserve the Original

Create a folder within the user's Downloads folder using the base filename of the volume PDF, without the `.pdf` extension.

Copy the original complete volume PDF into this folder.

Never overwrite the original source.

## 3. Split the Volume Into Individual Issue PDFs

Split the complete volume PDF into one source PDF for each identifiable issue.

Determine the volume and issue number from the source as accurately as possible.

Name each split source issue:

`Volume [volume number] Issue [issue number].pdf`

If the volume number or issue number cannot be established confidently, use the best-supported partial filename and document the uncertainty in the audit rather than inventing a number.

For archival clarity, create one subfolder for each issue inside the volume folder, named using the same base name as the split issue PDF.

Save that issue's split source PDF in its issue subfolder.

This prevents article, masthead, and audit filenames from different issues from colliding and keeps each issue self-contained.

## 4. OCR or Re-OCR Each Issue Separately

Process issue PDFs sequentially.

For each issue:

1. inspect the split issue PDF;
2. OCR or re-OCR it, even if it already has a text layer, when improvement is needed;
3. use the OCR approach or model best suited to that issue's page condition and layout;
4. visually verify difficult pages;
5. save the improved issue PDF before proceeding to the next issue.

Name the improved file:

`Volume [volume number] Issue [issue number] [improved].pdf`

Save it in the corresponding issue subfolder.

Complete and save one issue's improved PDF before starting OCR on the next issue.

Do not overwrite the split source issue PDF.

## 5. Process Each Issue Separately in Sequential Order

Only after all issue PDFs have been successfully split and their improved versions saved should article extraction begin.

Process issues in sequential issue order.

For each issue, identify the publication date, every substantive article or editorial item, and the masthead. Ignore advertisements and purely promotional material.

Reconstruct multi-column reading order visually. Combine continuation segments across pages. Preserve headlines, bylines, article text, section headings, quotations, lists, and meaningful captions.

Correct OCR errors only when the intended wording can be established.

Do not summarize, rewrite, modernize, or embellish.

Each discrete article must remain one Markdown file even when it continues across multiple pages.

Name each article:

`YYYY.MM.DD Article Title.md`

Create the masthead as:

`YYYY.MM.DD Masthead.md`

Save all article and masthead Markdown files inside that issue's subfolder.

## 6. Perform an Issue-Level Audit Before Moving On

After extracting an issue, audit that issue page by page before beginning article extraction for the next issue.

Verify issue identity, page range, page order, publication date, every article, every continuation, masthead, correct column order, absence of advertisement contamination, OCR uncertainties, titles, bylines, and generated filenames.

Preserve each completed issue as a stable checkpoint.

One difficult later issue must not invalidate or overwrite earlier completed issues.

## 7. Create the Volume-Level `audit.md`

Create a volume-level `audit.md` in the root volume folder after all possible issues have been processed.

The audit should include source volume filename, volume number when established, source page count, number of issues identified, issue boundaries or source page ranges, issue numbers and publication dates, split issue filenames, improved issue PDF filenames, number of articles produced for each issue, masthead file for each issue, missing, duplicated, or uncertain issues, uncertain issue boundaries, OCR failures or difficult pages, unresolved article text, any issue that could not be fully processed, and substantive decisions made while splitting or reconstructing the volume.

Each issue subfolder may also contain its own `audit.md` if issue-specific detail is useful. The root `audit.md` should provide the overall volume-level accounting.

## Governing Principle — Beacon Volume

Treat the complete volume as an archival container composed of discrete issues, and treat each issue as a self-contained archival unit.

Establish issue boundaries from source evidence rather than assumptions.

Save each issue's source PDF, improved PDF, articles, masthead, and audit state before proceeding.

Never allow uncertainty in one issue to contaminate the identification or contents of another issue.


# General App Safeguards

These rules apply across the Document Cleaner app unless a specific cleaning path explicitly overrides them.

1. Never overwrite the original source file.

2. Preserve the source file unchanged during cleaning and auditing.

3. Generate cleaned output as new Markdown files.

4. When a filename must be reused, append ` [cleaned]` before `.md` unless the selected cleaning path specifies a different archival naming convention.

5. Never silently discard a source file because it is difficult to parse.

6. If a file cannot be cleaned reliably, preserve the source and report the failure or uncertainty to the user.

7. Batch failures should be isolated. One problematic file must not prevent other files from being processed.

8. Do not silently fabricate missing source text, metadata, names, dates, titles, or other information.

9. Do not treat model confidence as proof. When source evidence is insufficient, preserve or report uncertainty.

10. Keep user-facing output folders unique by incorporating the current local date and time when the relevant cleaning path calls for a timestamped output directory.

11. The cleaned Markdown file is the authoritative cleaned deliverable. Processing notes, audit status, warnings, and completion summaries belong in the app interface or completion report unless a cleaning path explicitly requires a separate audit file.

12. When fidelity and stylistic smoothness conflict, preserve fidelity unless the selected cleaning path expressly authorizes substantive editorial revision.
