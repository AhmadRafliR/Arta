-- Kuota "catat AI": pemakaian per bulan (ai_usage) dan status Pro (entitlements).
-- Gratis 30 per bulan, Pro 600. Bulan dihitung di zona waktu profil (default Asia/Jakarta).
-- Pengguna hanya boleh membaca; penulisan hanya lewat fungsi security definer / service role.

create table public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  bulan text not null check (bulan ~ '^\d{4}-\d{2}$'),
  jumlah int not null default 0 check (jumlah >= 0),
  primary key (user_id, bulan)
);

create table public.entitlements (
  user_id uuid primary key references auth.users on delete cascade,
  pro_aktif boolean not null default false,
  berlaku_sampai timestamptz,
  sumber text
);

alter table public.ai_usage enable row level security;
alter table public.entitlements enable row level security;

create policy ai_usage_select_own on public.ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy entitlements_select_own on public.entitlements
  for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.ai_usage to authenticated;
grant select on public.entitlements to authenticated;

-- Bulan sekarang ("YYYY-MM") di zona waktu profil; zona kosong/tidak valid -> Asia/Jakarta.
create or replace function public.bulan_ai_sekarang(p_user uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_zona text;
begin
  select nullif(zona_waktu, '') into v_zona from public.profiles where id = p_user;
  begin
    return to_char(now() at time zone coalesce(v_zona, 'Asia/Jakarta'), 'YYYY-MM');
  exception when others then
    return to_char(now() at time zone 'Asia/Jakarta', 'YYYY-MM');
  end;
end;
$$;
revoke execute on function public.bulan_ai_sekarang(uuid) from public, anon, authenticated;

create or replace function public.kuota_ai()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_bulan text;
  v_pro boolean;
  v_terpakai int;
begin
  if v_user is null then
    raise exception 'Tidak terautentikasi';
  end if;
  v_bulan := public.bulan_ai_sekarang(v_user);
  select exists (
    select 1 from public.entitlements e
    where e.user_id = v_user and e.pro_aktif
      and (e.berlaku_sampai is null or e.berlaku_sampai > now())
  ) into v_pro;
  select coalesce(
    (select u.jumlah from public.ai_usage u where u.user_id = v_user and u.bulan = v_bulan), 0
  ) into v_terpakai;
  return jsonb_build_object(
    'bulan', v_bulan,
    'terpakai', v_terpakai,
    'batas', case when v_pro then 600 else 30 end,
    'pro', v_pro
  );
end;
$$;

create or replace function public.pakai_kuota_ai()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_bulan text;
  v_pro boolean;
  v_batas int;
  v_terpakai int;
  v_ok boolean := false;
begin
  if v_user is null then
    raise exception 'Tidak terautentikasi';
  end if;
  v_bulan := public.bulan_ai_sekarang(v_user);
  select exists (
    select 1 from public.entitlements e
    where e.user_id = v_user and e.pro_aktif
      and (e.berlaku_sampai is null or e.berlaku_sampai > now())
  ) into v_pro;
  v_batas := case when v_pro then 600 else 30 end;

  -- Pastikan baris ada, lalu kunci agar pemakaian paralel berurutan.
  insert into public.ai_usage (user_id, bulan, jumlah)
  values (v_user, v_bulan, 0)
  on conflict (user_id, bulan) do nothing;

  select u.jumlah into v_terpakai
  from public.ai_usage u
  where u.user_id = v_user and u.bulan = v_bulan
  for update;

  if v_terpakai < v_batas then
    update public.ai_usage set jumlah = jumlah + 1
    where user_id = v_user and bulan = v_bulan;
    v_terpakai := v_terpakai + 1;
    v_ok := true;
  end if;

  return jsonb_build_object(
    'ok', v_ok,
    'bulan', v_bulan,
    'terpakai', v_terpakai,
    'batas', v_batas,
    'pro', v_pro
  );
end;
$$;

revoke execute on function public.kuota_ai() from public, anon;
revoke execute on function public.pakai_kuota_ai() from public, anon;
grant execute on function public.kuota_ai() to authenticated;
grant execute on function public.pakai_kuota_ai() to authenticated;
