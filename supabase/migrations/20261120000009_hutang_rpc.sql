-- Rencana 3: hitung ulang hutang (pecah bunga/pokok + status jadwal), trigger, tambah_jadwal,
-- dan save_transactions v3 (menerima hutang_baru, hutang_bayar, penyesuaian dengan debt_id).

-- ---------------------------------------------------------------- hitung_ulang_hutang

-- Dipanggil hanya dari trigger (pg_trigger_depth() >= 1). security invoker: RLS tetap berlaku,
-- jadi authenticated perlu EXECUTE (trigger berjalan sebagai pemanggil DML); panggilan langsung
-- lewat PostgREST (kedalaman trigger 0) ditolak.
create function public.hitung_ulang_hutang(p_debt uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tipe text;
  v_pokok_awal bigint;
  v_metode text;
  v_rate numeric;
  v_sisa bigint;
  v_bulan date;
  v_bulan_ini date;
  v_bunga bigint;
  v_pb bigint;
  v_pp bigint;
  r record;
begin
  if pg_trigger_depth() < 1 then
    raise exception 'hitung_ulang_hutang hanya dipanggil oleh trigger';
  end if;

  -- Kunci baris hutang agar pembayaran paralel ke hutang yang sama dihitung berurutan.
  select d.tipe, d.pokok_awal, d.metode, d.bunga_persen_bulanan / 100
    into v_tipe, v_pokok_awal, v_metode, v_rate
  from public.debts d
  where d.id = p_debt
  for no key update;

  if not found then
    return; -- hutang sudah tidak ada (mis. sedang dihapus cascade)
  end if;

  -- 1) Pecah bunga/pokok setiap hutang_bayar, urut (tanggal, created_at, id).
  v_sisa := v_pokok_awal;
  v_bulan := null;

  for r in
    select t.id, t.jenis, t.tanggal, t.nominal, t.porsi_bunga, t.porsi_pokok
    from public.transactions t
    where t.debt_id = p_debt
      and t.jenis in ('hutang_bayar', 'penyesuaian')
    order by t.tanggal, t.created_at, t.id
  loop
    if r.jenis = 'penyesuaian' then
      -- porsi_pokok bertanda: positif mengurangi sisa, negatif menambah sisa. Tidak diubah.
      v_sisa := v_sisa - coalesce(r.porsi_pokok, 0);
    else
      v_pb := 0;
      if v_tipe = 'berbunga' then
        v_bulan_ini := date_trunc('month', r.tanggal::timestamp)::date;
        -- Bunga hanya pada pembayaran pertama di bulan kalender itu; tidak menumpuk.
        if v_bulan is distinct from v_bulan_ini then
          v_bulan := v_bulan_ini;
          if v_sisa <= 0 then
            v_bunga := 0; -- sudah lunas: tidak ada bunga, pembayaran lagi = lebih bayar
          elsif v_metode = 'flat' then
            v_bunga := round(v_pokok_awal * v_rate)::bigint;
          else
            v_bunga := round(v_sisa * v_rate)::bigint;
          end if;
          v_pb := least(r.nominal, v_bunga);
        end if;
      end if;
      v_pp := r.nominal - v_pb;
      v_sisa := v_sisa - v_pp;

      if r.porsi_bunga is distinct from v_pb or r.porsi_pokok is distinct from v_pp then
        update public.transactions t
        set porsi_bunga = v_pb, porsi_pokok = v_pp
        where t.id = r.id;
      end if;
    end if;

    if v_sisa < 0 then
      raise exception 'Pembayaran melebihi sisa hutang';
    end if;
  end loop;

  -- 2) Status jadwal dari kumulatif nominal hutang_bayar. Tagihan ke-k lunas bila
  --    kumulatif bayar >= jumlah nominal tagihan 1..k; transaction_id = pembayaran pertama
  --    yang membuat kumulatif mencapai angka itu.
  with bayar as (
    select
      t.id,
      sum(t.nominal) over (order by t.tanggal, t.created_at, t.id) as kumulatif
    from public.transactions t
    where t.debt_id = p_debt
      and t.jenis = 'hutang_bayar'
  ),
  tagihan as (
    select
      s.id,
      sum(s.nominal) over (order by s.jatuh_tempo) as perlu
    from public.debt_schedule s
    where s.debt_id = p_debt
  ),
  hasil as (
    select
      tg.id,
      (
        select b.id
        from bayar b
        where b.kumulatif >= tg.perlu
        order by b.kumulatif
        limit 1
      ) as tx_id
    from tagihan tg
  )
  update public.debt_schedule s
  set
    status = case when hs.tx_id is null then 'belum' else 'lunas' end,
    transaction_id = hs.tx_id
  from hasil hs
  where s.id = hs.id
    and (
      s.status <> case when hs.tx_id is null then 'belum' else 'lunas' end
      or s.transaction_id is distinct from hs.tx_id
    );
end;
$$;

revoke execute on function public.hitung_ulang_hutang(uuid) from public, anon;
grant execute on function public.hitung_ulang_hutang(uuid) to authenticated;

-- ---------------------------------------------------------------- trigger transactions

create function public.trg_transactions_hutang()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tipe text;
  v_diarsip boolean;
begin
  -- Update porsi oleh hitung_ulang_hutang sendiri, atau hapus cascade dari debts/auth.users.
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if new.debt_id is not null and new.jenis in ('hutang_bayar', 'penyesuaian') then
      select d.tipe, d.diarsip into v_tipe, v_diarsip
      from public.debts d
      where d.id = new.debt_id;

      if v_diarsip then
        raise exception 'Hutang sudah diarsipkan';
      end if;
      if new.jenis = 'penyesuaian' and v_tipe = 'cicilan_tetap' then
        raise exception 'Penyesuaian hanya untuk hutang berbunga';
      end if;
    end if;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    if old.debt_id is not null then
      perform public.hitung_ulang_hutang(old.debt_id);
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.debt_id is not null then
      perform public.hitung_ulang_hutang(new.debt_id);
    end if;
  elsif tg_op = 'UPDATE' then
    if new.debt_id is not null and new.debt_id is distinct from old.debt_id then
      perform public.hitung_ulang_hutang(new.debt_id);
    end if;
  end if;

  return null;
end;
$$;

revoke execute on function public.trg_transactions_hutang() from public, anon, authenticated;

create trigger transactions_hutang_aiud
  after insert or delete or update of tanggal, nominal, debt_id, jenis, porsi_pokok
  on public.transactions
  for each row execute function public.trg_transactions_hutang();

-- ---------------------------------------------------------------- trigger debts

create function public.trg_debts_hitung_ulang()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  perform public.hitung_ulang_hutang(new.id);
  return null;
end;
$$;

revoke execute on function public.trg_debts_hitung_ulang() from public, anon, authenticated;

create trigger debts_hitung_ulang_au
  after update of pokok_awal, bunga_persen_bulanan, metode
  on public.debts
  for each row
  when (
    old.pokok_awal is distinct from new.pokok_awal
    or old.bunga_persen_bulanan is distinct from new.bunga_persen_bulanan
    or old.metode is distinct from new.metode
  )
  execute function public.trg_debts_hitung_ulang();

-- ---------------------------------------------------------------- trigger debt_schedule

-- Tagihan ditambah/diubah/dihapus (tambah_jadwal atau langsung lewat PostgREST) -> status
-- dihitung ulang. Update status/transaction_id oleh hitung_ulang_hutang tidak memicu ini.
create function public.trg_debt_schedule_hitung_ulang()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  if tg_op = 'DELETE' then
    perform public.hitung_ulang_hutang(old.debt_id);
  else
    perform public.hitung_ulang_hutang(new.debt_id);
    if tg_op = 'UPDATE' and old.debt_id is distinct from new.debt_id then
      perform public.hitung_ulang_hutang(old.debt_id);
    end if;
  end if;

  return null;
end;
$$;

revoke execute on function public.trg_debt_schedule_hitung_ulang() from public, anon, authenticated;

create trigger debt_schedule_hitung_ulang_aiud
  after insert or delete or update of debt_id, jatuh_tempo, nominal
  on public.debt_schedule
  for each row execute function public.trg_debt_schedule_hitung_ulang();

-- ---------------------------------------------------------------- tambah_jadwal

create function public.tambah_jadwal(p_debt uuid, p_jatuh_tempo date, p_nominal bigint)
returns public.debt_schedule
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tipe text;
  v_id uuid;
  v_hasil public.debt_schedule;
begin
  select d.tipe into v_tipe
  from public.debts d
  where d.id = p_debt and d.user_id = (select auth.uid());

  if not found then
    raise exception 'Hutang tidak ditemukan';
  end if;
  if v_tipe <> 'berbunga' then
    raise exception 'Jadwal manual hanya untuk hutang berbunga';
  end if;
  if p_jatuh_tempo is null then
    raise exception 'Tanggal jatuh tempo wajib diisi';
  end if;
  if p_nominal is null or p_nominal <= 0 then
    raise exception 'Nominal tagihan wajib lebih dari 0';
  end if;

  -- Trigger debt_schedule_hitung_ulang_aiud menghitung ulang status setelah statement ini.
  insert into public.debt_schedule as s (debt_id, jatuh_tempo, nominal)
  values (p_debt, p_jatuh_tempo, p_nominal)
  on conflict (debt_id, jatuh_tempo) do update set nominal = excluded.nominal
  returning s.id into v_id;

  select s.* into v_hasil
  from public.debt_schedule s
  where s.id = v_id;

  return v_hasil;
end;
$$;

revoke execute on function public.tambah_jadwal(uuid, date, bigint) from public, anon;
grant execute on function public.tambah_jadwal(uuid, date, bigint) to authenticated;

-- ---------------------------------------------------------------- save_transactions v3

create or replace function public.save_transactions(items jsonb)
returns setof public.transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  it jsonb;
  v_h jsonb;
  v_id uuid;
  v_seen uuid[] := '{}';
  v_debts_baru uuid[] := '{}';
  v_jenis text;
  v_wallet uuid;
  v_tujuan uuid;
  v_debt uuid;
  v_kategori text;
  v_tanggal jsonb;
  v_porsi_bunga bigint;
  v_porsi_pokok bigint;
  v_pemberi text;
  v_tipe text;
  v_mulai date;
  v_cicilan bigint;
  v_tenor int;
  v_jt1 date;
  v_pokok bigint;
  v_bunga numeric;
  v_metode text;
  v_sisa_skrg bigint;
  v_baru boolean;
  v_rows jsonb := '[]';
  v_ids uuid[];
begin
  if items is null or jsonb_typeof(items) <> 'array' then
    raise exception 'items harus berupa array JSON';
  end if;
  if jsonb_array_length(items) > 50 then
    raise exception 'Terlalu banyak transaksi sekaligus (maks 50)';
  end if;

  for it in select * from jsonb_array_elements(items) loop
    if jsonb_typeof(it) <> 'object' then
      raise exception 'Setiap item harus berupa objek';
    end if;

    v_id := nullif(it->>'id', '')::uuid;
    if v_id is null then
      raise exception 'id transaksi wajib diisi';
    end if;
    if v_id = any (v_seen) then
      raise exception 'id transaksi ganda dalam satu permintaan';
    end if;
    v_seen := v_seen || v_id;

    v_jenis := it->>'jenis';
    v_wallet := nullif(it->>'wallet_id', '')::uuid;
    v_tujuan := nullif(it->>'wallet_tujuan_id', '')::uuid;
    v_debt := nullif(it->>'debt_id', '')::uuid;
    v_kategori := it->>'kategori';
    v_tanggal := it->'tanggal';
    v_porsi_bunga := null;
    v_porsi_pokok := null;
    v_baru := false;

    if v_jenis is null or v_jenis not in (
      'pemasukan', 'pengeluaran', 'transfer', 'penyesuaian', 'hutang_baru', 'hutang_bayar'
    ) then
      raise exception 'Jenis transaksi tidak valid';
    end if;

    if v_debt is not null and v_jenis not in ('hutang_baru', 'hutang_bayar', 'penyesuaian') then
      raise exception 'Hutang hanya untuk transaksi hutang atau penyesuaian';
    end if;

    -- Dompet: opsional untuk hutang_baru, harus kosong untuk penyesuaian hutang,
    -- wajib untuk jenis lain (termasuk hutang_bayar).
    if v_jenis = 'penyesuaian' and v_debt is not null then
      if v_wallet is not null then
        raise exception 'Penyesuaian hutang tidak memakai dompet';
      end if;
    elsif v_jenis <> 'hutang_baru' then
      if v_wallet is null then
        raise exception 'Dompet wajib diisi';
      end if;
    end if;
    if v_wallet is not null and not exists (
      select 1 from public.wallets w
      where w.id = v_wallet and w.user_id = (select auth.uid())
    ) then
      raise exception 'Dompet tidak ditemukan';
    end if;

    if v_jenis <> 'transfer' and v_tujuan is not null then
      raise exception 'Dompet tujuan hanya untuk transfer';
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

    if v_jenis = 'hutang_bayar' then
      -- porsi_* dari app diabaikan; trigger transactions_hutang_aiud menghitungnya.
      if v_debt is null then
        raise exception 'Hutang tidak ditemukan';
      end if;
      select d.pemberi into v_pemberi
      from public.debts d
      where d.id = v_debt and d.user_id = (select auth.uid());
      if not found then
        raise exception 'Hutang tidak ditemukan';
      end if;
      v_kategori := coalesce(nullif(trim(v_kategori), ''), v_pemberi);

    elsif v_jenis = 'penyesuaian' and v_debt is not null then
      if not exists (
        select 1 from public.debts d
        where d.id = v_debt and d.user_id = (select auth.uid())
      ) then
        raise exception 'Hutang tidak ditemukan';
      end if;
      v_porsi_bunga := 0;
      v_porsi_pokok := nullif(it->>'nominal', '')::bigint;

    elsif v_jenis = 'hutang_baru' then
      if v_debt is null then
        raise exception 'id hutang wajib diisi';
      end if;
      if v_debt = any (v_debts_baru) then
        raise exception 'id hutang ganda dalam satu permintaan';
      end if;
      v_debts_baru := v_debts_baru || v_debt;

      v_h := it->'hutang';
      if v_h is null or jsonb_typeof(v_h) <> 'object' then
        raise exception 'Data hutang wajib diisi';
      end if;

      v_pemberi := nullif(trim(v_h->>'pemberi'), '');
      if v_pemberi is null then
        raise exception 'Nama pemberi wajib diisi';
      end if;
      if length(v_pemberi) > 60 then
        raise exception 'Nama pemberi maksimal 60 karakter';
      end if;

      v_tipe := v_h->>'tipe';
      if v_tipe is null or v_tipe not in ('cicilan_tetap', 'berbunga') then
        raise exception 'Tipe hutang tidak valid';
      end if;

      v_mulai := coalesce(
        nullif(v_h->>'tanggal_mulai', '')::date,
        nullif(it->>'tanggal', '')::date
      );
      if v_mulai is null then
        raise exception 'Tanggal mulai wajib diisi';
      end if;

      v_cicilan := null;
      v_tenor := null;
      v_jt1 := null;
      v_pokok := null;
      v_bunga := null;
      v_metode := null;
      v_sisa_skrg := null;

      if v_tipe = 'cicilan_tetap' then
        v_cicilan := nullif(v_h->>'nominal_cicilan', '')::bigint;
        if v_cicilan is null or v_cicilan <= 0 then
          raise exception 'Nominal cicilan wajib diisi';
        end if;
        v_tenor := nullif(v_h->>'tenor_bulan', '')::int;
        if v_tenor is null or v_tenor not between 1 and 60 then
          raise exception 'Tenor 1–60 bulan';
        end if;
        v_jt1 := nullif(v_h->>'jatuh_tempo_pertama', '')::date;
        if v_jt1 is null then
          raise exception 'Jatuh tempo pertama wajib diisi';
        end if;
        v_pokok := v_cicilan * v_tenor;
      else
        v_pokok := nullif(v_h->>'pokok_awal', '')::bigint;
        if v_pokok is null or v_pokok <= 0 then
          raise exception 'Pokok awal wajib diisi';
        end if;
        v_bunga := nullif(v_h->>'bunga_persen_bulanan', '')::numeric;
        if v_bunga is null or v_bunga < 0 or v_bunga > 100 then
          raise exception 'Bunga 0–100%% per bulan';
        end if;
        v_metode := v_h->>'metode';
        if v_metode is null or v_metode not in ('flat', 'efektif') then
          raise exception 'Metode bunga flat atau efektif';
        end if;
        v_sisa_skrg := nullif(v_h->>'sisa_pokok_sekarang', '')::bigint;
        if v_sisa_skrg is not null and v_sisa_skrg > v_pokok then
          raise exception 'Sisa pokok tidak boleh lebih dari pokok awal';
        end if;
        if v_sisa_skrg is not null and v_sisa_skrg < 0 then
          raise exception 'Sisa pokok tidak boleh negatif';
        end if;
      end if;

      -- id hutang dibuat app dan stabil antarpercobaan: simpan ulang tidak menggandakan.
      insert into public.debts (
        id, pemberi, tipe, tanggal_mulai, pokok_awal,
        nominal_cicilan, tenor_bulan, bunga_persen_bulanan, metode
      )
      values (
        v_debt, v_pemberi, v_tipe, v_mulai, v_pokok,
        v_cicilan, v_tenor, v_bunga, v_metode
      )
      on conflict (id) do nothing;
      v_baru := found;

      if not exists (
        select 1 from public.debts d
        where d.id = v_debt and d.user_id = (select auth.uid())
      ) then
        raise exception 'Hutang tidak ditemukan';
      end if;

      if v_baru and v_tipe = 'cicilan_tetap' then
        -- Tanggal + k bulan dari jatuh tempo pertama (akhir bulan mengikuti Postgres).
        insert into public.debt_schedule (debt_id, jatuh_tempo, nominal)
        select v_debt, (v_jt1 + interval '1 month' * g.k)::date, v_cicilan
        from generate_series(0, v_tenor - 1) as g(k)
        on conflict (debt_id, jatuh_tempo) do nothing;
      end if;

      v_kategori := v_pemberi;
      v_tanggal := to_jsonb(coalesce(nullif(it->>'tanggal', '')::date, v_mulai));
    end if;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'id', v_id,
      'tanggal', v_tanggal,
      'jenis', v_jenis,
      'kategori', v_kategori,
      'nominal', it->'nominal',
      'wallet_id', v_wallet,
      'wallet_tujuan_id', v_tujuan,
      'debt_id', v_debt,
      'porsi_bunga', v_porsi_bunga,
      'porsi_pokok', v_porsi_pokok,
      'catatan', it->'catatan',
      'transkrip', it->'transkrip',
      'sumber', it->'sumber'
    ));

    -- Berbunga yang sudah berjalan: selisih pokok dicatat sebagai penyesuaian (id deterministik).
    if v_jenis = 'hutang_baru' and v_baru and v_tipe = 'berbunga'
       and v_sisa_skrg is not null and v_sisa_skrg < v_pokok then
      v_rows := v_rows || jsonb_build_array(jsonb_build_object(
        'id', md5(v_debt::text || ':awal')::uuid,
        'tanggal', v_mulai,
        'jenis', 'penyesuaian',
        'kategori', 'penyesuaian',
        'nominal', v_pokok - v_sisa_skrg,
        'wallet_id', null,
        'wallet_tujuan_id', null,
        'debt_id', v_debt,
        'porsi_bunga', 0,
        'porsi_pokok', v_pokok - v_sisa_skrg,
        'catatan', 'Sudah dibayar sebelum pakai arta',
        'transkrip', null,
        'sumber', it->'sumber'
      ));
    end if;
  end loop;

  -- Trigger after-row berjalan di akhir statement ini, jadi porsi sudah dihitung saat
  -- baris dibaca ulang di bawah.
  with ins as (
    insert into public.transactions (
      id, tanggal, jenis, kategori, nominal, wallet_id, wallet_tujuan_id, debt_id,
      porsi_bunga, porsi_pokok, catatan, transkrip, sumber
    )
    select
      x.id, x.tanggal, x.jenis, x.kategori, x.nominal, x.wallet_id, x.wallet_tujuan_id,
      x.debt_id, x.porsi_bunga, x.porsi_pokok, x.catatan, x.transkrip,
      coalesce(x.sumber, 'manual')
    from jsonb_to_recordset(v_rows) as x(
      id uuid, tanggal date, jenis text, kategori text, nominal bigint,
      wallet_id uuid, wallet_tujuan_id uuid, debt_id uuid,
      porsi_bunga bigint, porsi_pokok bigint,
      catatan text, transkrip text, sumber text
    )
    on conflict (id) do nothing
    returning id
  )
  select coalesce(array_agg(ins.id), '{}') into v_ids from ins;

  return query
  select t.*
  from public.transactions t
  join jsonb_array_elements(v_rows) with ordinality as e(val, n)
    on (e.val->>'id')::uuid = t.id
  where t.id = any (v_ids)
  order by e.n;
end;
$$;

revoke execute on function public.save_transactions(jsonb) from public, anon;
grant execute on function public.save_transactions(jsonb) to authenticated;
