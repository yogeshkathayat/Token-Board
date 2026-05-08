/**
 * Source identifiers for ingested buckets. Keep in sync with CLI parser branches
 * and API ingest validation.
 */
export const SOURCES = [
  'claude',
  'codex',
  'gemini',
  'opencode',
  'kiro',
  'cursor',
  'copilot',
  'openrouter',
] as const;

export type Source = (typeof SOURCES)[number];

export type BigintString = string;

/**
 * Half-hour bucket of token usage. `hour_start` is a UTC ISO timestamp aligned
 * to :00 or :30. Numeric fields are non-negative integers.
 */
export interface UsageBucket {
  hour_start: string;
  source: Source | string;
  model: string;
  input_tokens: number;
  cached_input_tokens: number;
  cache_creation_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
  conversation_count?: number;
}

export interface DeviceSubscription {
  tool: string;
  provider: string;
  product: string;
  plan_type?: string | null;
  rate_limit_tier?: string | null;
}

export interface IngestRequest {
  hourly: UsageBucket[];
  device_subscriptions?: DeviceSubscription[];
}

export interface IngestResponse {
  success: true;
  inserted: number;
  skipped: number;
}

export type LeaderboardPeriod = 'week' | 'month' | 'total';
export type LeaderboardMetric = 'all' | Source | 'other';

export interface LeaderboardTokens {
  claude_tokens: BigintString;
  codex_tokens: BigintString;
  gemini_tokens: BigintString;
  opencode_tokens: BigintString;
  kiro_tokens: BigintString;
  cursor_tokens: BigintString;
  copilot_tokens: BigintString;
  openrouter_tokens: BigintString;
  other_tokens: BigintString;
  total_tokens: BigintString;
}

export interface LeaderboardEntry extends LeaderboardTokens {
  user_id: string | null;
  rank: number;
  is_me: boolean;
  is_public: boolean;
  display_name: string;
  avatar_url: string | null;
}

export interface LeaderboardResponse {
  period: LeaderboardPeriod;
  metric: LeaderboardMetric;
  from: string;
  to: string;
  generated_at: string;
  page: number;
  limit: number;
  offset: number;
  total_entries: number;
  total_pages: number;
  sources: readonly Source[];
  entries: LeaderboardEntry[];
  me: (LeaderboardTokens & { rank: number | null }) | null;
}

export interface UsageSummaryResponse {
  from: string;
  to: string;
  days: number;
  totals: {
    total_tokens: BigintString;
    input_tokens: BigintString;
    cached_input_tokens: BigintString;
    output_tokens: BigintString;
    reasoning_output_tokens: BigintString;
  };
}

export interface PublicVisibility {
  enabled: boolean;
  display_name: string | null;
  anonymous: boolean;
  updated_at: string | null;
}
