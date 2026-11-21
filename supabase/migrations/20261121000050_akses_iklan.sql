-- Akses sementara untuk pengguna gratis setelah menonton iklan reward sampai selesai.
-- Fitur: 'ekspor' (ekspor data) dan 'laporan' (kirim laporan email manual).
-- Versi 1: klaim dari klien (setelah SDK iklan melaporkan hadiah diterima). Belum diverifikasi server
-- (AdMob SSV), jadi bisa dilewati pengguna yang memanggil RPC langsung: dampaknya hanya hilangnya
-- pendapatan iklan, karena batas kirim laporan (3 kali/hari, penerima terverifikasi) tetap berlaku di server.

create table public.akses_iklan (
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  fitur text not null check (fitur in ('ekspor', 'laporan')),
  berlaku_sampai timestamptz not null,
  diperbarui_at timestamptz not null default now(),
  primary key (user_id, fitur)
);

alter table public.akses_iklan enable row level security;
create policy akses_iklan_select_own on public.akses_iklan
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.akses_iklan from public, anon, authenticated;
grant select on public.akses_iklan to authenticated;
grant all on public.akses_iklan to service_role;

-- Klaim akses 30 menit. Jeda minimal 20 detik antarklaim per fitur agar tidak dipanggil beruntun.
create or replace function public.klaim_akses_iklan(p_fitur text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_sampai timestamptz := now() + interval '30 minutes';
  v_terakhir timestamptz;
begin
  if v_user is null then
    raise exception 'Tidak terautentikasi';
  end if;
  if p_fitur is null or p_fitur not in ('ekspor', 'laporan') then
    raise exception 'Fitur tidak dikenal';
  end if;

  select a.diperbarui_at into v_terakhir
  from public.akses_iklan a
  where a.user_id = v_user and a.fitur = p_fitur;
  if v_terakhir is not null and v_terakhir > now() - interval '20 seconds' then
    raise exception 'Terlalu cepat, coba lagi sebentar';
  end if;

  insert into public.akses_iklan (user_id, fitur, berlaku_sampai, diperbarui_at)
  values (v_user, p_fitur, v_sampai, now())
  on conflict (user_id, fitur) do update
    set berlaku_sampai = excluded.berlaku_sampai, diperbarui_at = now();
  return v_sampai;
end;
$$;

revoke execute on function public.klaim_akses_iklan(text) from public, anon;
grant execute on function public.klaim_akses_iklan(text) to authenticated;
