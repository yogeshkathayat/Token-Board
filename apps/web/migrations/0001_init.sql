-- TokenBoard schema. All tables prefixed tb_. Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS tb_user_profiles (
  user_id       text PRIMARY KEY,
  email         text NOT NULL,
  display_name  text,
  avatar_url    text,
  leaderboard_public boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tb_user_profiles_email_idx ON tb_user_profiles (lower(email));

CREATE TABLE IF NOT EXISTS tb_devices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      text NOT NULL,
  device_name  text NOT NULL,
  platform     text,
  machine_id   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  revoked_at   timestamptz
);
CREATE INDEX IF NOT EXISTS tb_devices_user_idx ON tb_devices (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS tb_devices_unique_active
  ON tb_devices (user_id, coalesce(machine_id, device_name))
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS tb_device_tokens (
  token_hash  text PRIMARY KEY,
  device_id   uuid NOT NULL REFERENCES tb_devices(id) ON DELETE CASCADE,
  user_id     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at  timestamptz
);
CREATE INDEX IF NOT EXISTS tb_device_tokens_device_idx ON tb_device_tokens (device_id);

-- Link codes: short-lived pairing codes minted in the browser, exchanged by the CLI.
CREATE TABLE IF NOT EXISTS tb_link_codes (
  code        text PRIMARY KEY,
  user_id     text NOT NULL,
  email       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz
);

-- Canonical usage ledger. hour_start MUST be a UTC half-hour boundary (:00 or :30).
CREATE TABLE IF NOT EXISTS tb_usage_buckets (
  user_id     text NOT NULL,
  device_id   uuid NOT NULL,
  source      text NOT NULL,
  model       text NOT NULL,
  hour_start  timestamptz NOT NULL,
  input_tokens                bigint NOT NULL DEFAULT 0,
  cached_input_tokens         bigint NOT NULL DEFAULT 0,
  cache_creation_input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens               bigint NOT NULL DEFAULT 0,
  reasoning_output_tokens     bigint NOT NULL DEFAULT 0,
  total_tokens                bigint NOT NULL DEFAULT 0,
  billable_total_tokens       bigint NOT NULL DEFAULT 0,
  total_cost_usd              numeric(12,6) NOT NULL DEFAULT 0,
  conversation_count          integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_id, source, model, hour_start)
);
CREATE INDEX IF NOT EXISTS tb_usage_buckets_user_hour_idx ON tb_usage_buckets (user_id, hour_start);
CREATE INDEX IF NOT EXISTS tb_usage_buckets_hour_idx ON tb_usage_buckets (hour_start);

-- Pre-materialized leaderboard, one row per (user, period window).
CREATE TABLE IF NOT EXISTS tb_leaderboard_snapshots (
  user_id     text NOT NULL,
  period      text NOT NULL CHECK (period IN ('week','month','total')),
  from_day    date NOT NULL,
  to_day      date NOT NULL,
  rank        integer NOT NULL,
  claude_tokens   bigint NOT NULL DEFAULT 0,
  codex_tokens    bigint NOT NULL DEFAULT 0,
  cursor_tokens   bigint NOT NULL DEFAULT 0,
  kiro_tokens     bigint NOT NULL DEFAULT 0,
  gemini_tokens   bigint NOT NULL DEFAULT 0,
  opencode_tokens bigint NOT NULL DEFAULT 0,
  other_tokens    bigint NOT NULL DEFAULT 0,
  total_tokens    bigint NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(12,2) NOT NULL DEFAULT 0,
  display_name    text,
  avatar_url      text,
  is_public       boolean NOT NULL DEFAULT true,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period, from_day, to_day)
);
CREATE INDEX IF NOT EXISTS tb_leaderboard_period_rank_idx
  ON tb_leaderboard_snapshots (period, from_day, to_day, rank);
