import test from 'node:test';
import assert from 'node:assert/strict';
import { testables } from '../native/pipeline.mjs';
import { adaptiveCleaningPrompt, adaptiveCleaningSchema, auditSchema, cleaningPrompt, issuePrompt, issueSchema, volumeManifestPrompt, volumeManifestSchema } from '../native/prompts.mjs';
import { estimateJobCost, usageCost } from '../native/pricing.mjs';

test('cleaned filenames preserve source bases', () => {
  assert.equal(testables.markdownFilename('documents', 'Q.56 Matters.pdf', '# Q.56'), 'Q.56 Matters [cleaned].md');
  assert.equal(testables.markdownFilename('news_articles', 'Article.md', '# Article'), 'Article [cleaned].md');
});

test('hearing filenames use a supported date heading', () => {
  assert.equal(
    testables.markdownFilename('hearing_transcripts', 'captions.txt', '# 2026.02.04 Performance Oversight Hearing - OEA\n'),
    '2026.02.04 Performance Oversight Hearing - OEA [cleaned].md',
  );
  assert.equal(testables.markdownFilename('hearing_transcripts', 'captions.txt', '# Hearing'), 'captions [cleaned].md');
});

test('Markdown fences are removed without altering content', () => {
  assert.equal(testables.stripFence('```markdown\n# Title\n\nText.\n```'), '# Title\n\nText.');
  assert.equal(testables.stripFence('# Title\n\nText.'), '# Title\n\nText.');
});

test('dates are normalized conservatively', () => {
  assert.equal(testables.normalizedDate('2026-8-7'), '2026.08.07');
  assert.equal(testables.normalizedDate('August 7, 2026'), '');
});

test('filenames remove macOS path separators and control characters', () => {
  assert.equal(testables.safeFilename('A/B: C\u0000'), 'A-B- C-');
});

test('volume manifests reject overlap and out-of-range pages', () => {
  const valid = testables.validateManifest({ issues: [
    { start_page: 1, end_page: 4 },
    { start_page: 5, end_page: 8 },
  ] }, 8);
  assert.equal(valid.issues.length, 2);
  assert.throws(() => testables.validateManifest({ issues: [
    { start_page: 1, end_page: 5 },
    { start_page: 5, end_page: 8 },
  ] }, 8), /overlap/i);
  assert.throws(() => testables.validateManifest({ issues: [{ start_page: 1, end_page: 9 }] }, 8), /outside/i);
});

test('structured response schemas require every fidelity field', () => {
  assert.deepEqual(auditSchema.required, ['status', 'uncertainty_summary', 'audit_notes', 'final_markdown']);
  assert.ok(issueSchema.required.includes('articles'));
  assert.ok(issueSchema.required.includes('masthead'));
  assert.ok(volumeManifestSchema.required.includes('issues'));
});

test('the complete supplied specification is routed into each selected path', () => {
  const document = cleaningPrompt('documents', 'record.pdf');
  assert.match(document, /Three Distinct Preservation Functions/);
  assert.doesNotMatch(document, /Remove social-media sharing material/);
  const issue = issuePrompt('issue.pdf');
  assert.match(issue, /Identify All Articles and the Masthead/);
  const volume = volumeManifestPrompt('volume.pdf', 40);
  assert.match(volume, /Process the volume in checkpoints/);
  assert.match(volume, /General App Safeguards/);
});

test('all ordinary paths require an explicit conditional-audit decision', () => {
  assert.match(adaptiveCleaningPrompt('news_articles', 'article.md'), /article boundary remains ambiguous/);
  assert.match(adaptiveCleaningPrompt('documents', 'record.pdf', 'Rendered source pages are available.'), /table, form, hierarchy/);
  assert.match(adaptiveCleaningPrompt('hearing_transcripts', 'captions.txt'), /speaker identity or turn boundaries/);
  assert.ok(adaptiveCleaningSchema.required.includes('requires_second_audit'));
  assert.ok(adaptiveCleaningSchema.required.includes('final_markdown'));
  assert.equal(testables.shouldRunAdaptiveAudit({ requires_second_audit: false, status: 'Cleaned and verified', uncertainty_summary: '' }), false);
  assert.equal(testables.shouldRunAdaptiveAudit({ requires_second_audit: true, status: 'Cleaned and verified', uncertainty_summary: '' }), true);
  assert.equal(testables.shouldRunAdaptiveAudit({ requires_second_audit: false, status: 'Cleaned and verified with uncertainties', uncertainty_summary: 'Unclear boundary.' }), true);
});

test('adaptive output limits preserve more room for long transcripts', () => {
  assert.equal(testables.adaptiveOutputLimit('news_articles', 30_000), 13_000);
  assert.equal(testables.adaptiveOutputLimit('documents', 30_000), 23_000);
  assert.equal(testables.adaptiveOutputLimit('hearing_transcripts', 30_000), 18_000);
  assert.equal(testables.adaptiveOutputLimit('hearing_transcripts', 1_000_000), 120_000);
});

test('recorded usage cost follows current Terra token prices', () => {
  const cost = usageCost('gpt-5.6-terra', { input_tokens: 100_000, output_tokens: 10_000, input_tokens_details: {} });
  assert.equal(cost, 0.32);
});

test('ordinary-path estimates show one pass to a conditional audit', () => {
  for (const [cleaningPath, name] of [['news_articles', 'article.md'], ['documents', 'record.txt'], ['hearing_transcripts', 'hearing.txt']]) {
    const estimate = estimateJobCost(cleaningPath, [{ name, size: 40_000 }], 'gpt-5.6-terra');
    assert.ok(estimate.lowUSD > 0);
    assert.ok(estimate.highUSD > estimate.lowUSD);
    assert.match(estimate.assumption, /second audit/);
  }
});
