-- Run this in Supabase → SQL Editor

create table public.orders (
  id text primary key,
  name text not null,
  phone text not null,
  order_text text not null,
  pickup text not null,
  notes text,
  status text not null default 'received',
  created_at bigint not null
);

alter table public.orders enable row level security;

create policy "Allow all operations"
  on public.orders
  for all
  using (true)
  with check (true);
