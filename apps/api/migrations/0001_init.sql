-- Initial schema for tokenboard
-- Identity, devices, usage buckets (partitioned), leaderboard snapshots,
-- public visibility, link codes, audit events.

create extension if not exists pgcrypto;

create table tb_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text,
  avatar_url text,
  password_hash text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Email is matched case-insensitively. Application layer must lowercase before
-- inserting; the unique index on lower(email) enforces it at the DB level.
create unique index tb_users_email_key on tb_users (lower(email));

create table tb_oidc_links (
  user_id uuid not null references tb_users(id) on delete cascade,
  provider text not null,
  sub text not null,
  created_at timestamptz not null default now(),
  primary key (provider, sub)
);
create index tb_oidc_links_user_idx on tb_oidc_links (user_id);

create table tb_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references tb_users(id) on delete cascade,
  refresh_token_hash text not null,
  user_agent text,
  ip text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index tb_sessions_user_idx on tb_sessions (user_id);
create index tb_sessions_expires_idx on tb_sessions (expires_at);

create table tb_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references tb_users(id) on delete cascade,
  name text not null,
  platform text,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);
create index tb_devices_user_idx on tb_devices (user_id) where revoked_at is null;

-- Partitioned by month on hour_start. Children are managed by 0002_partitions.sql.
create table tb_usage_buckets (
  id bigserial,
  user_id uuid not null references tb_users(id) on delete cascade,
  device_id uuid not null references tb_devices(id) on delete cascade,
  source text not null,
  model text not null default 'unknown',
  hour_start timestamptz not null,
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  cached_input_tokens bigint not null default 0 check (cached_input_tokens >= 0),
  cache_creation_input_tokens bigint not null default 0 check (cache_creation_input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  reasoning_output_tokens bigint not null default 0 check (reasoning_output_tokens >= 0),
  total_tokens bigint not null default 0 check (total_tokens >= 0),
  conversation_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, hour_start),
  unique (user_id, device_id, source, model, hour_start)
) partition by range (hour_start);

create index tb_usage_buckets_user_hour_idx on tb_usage_buckets (user_id, hour_start desc);
create index tb_usage_buckets_source_model_hour_idx on tb_usage_buckets (source, model, hour_start desc);

create table tb_device_subscriptions (
  user_id uuid not null references tb_users(id) on delete cascade,
  tool text not null,
  provider text not null,
  product text not null,
  plan_type text,
  rate_limit_tier text,
  observed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, tool, provider, product)
);

create table tb_public_visibility (
  user_id uuid primary key references tb_users(id) on delete cascade,
  enabled boolean not null default false,
  display_name text,
  anonymous boolean not null default false,
  share_token text,
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table tb_leaderboard_snapshots (
  period text not null check (period in ('week', 'month', 'total')),
  period_from date not null,
  period_to date not null,
  user_id uuid not null references tb_users(id) on delete cascade,
  rank integer not null,
  -- Per-source columns. Sums across all models within that source.
  claude_tokens bigint not null default 0,
  codex_tokens bigint not null default 0,
  gemini_tokens bigint not null default 0,
  opencode_tokens bigint not null default 0,
  kiro_tokens bigint not null default 0,
  cursor_tokens bigint not null default 0,
  copilot_tokens bigint not null default 0,
  openrouter_tokens bigint not null default 0,
  -- Anything else (future sources we don't yet have a column for) collected here.
  other_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  is_public boolean not null default false,
  generated_at timestamptz not null default now(),
  primary key (period, period_from, user_id)
);
create index tb_leaderboard_rank_idx on tb_leaderboard_snapshots (period, period_from, rank);

create table tb_sync_pings (
  user_id uuid not null references tb_users(id) on delete cascade,
  device_id uuid not null references tb_devices(id) on delete cascade,
  last_sync_at timestamptz not null,
  primary key (user_id, device_id)
);

create table tb_link_codes (
  code text primary key,
  user_id uuid not null references tb_users(id) on delete cascade,
  request_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  issued_token_hash text
);
create index tb_link_codes_user_idx on tb_link_codes (user_id);

create table tb_audit_events (
  id bigserial primary key,
  actor_user_id uuid references tb_users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index tb_audit_events_actor_idx on tb_audit_events (actor_user_id, created_at desc);

-- Updated-at trigger
create or replace function tb_set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger tb_users_set_updated_at before update on tb_users
  for each row execute function tb_set_updated_at();
create trigger tb_usage_buckets_set_updated_at before update on tb_usage_buckets
  for each row execute function tb_set_updated_at();
create trigger tb_device_subscriptions_set_updated_at before update on tb_device_subscriptions
  for each row execute function tb_set_updated_at();
create trigger tb_public_visibility_set_updated_at before update on tb_public_visibility
  for each row execute function tb_set_updated_at();

-- DOWN
drop table if exists tb_audit_events;
drop table if exists tb_link_codes;
drop table if exists tb_sync_pings;
drop table if exists tb_leaderboard_snapshots;
drop table if exists tb_public_visibility;
drop table if exists tb_device_subscriptions;
drop table if exists tb_usage_buckets cascade;
drop table if exists tb_devices;
drop table if exists tb_sessions;
drop table if exists tb_oidc_links;
drop table if exists tb_users;
drop function if exists tb_set_updated_at();
