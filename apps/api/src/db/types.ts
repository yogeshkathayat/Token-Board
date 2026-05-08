/**
 * Kysely table interfaces. Keep these synchronized with migrations.
 */
import type { ColumnType, Generated } from 'kysely';

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface UsersTable {
  id: ColumnType<string, string | undefined, never>;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  password_hash: string | null;
  role: ColumnType<'user' | 'admin', 'user' | 'admin' | undefined, 'user' | 'admin'>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface OidcLinksTable {
  user_id: string;
  provider: string;
  sub: string;
  created_at: Generated<Timestamp>;
}

export interface SessionsTable {
  id: ColumnType<string, string | undefined, never>;
  user_id: string;
  refresh_token_hash: string;
  user_agent: string | null;
  ip: string | null;
  expires_at: Timestamp;
  created_at: Generated<Timestamp>;
}

export interface DevicesTable {
  id: ColumnType<string, string | undefined, never>;
  user_id: string;
  name: string;
  platform: string | null;
  token_hash: string;
  created_at: Generated<Timestamp>;
  last_seen_at: Timestamp | null;
  revoked_at: Timestamp | null;
}

export interface UsageBucketsTable {
  id: Generated<string>;
  user_id: string;
  device_id: string;
  source: string;
  model: string;
  hour_start: Timestamp;
  input_tokens: ColumnType<string, string | number | bigint, string | number | bigint>;
  cached_input_tokens: ColumnType<string, string | number | bigint, string | number | bigint>;
  cache_creation_input_tokens: ColumnType<string, string | number | bigint, string | number | bigint>;
  output_tokens: ColumnType<string, string | number | bigint, string | number | bigint>;
  reasoning_output_tokens: ColumnType<string, string | number | bigint, string | number | bigint>;
  total_tokens: ColumnType<string, string | number | bigint, string | number | bigint>;
  conversation_count: number;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface DeviceSubscriptionsTable {
  user_id: string;
  tool: string;
  provider: string;
  product: string;
  plan_type: string | null;
  rate_limit_tier: string | null;
  observed_at: Timestamp;
  updated_at: Generated<Timestamp>;
}

export interface PublicVisibilityTable {
  user_id: string;
  enabled: boolean;
  display_name: string | null;
  anonymous: boolean;
  share_token: string | null;
  updated_at: Generated<Timestamp>;
  revoked_at: Timestamp | null;
}

type BigintCol = ColumnType<string, string | number | bigint, string | number | bigint>;

export interface LeaderboardSnapshotsTable {
  period: 'week' | 'month' | 'total';
  period_from: ColumnType<string, string, never>;
  period_to: ColumnType<string, string, never>;
  user_id: string;
  rank: number;
  claude_tokens: BigintCol;
  codex_tokens: BigintCol;
  gemini_tokens: BigintCol;
  opencode_tokens: BigintCol;
  kiro_tokens: BigintCol;
  cursor_tokens: BigintCol;
  copilot_tokens: BigintCol;
  openrouter_tokens: BigintCol;
  other_tokens: BigintCol;
  total_tokens: BigintCol;
  is_public: boolean;
  generated_at: Generated<Timestamp>;
}

export interface SyncPingsTable {
  user_id: string;
  device_id: string;
  last_sync_at: Timestamp;
}

export interface LinkCodesTable {
  code: string;
  user_id: string;
  request_id: string | null;
  created_at: Generated<Timestamp>;
  expires_at: Timestamp;
  used_at: Timestamp | null;
  issued_token_hash: string | null;
}

export interface AuditEventsTable {
  id: Generated<string>;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: ColumnType<unknown, unknown, unknown>;
  created_at: Generated<Timestamp>;
}

export interface PersonalTokensTable {
  id: ColumnType<string, string | undefined, never>;
  user_id: string;
  token_hash: string;
  name: string | null;
  created_at: Generated<Timestamp>;
  last_used_at: Timestamp | null;
  expires_at: Generated<Timestamp>;
  revoked_at: Timestamp | null;
}

export interface DB {
  tb_users: UsersTable;
  tb_oidc_links: OidcLinksTable;
  tb_sessions: SessionsTable;
  tb_devices: DevicesTable;
  tb_usage_buckets: UsageBucketsTable;
  tb_device_subscriptions: DeviceSubscriptionsTable;
  tb_public_visibility: PublicVisibilityTable;
  tb_leaderboard_snapshots: LeaderboardSnapshotsTable;
  tb_sync_pings: SyncPingsTable;
  tb_link_codes: LinkCodesTable;
  tb_audit_events: AuditEventsTable;
  tb_personal_tokens: PersonalTokensTable;
}
