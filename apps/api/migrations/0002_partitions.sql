-- Create monthly partitions for tb_usage_buckets and a function that lazily
-- creates future partitions. The API ensures the current + next month exist
-- on startup so writes never fail with "no partition for value".

create or replace function tb_ensure_usage_partition(month_start date)
returns void language plpgsql as $$
declare
  partition_name text := 'tb_usage_buckets_' || to_char(month_start, 'YYYY_MM');
  partition_end date := (month_start + interval '1 month')::date;
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relname = partition_name
      and n.nspname = current_schema
  ) then
    execute format(
      'create table %I partition of tb_usage_buckets for values from (%L) to (%L)',
      partition_name,
      month_start,
      partition_end
    );
  end if;
end
$$;

-- Bootstrap: create partitions for previous, current, and next month so the
-- table is writable immediately after migration.
select tb_ensure_usage_partition(date_trunc('month', now() - interval '1 month')::date);
select tb_ensure_usage_partition(date_trunc('month', now())::date);
select tb_ensure_usage_partition(date_trunc('month', now() + interval '1 month')::date);

-- DOWN
drop function if exists tb_ensure_usage_partition(date);
-- (existing partitions are dropped by the parent in 0001 down)
