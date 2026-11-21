-- Saldo per dompet dihitung di database (satu permintaan kecil) alih-alih menarik SELURUH transaksi
-- ke HP lalu menjumlahkannya. Logika sama persis dengan walletBalances (src/domain/balances.ts):
--   saldo = saldo_awal
--         + pemasukan, hutang_baru, penyesuaian (nominal bertanda)
--         - pengeluaran, hutang_bayar
--         - transfer keluar (wallet_id) + transfer masuk (wallet_tujuan_id)
-- Dompet arsip ikut dihitung. security invoker: RLS wallets/transactions tetap berlaku (hanya milik sendiri).

create or replace function public.saldo_dompet()
returns table (wallet_id uuid, saldo bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with efek as (
    select t.wallet_id as id,
           case t.jenis
             when 'pemasukan' then t.nominal
             when 'hutang_baru' then t.nominal
             when 'penyesuaian' then t.nominal
             when 'pengeluaran' then -t.nominal
             when 'hutang_bayar' then -t.nominal
             when 'transfer' then -t.nominal
           end as delta
    from public.transactions t
    where t.wallet_id is not null
    union all
    select t.wallet_tujuan_id, t.nominal
    from public.transactions t
    where t.jenis = 'transfer' and t.wallet_tujuan_id is not null
  )
  select w.id, (w.saldo_awal + coalesce(sum(e.delta), 0))::bigint
  from public.wallets w
  left join efek e on e.id = w.id
  group by w.id, w.saldo_awal;
$$;

revoke execute on function public.saldo_dompet() from public, anon;
grant execute on function public.saldo_dompet() to authenticated;
