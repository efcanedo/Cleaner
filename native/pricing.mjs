import path from 'node:path';

export const PRICING_UPDATED_AT = '2026-08-27';
export const PRICING_SOURCE = 'https://developers.openai.com/api/docs/models/compare';

export const MODEL_PRICING = {
  'gpt-5.6-sol': { input: 4.00, cachedInput: 0.40, output: 20.00 },
  'gpt-5.6-terra': { input: 2.00, cachedInput: 0.20, output: 12.00 },
  'gpt-5.6-luna': { input: 0.20, cachedInput: 0.02, output: 1.20 },
};

function priceFor(model) {
  return MODEL_PRICING[model] || MODEL_PRICING['gpt-5.6-terra'];
}

export function usageCost(model, usage) {
  if (!usage) return 0;
  const rates = priceFor(model);
  const input = Number(usage.input_tokens || 0);
  const output = Number(usage.output_tokens || 0);
  const cached = Math.min(input, Number(usage.input_tokens_details?.cached_tokens || 0));
  const cacheWrites = Math.min(Math.max(0, input - cached), Number(usage.input_tokens_details?.cache_write_tokens || 0));
  const uncached = Math.max(0, input - cached - cacheWrites);
  const longContext = input > 272_000;
  const inputMultiplier = longContext ? 2 : 1;
  const outputMultiplier = longContext ? 1.5 : 1;
  return (
    uncached * rates.input * inputMultiplier
    + cached * rates.cachedInput * inputMultiplier
    + cacheWrites * rates.input * 1.25 * inputMultiplier
    + output * rates.output * outputMultiplier
  ) / 1_000_000;
}

function sourceTokens(file) {
  const rawSize = Number(file.size || 0);
  const size = Number.isFinite(rawSize) ? Math.max(0, rawSize) : 0;
  const extension = path.extname(file.name || '').toLowerCase();
  if (extension === '.md' || extension === '.txt') return Math.max(500, size / 4);
  if (extension === '.docx') return Math.max(1_000, size / 10);
  if (extension === '.pdf') return Math.max(1_500, size / 14);
  if (['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.heic'].includes(extension)) return Math.max(2_000, size / 120);
  return Math.max(1_000, size / 8);
}

function requestCost(rates, inputTokens, visibleOutputTokens, reasoningMultiplier, longContext = false) {
  const billedOutput = visibleOutputTokens * reasoningMultiplier;
  const inputMultiplier = longContext ? 2 : 1;
  const outputMultiplier = longContext ? 1.5 : 1;
  return (inputTokens * rates.input * inputMultiplier + billedOutput * rates.output * outputMultiplier) / 1_000_000;
}

export function estimateJobCost(cleaningPath, files, model) {
  const rates = priceFor(model);
  const totalSource = (files || []).reduce((sum, file) => sum + sourceTokens(file), 0);
  const fileCount = Math.max(1, files?.length || 0);
  const prompts = {
    news_articles: 2_500, documents: 7_500, hearing_transcripts: 8_000,
    beacon_article: 2_500, beacon_issue: 2_500, beacon_volume: 2_500,
  };
  const prompt = prompts[cleaningPath] || 4_000;
  const sourcePerFile = totalSource / fileCount;
  const longContext = sourcePerFile + prompt > 272_000;
  let low = 0;
  let high = 0;
  let assumption = '';

  if (['news_articles', 'documents', 'hearing_transcripts'].includes(cleaningPath)) {
    const outputFactors = { news_articles: 0.65, documents: 0.75, hearing_transcripts: 0.95 };
    const labels = { news_articles: 'article', documents: 'document', hearing_transcripts: 'transcript' };
    const visible = Math.max(800, sourcePerFile * outputFactors[cleaningPath]);
    const first = requestCost(rates, sourcePerFile + prompt, visible, 1.25, longContext);
    const audit = requestCost(rates, sourcePerFile + prompt + visible, visible, 1.65, longContext);
    low = first * fileCount * 0.8;
    high = (first + audit) * fileCount * 1.25;
    assumption = `One medium-reasoning pass per ${labels[cleaningPath]}; the upper bound allows a risk-triggered second audit.`;
  } else if (cleaningPath === 'beacon_volume') {
    const visible = Math.max(2_000, totalSource * 0.8);
    const perPass = requestCost(rates, totalSource + prompt, visible, 1.7, longContext);
    low = perPass * 3;
    high = perPass * 10;
    assumption = 'Volume cost varies widely with issue count, page images, and extracted article length.';
  } else {
    const outputFactor = cleaningPath === 'beacon_issue' ? 1.0 : 0.75;
    const visible = Math.max(1_000, sourcePerFile * outputFactor);
    const first = requestCost(rates, sourcePerFile + prompt, visible, 1.65, longContext);
    const second = requestCost(rates, sourcePerFile + prompt + visible, visible, 1.65, longContext);
    low = (first + second) * fileCount * 0.75;
    high = (first + second) * fileCount * 1.4;
    assumption = 'Two model passes; PDF and image tokenization can move the final cost outside this range.';
  }

  const minimum = files?.length ? 0.001 : 0;
  return {
    lowUSD: Math.max(minimum, low),
    highUSD: Math.max(minimum, high),
    model,
    pricingUpdatedAt: PRICING_UPDATED_AT,
    pricingSource: PRICING_SOURCE,
    assumption,
  };
}
