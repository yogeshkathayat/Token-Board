-- Long-lived "personal access tokens" — opaque tokens a user can mint to
-- authenticate non-browser clients (the macOS menu bar app today, future
-- IDE extensions, scripts, etc.) without going through the OIDC/refresh
-- dance every hour.
--
-- These are NOT device tokens (which are CLI-ingest-only and live in
-- tb_devices). PATs grant the same read scope as a user JWT — they're
-- treated identically by requireUser/optionalUser.

create table tb_personal_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references tb_users(id) on delete cascade,
  token_hash text not null unique,
  name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '1 year'),
  revoked_at timestamptz
);
create index tb_personal_tokens_user_idx on tb_personal_tokens (user_id) where revoked_at is null;

-- DOWN
drop table if exists tb_personal_tokens;
