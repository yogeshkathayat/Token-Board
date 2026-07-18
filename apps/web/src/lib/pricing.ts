
import { TokenTotals } from '@/lib/contract';

interface ModelPrice {
  inputPer1M: number;
  outputPer1M: number;
}

const MODEL_PRICING: Record<string, ModelPrice> = {
  'claude-opus-4-20250514': { inputPer1M: 15.0, outputPer1M: 75.0 },
  'claude-opus-4': { inputPer1M: 15.0, outputPer1M: 75.0 },
  'claude-sonnet-4-20250514': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-sonnet-4': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3-7-sonnet-20250219': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3-5-sonnet-20241022': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3-5-haiku-20241022': { inputPer1M: 0.8, outputPer1M: 4.0 },
  'claude-3-haiku-20240307': { inputPer1M: 0.25, outputPer1M: 1.25 },
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4-turbo': { inputPer1M: 10.0, outputPer1M: 30.0 },
  'gpt-4': { inputPer1M: 30.0, outputPer1M: 60.0 },
  'gpt-3.5-turbo': { inputPer1M: 0.5, outputPer1M: 1.5 },
  'gemini-2.0-flash-exp': { inputPer1M: 0.0, outputPer1M: 0.0 },
  'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.0 },
  'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.3 },
};

function findModelPrice(model: string): ModelPrice | null {
  const lower = model.toLowerCase();
  if (MODEL_PRICING[lower]) return MODEL_PRICING[lower];
  for (const [key, price] of Object.entries(MODEL_PRICING)) {
    if (lower.includes(key)) return price;
  }
  return null;
}

export function estimateCostUsd(model: string, totals: TokenTotals): string {
  const price = findModelPrice(model);
  if (!price) return '0.000000';

  const inputCost = (Number(totals.input_tokens) / 1_000_000) * price.inputPer1M;
  const outputCost = (Number(totals.output_tokens) / 1_000_000) * price.outputPer1M;
  const cachedInputCost = (Number(totals.cached_input_tokens) / 1_000_000) * price.inputPer1M * 0.1;
  const cacheCreationCost =
    (Number(totals.cache_creation_input_tokens) / 1_000_000) * price.inputPer1M * 1.25;

  const total = inputCost + outputCost + cachedInputCost + cacheCreationCost;
  return total.toFixed(6);
}
