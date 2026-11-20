-- Budget bulanan per kategori pengeluaran (Rencana 4).
-- Satu baris per kategori per pengguna; kategori dicocokkan tanpa peduli huruf besar dan spasi tepi.
-- Batas berlaku tetap untuk setiap bulan.

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  kategori text not null
    check (btrim(kategori) <> '' and length(kategori) <= 50),
  batas_bulanan bigint not null
    check (batas_bulanan > 0 and batas_bulanan <= 1000000000000),
  created_at timestamptz not null default now()
);

create unique index budgets_user_kategori_unik
  on public.budgets (user_id, lower(btrim(kategori)));

alter table public.budgets enable row level security;

create policy budgets_select_own on public.budgets
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy budgets_insert_own on public.budgets
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy budgets_update_own on public.budgets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy budgets_delete_own on public.budgets
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Grant eksplisit (konvensi 20261119000002_grants.sql / 0007): cabut dulu hak bawaan apa pun,
-- lalu beri yang dibutuhkan. RLS tetap membatasi baris.
revoke all on public.budgets from public, anon, authenticated;
grant select, insert, update, delete on public.budgets to authenticated;
grant all on public.budgets to service_role;
