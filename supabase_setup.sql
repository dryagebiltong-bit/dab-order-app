-- Run this in Supabase → SQL Editor
-- If you ran the previous version, run this to update the security policy

-- Drop the old permissive policy
drop policy if exists "Allow all operations" on public.orders;
drop policy if exists "Allow all" on public.orders;

-- Create the table if it doesn't exist yet
create table if not exists public.orders (
  id text primary key,
  name text not null,
  phone text not null,
  order_text text not null,
  pickup text not null,
  notes text,
  status text not null default 'received',
  created_at bigint not null
);

-- Enable RLS (blocks all direct anon/public access)
alter table public.orders enable row level security;

-- No public policies — all access goes through the service role key server-side
-- The service role key bypasses RLS, so your Vercel functions will still work fine
