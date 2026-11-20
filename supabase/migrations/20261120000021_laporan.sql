-- Laporan email bulanan (Rencana 4): penerima laporan, log pengiriman, dan batas laju.
--
-- * report_recipients: pengguna hanya boleh menyisipkan kolom `email`, membaca, dan menghapus.
--   Kolom verifikasi (`terverifikasi`, `diverifikasi_pada`, `verifikasi_dikirim_pada`) hanya
--   diubah service role (Edge Function report-verify) atau fungsi tandai_verifikasi_dikirim.
--   Maksimal 3 penerima per pengguna (dijaga trigger dengan kunci advisory).
-- * report_log: hanya dibaca pengguna; ditulis lewat fungsi security definer atau service role.
--   Indeks unik parsial mencegah laporan `bulanan` terkirim dobel untuk bulan yang sama.

-- ---------------------------------------------------------------- report_recipients

create table public.report_recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  email text not null
    check (
      email = lower(btrim(email))
      and length(email) <= 254
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  terverifikasi boolean not null default false,
  diverifikasi_pada timestamptz,
  verifikasi_dikirim_pada timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, email)
);

-- Trigger sebelum insert: batas 3 penerima + reset kolom verifikasi.
--
-- Sengaja SECURITY INVOKER (bawaan), bukan security definer:
-- * Pemeriksaan "siapa yang menyisipkan" memakai `current_user`. Di fungsi security definer,
--   `current_user` selalu pemilik fungsi (postgres), sehingga pemeriksaan itu tidak berguna.
--   `session_user` juga tidak bisa dipakai: lewat PostgREST nilainya selalu `authenticator`.
--   `auth.role()` / `request.jwt.claims` bisa dipakai, tetapi kosong untuk koneksi langsung
--   (SQL editor, migrasi) dan bergantung pada GUC; `current_user` di fungsi invoker adalah peran
--   hasil `SET ROLE` PostgREST (anon / authenticated / service_role), atau `postgres` untuk
--   koneksi langsung, dan tidak bisa dipalsukan pemanggil.
-- * Hitungan penerima memakai hak pemanggil. Untuk `authenticated`, RLS select hanya
--   memperlihatkan baris milik sendiri; karena kebijakan insert mewajibkan
--   user_id = auth.uid(), baris yang dihitung tepat baris milik pengguna itu. Bila user_id
--   orang lain, hitungan bisa salah tetapi insert tetap ditolak WITH CHECK RLS
--   (dievaluasi setelah trigger BEFORE). service_role melewati RLS, jadi hitungannya lengkap.
-- * Catatan: fungsi security definer milik postgres yang kelak menyisipkan ke tabel ini akan
--   dianggap tepercaya (current_user = postgres). Saat ini tidak ada fungsi seperti itu.
-- Kunci advisory transaksi membuat insert paralel milik pengguna yang sama berurutan; plpgsql
-- (volatile, READ COMMITTED) mengambil snapshot baru untuk SELECT setelah kunci didapat,
-- sehingga baris yang baru di-commit transaksi sebelumnya ikut terhitung.
create function public.report_recipients_sebelum_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_jumlah int;
begin
  if new.user_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('penerima:' || new.user_id::text)
    );
    select count(*) into v_jumlah
    from public.report_recipients r
    where r.user_id = new.user_id;
    if v_jumlah >= 3 then
      raise exception 'Maksimal 3 penerima laporan';
    end if;
  end if;

  -- Lapis kedua selain grant kolom: hanya service role / koneksi admin yang boleh menyisipkan
  -- penerima yang sudah terverifikasi.
  if current_user not in ('service_role', 'postgres') then
    new.terverifikasi := false;
    new.diverifikasi_pada := null;
    new.verifikasi_dikirim_pada := null;
  end if;

  return new;
end;
$$;

-- Fungsi trigger tidak dipanggil langsung; hak EXECUTE tidak diperiksa saat trigger berjalan.
revoke execute on function public.report_recipients_sebelum_insert() from public, anon, authenticated;

create trigger report_recipients_sebelum_insert
  before insert on public.report_recipients
  for each row execute function public.report_recipients_sebelum_insert();

alter table public.report_recipients enable row level security;

create policy report_recipients_select_own on public.report_recipients
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy report_recipients_insert_own on public.report_recipients
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy report_recipients_delete_own on public.report_recipients
  for delete to authenticated
  using (user_id = (select auth.uid()));
-- Sengaja tanpa policy update: pengguna tidak boleh mengubah baris penerima.

-- Cabut semua hak bawaan dulu (termasuk hak kolom), lalu beri yang dibutuhkan.
revoke all on public.report_recipients from public, anon, authenticated;
grant select, delete on public.report_recipients to authenticated;
grant insert (email) on public.report_recipients to authenticated;
grant all on public.report_recipients to service_role;

-- ---------------------------------------------------------------- report_log

create table public.report_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bulan text not null check (bulan ~ '^\d{4}-\d{2}$'),
  jenis text not null check (jenis in ('bulanan', 'manual')),
  status text not null default 'proses'
    check (status in ('proses', 'terkirim', 'gagal')),
  jumlah_penerima int not null default 0 check (jumlah_penerima >= 0),
  created_at timestamptz not null default now()
);

-- Laporan otomatis hanya sekali per pengguna per bulan (baris disisipkan sebelum mengirim).
create unique index report_log_bulanan_unik
  on public.report_log (user_id, bulan)
  where jenis = 'bulanan';

-- Untuk hitungan batas laju kirim manual.
create index report_log_user_created_idx
  on public.report_log (user_id, created_at desc);

alter table public.report_log enable row level security;

create policy report_log_select_own on public.report_log
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.report_log from public, anon, authenticated;
grant select on public.report_log to authenticated;
grant all on public.report_log to service_role;

-- ---------------------------------------------------------------- fungsi batas laju
-- Semua fungsi di bawah security definer (melewati RLS sebagai pemilik), jadi setiap kueri
-- wajib menyaring user_id = auth.uid() sendiri. Pemanggil hanya bisa membatasi dirinya sendiri.

-- Mulai kirim laporan manual: maks 3 kali per 24 jam (yang tidak gagal). Mengembalikan id log.
create function public.mulai_kirim_laporan(p_bulan text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_jumlah int;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Tidak terautentikasi';
  end if;
  if p_bulan is null or p_bulan !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Bulan tidak valid';
  end if;

  -- Kirim paralel milik pengguna yang sama berurutan agar batas tidak terlewati.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('laporan:' || v_user::text)
  );

  select count(*) into v_jumlah
  from public.report_log l
  where l.user_id = v_user
    and l.jenis = 'manual'
    and l.status <> 'gagal'
    and l.created_at > now() - interval '24 hours';

  if v_jumlah >= 3 then
    raise exception 'Batas kirim laporan 3 kali per hari';
  end if;

  insert into public.report_log (user_id, bulan, jenis, status)
  values (v_user, p_bulan, 'manual', 'proses')
  returning id into v_id;

  return v_id;
end;
$$;

-- Tandai hasil kirim. Hanya baris milik pengguna yang masih `proses`; selain itu tidak berefek.
create function public.selesai_kirim_laporan(p_id uuid, p_status text, p_jumlah int)
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
  if p_status is null or p_status not in ('terkirim', 'gagal') then
    raise exception 'Status tidak valid';
  end if;
  if p_jumlah is null or p_jumlah < 0 then
    raise exception 'Jumlah tidak valid';
  end if;

  update public.report_log
  set status = p_status, jumlah_penerima = p_jumlah
  where id = p_id
    and user_id = v_user
    and status = 'proses';
end;
$$;

-- Batas email verifikasi: sekali per 10 menit per penerima.
-- true = boleh kirim (waktu kirim dicatat), false = masih dalam jeda 10 menit.
create function public.tandai_verifikasi_dikirim(p_recipient uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_terverifikasi boolean;
  v_dikirim timestamptz;
begin
  if v_user is null then
    raise exception 'Tidak terautentikasi';
  end if;

  -- FOR UPDATE: panggilan paralel untuk penerima yang sama berurutan; yang kedua membaca
  -- verifikasi_dikirim_pada terbaru sehingga hanya satu yang mendapat true.
  select r.terverifikasi, r.verifikasi_dikirim_pada
  into v_terverifikasi, v_dikirim
  from public.report_recipients r
  where r.id = p_recipient
    and r.user_id = v_user
  for update;

  if not found then
    raise exception 'Penerima tidak ditemukan';
  end if;
  if v_terverifikasi then
    raise exception 'Penerima sudah terverifikasi';
  end if;
  if v_dikirim is not null and v_dikirim > now() - interval '10 minutes' then
    return false;
  end if;

  update public.report_recipients
  set verifikasi_dikirim_pada = now()
  where id = p_recipient
    and user_id = v_user;

  return true;
end;
$$;

-- Fungsi baru otomatis bisa dieksekusi PUBLIC; cabut, lalu beri hanya ke authenticated.
revoke execute on function public.mulai_kirim_laporan(text) from public, anon;
revoke execute on function public.selesai_kirim_laporan(uuid, text, int) from public, anon;
revoke execute on function public.tandai_verifikasi_dikirim(uuid) from public, anon;
grant execute on function public.mulai_kirim_laporan(text) to authenticated;
grant execute on function public.selesai_kirim_laporan(uuid, text, int) to authenticated;
grant execute on function public.tandai_verifikasi_dikirim(uuid) to authenticated;
