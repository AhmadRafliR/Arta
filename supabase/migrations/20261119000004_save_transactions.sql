-- RPC save_transactions: simpan banyak transaksi sekaligus (semua atau tidak sama sekali).
-- security invoker: RLS tetap berlaku. user_id dari klien diabaikan (default auth.uid()).
-- Rencana 3 akan menggantinya dengan versi yang menangani hutang.

create function public.save_transactions(items jsonb)
returns setof public.transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  it jsonb;
  v_jenis text;
  v_wallet uuid;
  v_tujuan uuid;
begin
  if items is null or jsonb_typeof(items) <> 'array' then
    raise exception 'items harus berupa array JSON';
  end if;

  for it in select * from jsonb_array_elements(items) loop
    if jsonb_typeof(it) <> 'object' then
      raise exception 'Setiap item harus berupa objek';
    end if;

    v_jenis := it->>'jenis';
    v_wallet := nullif(it->>'wallet_id', '')::uuid;
    v_tujuan := nullif(it->>'wallet_tujuan_id', '')::uuid;

    if v_jenis in ('hutang_baru', 'hutang_bayar') then
      raise exception 'Jenis hutang belum didukung';
    end if;
    if v_jenis is null or v_jenis not in ('pemasukan', 'pengeluaran', 'transfer', 'penyesuaian') then
      raise exception 'Jenis transaksi tidak valid';
    end if;

    if v_wallet is null then
      raise exception 'Dompet wajib diisi';
    end if;
    if not exists (
      select 1 from public.wallets w
      where w.id = v_wallet and w.user_id = (select auth.uid())
    ) then
      raise exception 'Dompet tidak ditemukan';
    end if;

    if v_jenis = 'transfer' then
      if v_tujuan is null then
        raise exception 'Dompet tujuan wajib diisi untuk transfer';
      end if;
      if v_tujuan = v_wallet then
        raise exception 'Dompet tujuan tidak boleh sama dengan dompet asal';
      end if;
      if not exists (
        select 1 from public.wallets w
        where w.id = v_tujuan and w.user_id = (select auth.uid())
      ) then
        raise exception 'Dompet tujuan tidak ditemukan';
      end if;
    end if;
  end loop;

  return query
  insert into public.transactions
    (id, tanggal, jenis, kategori, nominal, wallet_id, wallet_tujuan_id, catatan, transkrip, sumber)
  select
    coalesce(x.id, gen_random_uuid()), x.tanggal, x.jenis, x.kategori, x.nominal,
    x.wallet_id, x.wallet_tujuan_id, x.catatan, x.transkrip, coalesce(x.sumber, 'manual')
  from jsonb_to_recordset(items) as x(
    id uuid, tanggal date, jenis text, kategori text, nominal bigint,
    wallet_id uuid, wallet_tujuan_id uuid, catatan text, transkrip text, sumber text
  )
  on conflict (id) do nothing
  returning *;
end;
$$;

revoke execute on function public.save_transactions(jsonb) from public, anon;
grant execute on function public.save_transactions(jsonb) to authenticated;
