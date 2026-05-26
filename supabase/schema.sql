-- Run this in the Supabase SQL editor.

create table if not exists wishlist_items (
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

create table if not exists bought_marks (
  id uuid primary key default gen_random_uuid (),
  item_id uuid not null references wishlist_items (id) on delete cascade,
  buyer_name text not null,
  created_at timestamptz not null default now (),
  unique (item_id) -- one buyer per item; remove this line if you want multiple "going in together" buyers
);

create index if not exists idx_wishlist_category on wishlist_items (category);
create index if not exists idx_wishlist_created on wishlist_items (created_at desc);

-- RLS: public read; writes only via service role from server actions.
alter table wishlist_items enable row level security;
alter table bought_marks enable row level security;

create policy "wishlist public read" on wishlist_items for
select
  using (true);

create policy "bought public read" on bought_marks for
select
  using (true);

-- Visitors can insert a buyer mark (no auth, just a name).
create policy "anyone can mark bought" on bought_marks for insert
with
  check (true);

-- Optional: allow unmarking (delete) by anyone. Comment out if you want only yourself to unmark.
create policy "anyone can unmark bought" on bought_marks for delete using (true);
