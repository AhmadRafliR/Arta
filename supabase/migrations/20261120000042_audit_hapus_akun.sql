-- Rencana 5: audit penghapusan akun.
-- Hapus akun = auth.admin.deleteUser; semua data ikut terhapus lewat FK "on delete cascade" ke auth.users.
-- Kedua fungsi di bawah menemukan tabel pengguna dari katalog, jadi tabel baru dari rencana lain
-- otomatis ikut diperiksa (tidak ada daftar tabel yang harus diingat untuk diperbarui).
-- Tabel pengguna = tabel di schema public yang punya kolom user_id (plus profiles, kunci id).

-- Tabel pengguna yang TIDAK punya FK ke auth.users ber-on delete cascade. Harus kosong.
create or replace function public.audit_fk_pengguna()
returns table (tabel text)
language sql
stable
security definer
set search_path = ''
as $$
  with kandidat as (
    select c.oid as relid, c.relname::text as nama,
           case when c.relname = 'profiles' then 'id' else 'user_id' end as kolom
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and (
        c.relname = 'profiles'
        or exists (
          select 1 from pg_catalog.pg_attribute a
          where a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped
        )
      )
  )
  select k.nama
  from kandidat k
  where not exists (
    select 1
    from pg_catalog.pg_constraint con
    join pg_catalog.pg_attribute a
      on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
    where con.conrelid = k.relid
      and con.contype = 'f'
      and con.confrelid = 'auth.users'::regclass
      and con.confdeltype = 'c'
      and array_length(con.conkey, 1) = 1
      and a.attname = k.kolom
  )
  order by k.nama;
$$;

-- Jumlah baris yang masih tersisa untuk p_user per tabel pengguna (hanya yang > 0).
create or replace function public.sisa_data_pengguna(p_user uuid)
returns table (tabel text, jumlah bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
  v_n bigint;
begin
  for r in
    select c.relname::text as nama,
           case when c.relname = 'profiles' then 'id' else 'user_id' end as kolom
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and (
        c.relname = 'profiles'
        or exists (
          select 1 from pg_catalog.pg_attribute a
          where a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped
        )
      )
    order by c.relname
  loop
    execute format('select count(*) from public.%I where %I = $1', r.nama, r.kolom)
      into v_n using p_user;
    if v_n > 0 then
      tabel := r.nama;
      jumlah := v_n;
      return next;
    end if;
  end loop;
end;
$$;

revoke execute on function public.audit_fk_pengguna() from public, anon, authenticated;
revoke execute on function public.sisa_data_pengguna(uuid) from public, anon, authenticated;
grant execute on function public.audit_fk_pengguna() to service_role;
grant execute on function public.sisa_data_pengguna(uuid) to service_role;
