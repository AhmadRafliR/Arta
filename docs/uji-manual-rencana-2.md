# Uji Manual Rencana 2 (Catat pakai AI: suara/ketik + kuota)

## Deploy server (dijalankan Rafli sendiri, satu per satu)

Kunci OpenAI **diketik sendiri** di terminal. Jangan pernah ditempel ke chat, ke file di repo, atau ke `.env` aplikasi. Kunci hanya hidup sebagai secret Edge Function.

1. Push migrasi (`20261120000006` kuota AI dan `20261120000007`):

   ```
   npx supabase db push --remote
   ```

2. Set kunci OpenAI (ganti `<kunci>` dengan kunci sungguhan, ketik sendiri):

   ```
   npx supabase secrets set OPENAI_API_KEY=<kunci>
   ```

3. Opsional, hanya jika ingin mengganti model bawaan (`gpt-4o-mini-transcribe` untuk transkripsi, `gpt-5-mini` untuk parsing):

   ```
   npx supabase secrets set OPENAI_MODEL_STT=<model>
   npx supabase secrets set OPENAI_MODEL_PARSE=<model>
   ```

4. Deploy Edge Function:

   ```
   npx supabase functions deploy parse
   ```

5. Jalankan tes integrasi:

   ```
   npm run test:integration
   ```

   **Catatan:** tes integrasi kuota (`tests/integration/kuota_ai.test.ts`) baru bisa jalan setelah migrasi `20261120000006` dan `20261120000007` ter-push (langkah 1). Sebelum itu tes ini gagal karena tabel/fungsi kuota belum ada.

6. Bangun ulang APK development:

   ```
   npx eas-cli@latest build -p android --profile development
   ```

   **APK dev harus dibangun ulang** karena `expo-audio` adalah paket native baru. APK lama tidak punya modul rekam dan akan galat saat membuka layar rekam. Unduh APK dari tautan build EAS, lalu pasang di HP.

7. Jalankan server development (HP dan laptop di Wi-Fi yang sama, atau tambahkan `--tunnel`):

   ```
   npx expo start --dev-client
   ```

## Daftar uji

Centang `- [x]` jika lulus, catat temuan di bawah item bila gagal.

- [ ] Izin mikrofon diminta sekali (tidak diminta lagi pada rekaman berikutnya)
- [ ] Ucapkan "tadi rokok 25rb pake gopay, parkir 2rb cash" → "Cek dulu" berisi 2 baris yang benar → Simpan → Beranda berubah
- [ ] "kemarin makan 20rb" → tanggal di draf adalah kemarin
- [ ] "top up gopay 50rb dari bca" tanpa dompet BCA → baris meminta "Pilih dompet", Simpan nonaktif sampai dipilih
- [ ] "nabung 100rb ke dana darurat dari cash" → menjadi transfer ke dompet darurat
- [ ] "saldo gopay sekarang 150rb" → baris koreksi "sebelum → sesudah"; setelah Simpan menjadi penyesuaian sebesar selisih
- [ ] "bayar kredivo 300rb" → baris "belum didukung", tidak ikut disimpan
- [ ] Rekaman hening (atau "halo tes") → muncul pertanyaan klarifikasi, tidak pindah ke "Cek dulu", kuota tetap
- [ ] Mode pesawat → pesan offline, kuota tetap
- [ ] "Ketik saja" jalan (teks maksimal 500 karakter)
- [ ] Sisa kuota berkurang tepat 1 per sekali catat (berapa pun transaksi yang dihasilkan)
- [ ] Tekan Simpan dua kali / coba ulang setelah gagal → transaksi hanya tersimpan sekali
- [ ] Di akun uji, isi `ai_usage` jadi 30 lewat SQL editor → layar rekam menampilkan "Kuota AI bulan ini habis" + tombol "Catat manual", dan OpenAI tidak dipanggil

Contoh SQL untuk item terakhir (ganti `<user_id>`, bulan format `YYYY-MM`):

```sql
insert into public.ai_usage (user_id, bulan, jumlah)
values ('<user_id>', to_char(now() at time zone 'Asia/Jakarta', 'YYYY-MM'), 30)
on conflict (user_id, bulan) do update set jumlah = 30;
```

## Catatan temuan

-
