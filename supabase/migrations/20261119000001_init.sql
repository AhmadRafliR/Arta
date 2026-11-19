-- Skema awal aplikasi keuangan: profiles, wallets, categories, transactions + RLS.

-- ---------------------------------------------------------------- tables

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nama text,
  zona_waktu text default 'Asia/Jakarta',
  mode_tampilan text default 'sistem'
    check (mode_tampilan in ('sistem', 'terang', 'gelap')),
  onboarding_selesai boolean default false,
  created_at timestamptz default now()
);

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  nama text not null,
  tipe text default 'harian'
    check (tipe in ('harian', 'darurat', 'investasi')),
  saldo_awal bigint not null default 0,
  tanggal_saldo_awal date not null default current_date,
  target bigint,
  diarsip boolean default false,
  created_at timestamptz default now(),
  unique (user_id, nama)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  jenis text not null check (jenis in ('pemasukan', 'pengeluaran')),
  nama text not null,
  unique (user_id, jenis, nama)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  tanggal date not null,
  jenis text not null check (jenis in (
    'pemasukan', 'pengeluaran', 'transfer',
    'hutang_baru', 'hutang_bayar', 'penyesuaian'
  )),
  kategori text,
  nominal bigint not null,
  wallet_id uuid references public.wallets (id),
  wallet_tujuan_id uuid references public.wallets (id),
  debt_id uuid, -- FK ke tabel debts ditambahkan di rencana berikutnya
  porsi_bunga bigint,
  porsi_pokok bigint,
  catatan text,
  transkrip text,
  sumber text default 'manual' check (sumber in ('ai', 'manual', 'import')),
  created_at timestamptz default now(),
  check (nominal <> 0),
  check (jenis = 'penyesuaian' or nominal > 0)
);

create index transactions_user_tanggal_idx
  on public.transactions (user_id, tanggal desc);

-- ---------------------------------------------------------------- RLS

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

-- profiles: kunci pada id
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- wallets
create policy wallets_select_own on public.wallets
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy wallets_insert_own on public.wallets
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy wallets_update_own on public.wallets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy wallets_delete_own on public.wallets
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- categories
create policy categories_select_own on public.categories
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy categories_insert_own on public.categories
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy categories_update_own on public.categories
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy categories_delete_own on public.categories
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- transactions
create policy transactions_select_own on public.transactions
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy transactions_insert_own on public.transactions
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy transactions_update_own on public.transactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy transactions_delete_own on public.transactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- new-user trigger

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);

  insert into public.categories (user_id, jenis, nama)
  select new.id, k.jenis, k.nama
  from (values
    ('pengeluaran', 'rokok'),
    ('pengeluaran', 'makan'),
    ('pengeluaran', 'parkir'),
    ('pengeluaran', 'kuliah'),
    ('pengeluaran', 'transport'),
    ('pengeluaran', 'lainnya'),
    ('pemasukan', 'ortu'),
    ('pemasukan', 'gaji'),
    ('pemasukan', 'lainnya')
  ) as k (jenis, nama);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
