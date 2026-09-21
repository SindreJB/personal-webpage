-- Krystallkulen (/fpl). Kjør dette i Supabase SQL editor.
--
-- Poenget med tabellene er øyeblikksbilder. FPL-API-et viser bare nåtid, så
-- uten lagring kan vi aldri i ettertid rekonstruere hva modellen visste før en
-- deadline — og da kan den heller ikke etterprøves.

-- Forventede poeng per spiller, frosset før deadline.
create table if not exists fpl_projections (
  entry_id bigint not null,
  event smallint not null,
  element integer not null,
  xp numeric not null,
  xp_horizon numeric,
  in_starting_xi boolean not null default false,
  multiplier smallint not null default 1,
  captured_at timestamptz not null default now (),
  primary key (entry_id, event, element)
);

-- Hele anbefalingen slik den så ut, som jsonb.
create table if not exists fpl_recommendations (
  entry_id bigint not null,
  event smallint not null,
  payload jsonb not null,
  captured_at timestamptz not null default now (),
  primary key (entry_id, event)
);

-- Tidsserie for pris og eierskap. Flere rader per spiller per døgn.
create table if not exists fpl_price_snapshots (
  id bigserial primary key,
  element integer not null,
  captured_at timestamptz not null default now (),
  now_cost integer not null,
  price_change_percent numeric,
  transfers_in_event integer,
  transfers_out_event integer,
  selected_by_percent numeric
);

create index if not exists idx_fpl_price_element on fpl_price_snapshots (element, captured_at desc);

create index if not exists idx_fpl_price_captured on fpl_price_snapshots (captured_at desc);

create index if not exists idx_fpl_projections_entry on fpl_projections (entry_id, event);

-- RLS: skriving skjer bare fra serveren med service role-nøkkelen.
alter table fpl_projections enable row level security;

alter table fpl_recommendations enable row level security;

alter table fpl_price_snapshots enable row level security;

create policy "fpl projections public read" on fpl_projections for
select
  using (true);

create policy "fpl recommendations public read" on fpl_recommendations for
select
  using (true);

create policy "fpl prices public read" on fpl_price_snapshots for
select
  using (true);
