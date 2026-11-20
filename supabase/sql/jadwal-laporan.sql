-- Jadwal laporan bulanan (Rencana 4). BUKAN migrasi: butuh URL project dan rahasia, jadi
-- dijalankan sendiri di SQL editor Supabase setelah langkah berikut:
--
-- 1. Deploy function: `npx supabase functions deploy report-monthly --no-verify-jwt`.
-- 2. Set secret function `LAPORAN_CRON_SECRET` (string acak panjang yang kamu ketik sendiri),
--    juga `LAPORAN_SECRET` untuk token tautan email.
-- 3. Ganti dua placeholder di bawah:
--    <URL project>          → mis. https://abcdefgh.supabase.co (tanpa garis miring di akhir)
--    <LAPORAN_CRON_SECRET>  → nilai yang sama persis dengan secret function di langkah 2
-- 4. Jalankan seluruh file ini sekali. Rahasia disimpan di Vault, bukan di teks job cron.
--
-- Job berjalan tiap jam (menit ke-5). Function sendiri yang memilih pengguna yang waktunya tiba
-- (tanggal 1 pukul 08.00 di zona waktunya, sampai tanggal 7) dan mencegah kirim dobel.
--
-- Cek job:      select * from cron.job where jobname = 'laporan-bulanan';
-- Riwayat:      select * from cron.job_run_details order by start_time desc limit 20;
-- Hapus job:    select cron.unschedule('laporan-bulanan');
-- Ganti rahasia: select vault.update_secret(
--                  (select id from vault.secrets where name = 'laporan_cron_secret'), '<baru>');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<URL project>', 'laporan_url');
select vault.create_secret('<LAPORAN_CRON_SECRET>', 'laporan_cron_secret');

select cron.schedule(
  'laporan-bulanan',
  '5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'laporan_url')
      || '/functions/v1/report-monthly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'laporan_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
