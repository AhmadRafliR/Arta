-- Rencana 5: status langganan Pro dari RevenueCat (ditulis webhook dengan service role).
-- Tabel entitlements dibuat di 20261120000006 (rencana 2); di sini hanya ditambah kolom + fungsi.

alter table public.entitlements
  add column if not exists produk text,
  add column if not exists periode text,
  add column if not exists akan_diperpanjang boolean,
  add column if not exists event_terakhir_ms bigint,
  add column if not exists diperbarui_at timestamptz not null default now();

alter table public.entitlements
  drop constraint if exists entitlements_periode_check;
alter table public.entitlements
  add constraint entitlements_periode_check
  check (periode is null or periode in ('normal', 'trial', 'intro'));

-- Pro aktif = pro_aktif dan (berlaku_sampai kosong atau di masa depan). Sama dengan aturan kuota_ai().
create or replace function public.pro_aktif(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = p_user and e.pro_aktif
      and (e.berlaku_sampai is null or e.berlaku_sampai > now())
  );
$$;
revoke execute on function public.pro_aktif(uuid) from public, anon, authenticated;
grant execute on function public.pro_aktif(uuid) to service_role;

-- Status langganan milik pemanggil (dibaca app).
create or replace function public.status_langganan()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_e public.entitlements;
begin
  if v_user is null then
    raise exception 'Tidak terautentikasi';
  end if;
  select * into v_e from public.entitlements where user_id = v_user;
  return jsonb_build_object(
    'pro', public.pro_aktif(v_user),
    'berlaku_sampai', v_e.berlaku_sampai,
    'periode', v_e.periode,
    'produk', v_e.produk,
    'akan_diperpanjang', v_e.akan_diperpanjang
  );
end;
$$;
revoke execute on function public.status_langganan() from public, anon;
grant execute on function public.status_langganan() to authenticated;

-- Terapkan satu perubahan dari webhook RevenueCat. Event yang lebih lama dari yang tersimpan
-- diabaikan (RevenueCat bisa mengirim ulang/tidak berurutan). Mengembalikan true bila diterapkan.
create or replace function public.terapkan_event_langganan(
  p_user uuid,
  p_pro boolean,
  p_berlaku_sampai timestamptz,
  p_produk text,
  p_periode text,
  p_akan_diperpanjang boolean,
  p_event_ms bigint,
  p_sumber text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  if p_user is null or p_event_ms is null then
    raise exception 'p_user dan p_event_ms wajib';
  end if;
  -- Pengguna yang sudah dihapus: abaikan (FK akan gagal).
  if not exists (select 1 from auth.users where id = p_user) then
    return false;
  end if;

  insert into public.entitlements as e (
    user_id, pro_aktif, berlaku_sampai, sumber, produk, periode,
    akan_diperpanjang, event_terakhir_ms, diperbarui_at
  )
  values (
    p_user, p_pro, p_berlaku_sampai, p_sumber, p_produk, p_periode,
    p_akan_diperpanjang, p_event_ms, now()
  )
  on conflict (user_id) do update set
    pro_aktif = excluded.pro_aktif,
    berlaku_sampai = excluded.berlaku_sampai,
    sumber = excluded.sumber,
    produk = coalesce(excluded.produk, e.produk),
    periode = coalesce(excluded.periode, e.periode),
    akan_diperpanjang = excluded.akan_diperpanjang,
    event_terakhir_ms = excluded.event_terakhir_ms,
    diperbarui_at = now()
  where e.event_terakhir_ms is null or excluded.event_terakhir_ms >= e.event_terakhir_ms;

  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;
revoke execute on function public.terapkan_event_langganan(uuid, boolean, timestamptz, text, text, boolean, bigint, text)
  from public, anon, authenticated;
grant execute on function public.terapkan_event_langganan(uuid, boolean, timestamptz, text, text, boolean, bigint, text)
  to service_role;
