-- Rencana 3: hutang & jadwal tagihan. Tabel debts, debt_schedule, FK hutang di transactions,
-- RLS + grant, dan view ringkasan v_hutang.

-- ---------------------------------------------------------------- debts

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  pemberi text not null check (length(trim(pemberi)) between 1 and 60),
  tipe text not null check (tipe in ('cicilan_tetap', 'berbunga')),
  tanggal_mulai date not null,
  pokok_awal bigint not null check (pokok_awal > 0),
  nominal_cicilan bigint,
  tenor_bulan int,
  bunga_persen_bulanan numeric(5, 2),
  metode text check (metode in ('flat', 'efektif')),
  diarsip boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  -- "is not null" eksplisit: check bernilai NULL dianggap lolos.
  constraint debts_kolom_per_tipe check (
    (
      tipe = 'cicilan_tetap'
      and nominal_cicilan is not null and nominal_cicilan > 0
      and tenor_bulan is not null and tenor_bulan between 1 and 60
      and bunga_persen_bulanan is null
      and metode is null
    )
    or (
      tipe = 'berbunga'
      and bunga_persen_bulanan is not null and bunga_persen_bulanan between 0 and 100
      and metode is not null
      and nominal_cicilan is null
      and tenor_bulan is null
    )
  ),
  -- Cicilan tetap: pokok_awal selalu = nominal_cicilan x tenor_bulan (dihitung server).
  constraint debts_pokok_cicilan check (
    tipe <> 'cicilan_tetap' or pokok_awal = nominal_cicilan * tenor_bulan
  )
);

create index debts_user_id_idx on public.debts (user_id);

-- ---------------------------------------------------------------- debt_schedule

create table public.debt_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  debt_id uuid not null,
  jatuh_tempo date not null,
  nominal bigint not null check (nominal > 0),
  status text not null default 'belum' check (status in ('belum', 'lunas')),
  transaction_id uuid references public.transactions (id) on delete set null,
  unique (debt_id, jatuh_tempo),
  -- Tagihan hanya boleh merujuk hutang milik user yang sama.
  constraint debt_schedule_debt_owner_fkey
    foreign key (debt_id, user_id) references public.debts (id, user_id) on delete cascade
);

create index debt_schedule_user_id_idx on public.debt_schedule (user_id);
create index debt_schedule_transaction_id_idx on public.debt_schedule (transaction_id);

-- ---------------------------------------------------------------- transactions

-- MATCH SIMPLE: debt_id NULL tetap diizinkan untuk transaksi non-hutang.
alter table public.transactions
  add constraint transactions_debt_owner_fkey
    foreign key (debt_id, user_id) references public.debts (id, user_id) on delete cascade,
  add constraint transactions_hutang_wajib_debt
    check (jenis not in ('hutang_baru', 'hutang_bayar') or debt_id is not null),
  add constraint transactions_debt_hanya_hutang
    check (debt_id is null or jenis in ('hutang_baru', 'hutang_bayar', 'penyesuaian')),
  add constraint transactions_bayar_wajib_dompet
    check (jenis <> 'hutang_bayar' or wallet_id is not null),
  -- Penyesuaian hutang: tanpa dompet, nominal = porsi_pokok (bertanda).
  add constraint transactions_penyesuaian_hutang
    check (
      jenis <> 'penyesuaian' or debt_id is null
      or (wallet_id is null and porsi_pokok is not null and porsi_pokok = nominal)
    );

create index transactions_debt_id_idx on public.transactions (debt_id);

-- ---------------------------------------------------------------- RLS

alter table public.debts enable row level security;
alter table public.debt_schedule enable row level security;

create policy debts_select_own on public.debts
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy debts_insert_own on public.debts
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy debts_update_own on public.debts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy debts_delete_own on public.debts
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy debt_schedule_select_own on public.debt_schedule
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy debt_schedule_insert_own on public.debt_schedule
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy debt_schedule_update_own on public.debt_schedule
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy debt_schedule_delete_own on public.debt_schedule
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- v_hutang

-- security_invoker: RLS tabel dasar berlaku untuk pemanggil view.
create view public.v_hutang
with (security_invoker = true)
as
select
  d.id,
  d.user_id,
  d.pemberi,
  d.tipe,
  d.tanggal_mulai,
  d.pokok_awal,
  d.nominal_cicilan,
  d.tenor_bulan,
  d.bunga_persen_bulanan,
  d.metode,
  d.diarsip,
  d.created_at,
  (d.pokok_awal - coalesce(t.pokok, 0))::bigint as sisa_pokok,
  coalesce(t.bunga, 0)::bigint as total_bunga,
  coalesce(t.bayar, 0)::bigint as total_bayar,
  coalesce(j.jumlah, 0)::int as jumlah_tagihan,
  coalesce(j.lunas, 0)::int as tagihan_lunas,
  j.berikutnya as jatuh_tempo_berikutnya,
  n.nominal as nominal_berikutnya,
  j.terakhir as jatuh_tempo_terakhir,
  t.bayar_terakhir
from public.debts d
left join lateral (
  select
    sum(x.porsi_pokok) filter (where x.jenis in ('hutang_bayar', 'penyesuaian')) as pokok,
    sum(x.porsi_bunga) filter (where x.jenis = 'hutang_bayar') as bunga,
    sum(x.nominal) filter (where x.jenis = 'hutang_bayar') as bayar,
    max(x.tanggal) filter (where x.jenis = 'hutang_bayar') as bayar_terakhir
  from public.transactions x
  where x.debt_id = d.id
) t on true
left join lateral (
  select
    count(*) as jumlah,
    count(*) filter (where s.status = 'lunas') as lunas,
    min(s.jatuh_tempo) filter (where s.status = 'belum') as berikutnya,
    max(s.jatuh_tempo) filter (where s.status = 'belum') as terakhir
  from public.debt_schedule s
  where s.debt_id = d.id
) j on true
left join lateral (
  select s.nominal
  from public.debt_schedule s
  where s.debt_id = d.id and s.status = 'belum'
  order by s.jatuh_tempo
  limit 1
) n on true;

-- ---------------------------------------------------------------- grants

revoke all on public.debts from public, anon;
revoke all on public.debt_schedule from public, anon;
revoke all on public.v_hutang from public, anon;

grant select, insert, update, delete on public.debts to authenticated;
grant select, insert, update, delete on public.debt_schedule to authenticated;
grant select on public.v_hutang to authenticated;
