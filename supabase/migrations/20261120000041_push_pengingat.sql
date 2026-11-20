-- Rencana 5: Expo push token per perangkat, pengaturan pengingat jatuh tempo, dan log anti-dobel.
-- Data tagihan diambil Edge Function `debt-reminders` lewat RPC tagihan_untuk_pengingat (Rencana 3).

-- ---------------------------------------------------------------- push_tokens
-- Token = primary key: satu perangkat hanya milik satu akun. Mendaftar dari akun lain memindahkannya.
create table public.push_tokens (
  token text primary key,
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios', 'web')),
  diperbarui_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
create policy push_tokens_select_own on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_tokens from public, anon, authenticated;
grant select, delete on public.push_tokens to authenticated;
grant all on public.push_tokens to service_role;

create or replace function public.simpan_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Tidak terautentikasi';
  end if;
  if p_token is null or length(p_token) > 200
     or p_token !~ '^Expo(nent)?PushToken\[[^\]]+\]$' then
    raise exception 'Token push tidak valid' using errcode = 'P0001';
  end if;
  if p_platform is null or p_platform not in ('android', 'ios', 'web') then
    raise exception 'Platform tidak valid' using errcode = 'P0001';
  end if;
  insert into public.push_tokens (token, user_id, platform, diperbarui_at)
  values (p_token, v_user, p_platform, now())
  on conflict (token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    diperbarui_at = now();
end;
$$;

create or replace function public.hapus_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Tidak terautentikasi';
  end if;
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end;
$$;

revoke execute on function public.simpan_push_token(text, text) from public, anon;
revoke execute on function public.hapus_push_token(text) from public, anon;
grant execute on function public.simpan_push_token(text, text) to authenticated;
grant execute on function public.hapus_push_token(text) to authenticated;

-- ---------------------------------------------------------------- pengaturan_pengingat
-- Tanpa baris = bawaan: aktif, H-1, pukul 08.00 (zona waktu profil).
create table public.pengaturan_pengingat (
  user_id uuid primary key default auth.uid()
    references auth.users (id) on delete cascade,
  aktif boolean not null default true,
  hari_sebelum smallint not null default 1 check (hari_sebelum in (0, 1, 3)),
  jam smallint not null default 8 check (jam between 0 and 23),
  diperbarui_at timestamptz not null default now()
);

alter table public.pengaturan_pengingat enable row level security;
create policy pengaturan_pengingat_select_own on public.pengaturan_pengingat
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy pengaturan_pengingat_insert_own on public.pengaturan_pengingat
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy pengaturan_pengingat_update_own on public.pengaturan_pengingat
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.pengaturan_pengingat from public, anon, authenticated;
grant select, insert, update on public.pengaturan_pengingat to authenticated;
grant all on public.pengaturan_pengingat to service_role;

-- ---------------------------------------------------------------- log_pengingat
-- Kunci = "<tagihan_id>:<jatuh_tempo>:<hari_ini_lokal>" agar cron yang berjalan ulang tidak mengirim dua kali.
create table public.log_pengingat (
  user_id uuid not null references auth.users (id) on delete cascade,
  kunci text not null,
  dikirim_at timestamptz not null default now(),
  primary key (user_id, kunci)
);
alter table public.log_pengingat enable row level security;
revoke all on public.log_pengingat from public, anon, authenticated;
grant all on public.log_pengingat to service_role;

-- ---------------------------------------------------------------- penerima_pengingat (service role)
create or replace function public.penerima_pengingat()
returns table (
  user_id uuid,
  tokens text[],
  hari_sebelum smallint,
  jam smallint,
  zona_waktu text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.user_id,
    array_agg(t.token order by t.diperbarui_at desc) as tokens,
    coalesce(pp.hari_sebelum, 1::smallint) as hari_sebelum,
    coalesce(pp.jam, 8::smallint) as jam,
    coalesce(nullif(p.zona_waktu, ''), 'Asia/Jakarta') as zona_waktu
  from public.push_tokens t
  left join public.pengaturan_pengingat pp on pp.user_id = t.user_id
  left join public.profiles p on p.id = t.user_id
  where coalesce(pp.aktif, true)
    and public.pro_aktif(t.user_id)
  group by t.user_id, pp.hari_sebelum, pp.jam, p.zona_waktu;
$$;
revoke execute on function public.penerima_pengingat() from public, anon, authenticated;
grant execute on function public.penerima_pengingat() to service_role;
