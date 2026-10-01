-- 01-setup.sql  (NOT needed for version 1, which runs on demo data in the browser)
-- For the live release. Data Keeper: paste this whole block into the Supabase SQL Editor and run it once.
-- One table. Main fields are real columns (easy to filter); everything else sits in "details" (JSON).

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  complaint_id text not null unique,
  complaint_date date not null,
  data_source text not null default 'DEMO',
  subsidiary_id text not null,
  area_id text not null,
  mine_id text not null,
  location_id text not null,
  loading_site text not null check (loading_site in ('Siding','Road Sale','Other')),
  declared_grade text not null,
  claimed_grade text,
  complaint_categories text[] not null default '{}',
  status text not null default 'New',
  priority text not null default 'Normal' check (priority in ('Normal','High','Critical')),
  source text,
  details jsonb not null default '{}'::jsonb
);

alter table public.complaints enable row level security;

grant select, insert, update on public.complaints to anon, authenticated;

drop policy if exists "complaints_select" on public.complaints;
drop policy if exists "complaints_insert" on public.complaints;
drop policy if exists "complaints_update" on public.complaints;
create policy "complaints_select" on public.complaints for select to anon, authenticated using (true);
create policy "complaints_insert" on public.complaints for insert to anon, authenticated with check (true);
create policy "complaints_update" on public.complaints for update to anon, authenticated using (true) with check (true);

-- lets the dashboard receive new rows instantly (real-time)
alter publication supabase_realtime add table public.complaints;
