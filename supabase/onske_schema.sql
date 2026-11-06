-- Ønskebrønnen — privat ønskeliste uten sporing.
-- Kjør dette i Supabase SQL Editor.
--
-- Forskjellig fra den gamle wishlist-tabellen:
--  * eieren ser aldri hvem som har reservert (brønnen er mørk)
--  * reservasjoner signeres med en hemmelig kvote (HMAC), ikke bare et navn
--  * alt skrives via service role fra server actions; RLS er bare for lesing.

create table if not exists onskewishes (
  id uuid primary key default gen_random_uuid (),
  url text not null,
  title text not null,
  image_url text,
  price_amount numeric,
  price_currency text,
  category text not null default 'other',
  vendor text,
  note text,
  created_at timestamptz not null default now ()
);

create table if not exists onskereservations (
  id uuid primary key default gen_random_uuid (),
  wish_id uuid not null references onskewishes (id) on delete cascade,
  -- Navnet vises bare til andre besøkende, aldri til eieren.
  giver_name text not null,
  -- HMAC-signatur (sha256) av giver_name + wish_id + created_at, signert med
  -- ONSKE_SECRET. Bevis på reservasjonen uten å lagre en konto.
  signature text not null,
  created_at timestamptz not null default now (),
  unique (wish_id) -- én reservasjon per ønske
);

create index if not exists idx_onskewishes_created on onskewishes (created_at desc);
create index if not exists idx_onskewishes_category on onskewishes (category);

-- RLS: offentlig lesing (siden filtrerer selv per rolle), skriving kun via
-- service role fra server actions.
alter table onskewishes enable row level security;
alter table onskereservations enable row level security;

create policy "onskewishes public read" on onskewishes for
select
  using (true);

create policy "onskereservations public read" on onskereservations for
select
  using (true);
