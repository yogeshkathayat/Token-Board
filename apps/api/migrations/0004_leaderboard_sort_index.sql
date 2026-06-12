-- The leaderboard read filters by (period, period_from) and orders by a token
-- column descending. The existing (period, period_from, rank) index covers the
-- filter but not the token-column ordering; add an index matching the default
-- `metric=all` sort so the common query avoids a sort step.

create index if not exists tb_leaderboard_total_idx
  on tb_leaderboard_snapshots (period, period_from, total_tokens desc);

-- DOWN
drop index if exists tb_leaderboard_total_idx;
