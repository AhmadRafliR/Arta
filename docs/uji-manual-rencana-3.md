# Uji Manual Rencana 3 (Hutang & jadwal)

## Persiapan (dijalankan Rafli)

1. Pastikan belum ada transaksi hutang lama. Kalau ada, check baru di migrasi `20261120000008_hutang.sql` gagal. Jalankan ini di SQL editor Supabase, hasilnya harus `0`:

   ```sql
   select count(*) from transactions where jenis in ('hutang_baru','hutang_bayar');
   ```

2. Push migrasi `20261120000008_hutang.sql` dan `20261120000009_hutang_rpc.sql`:

   ```powershell
   npx supabase db push --remote
   ```

3. Jalankan tes integrasi, termasuk `hutang.test.ts` dan `hutang_rpc.test.ts`:

   ```powershell
   npm run test:integration
   ```

4. Jalankan server development. **APK dev tidak perlu dibangun ulang**, karena Rencana 3 tidak menambah paket native.

   ```powershell
   npx expo start --dev-client
   ```

Catatan: di worktree dengan path Windows yang mengandung `\r…`, `npx jest` biasa ikut menjalankan `tests/integration`. Untuk tes unit saja, pakai `npx jest --testPathIgnorePatterns=integration`.

## Daftar uji

Centang `- [x]` jika lulus. Kalau gagal, catat temuannya di bawah item itu.

**Hutang cicilan tetap**
- [ ] Tambah "Kredivo" cicilan tetap 100rb × 12 bulan, "Tidak masuk dompet".
  - Saldo dompet tetap.
  - Kekayaan bersih di Beranda turun Rp1.200.000.
  - Kartu hutang di Beranda menampilkan jatuh tempo berikutnya.
- [ ] Bayar cicilan Kredivo dari GoPay.
  - GoPay berkurang Rp100.000.
  - Kartu hutang menampilkan "Sisa pokok · 1 dari 12 cicilan lunas".
  - Jadwal tagihan ke-1 berstatus "Lunas".
- [ ] Bayar 250rb sekaligus → tagihan 2–3 lunas, tagihan 4 belum.

**Hutang berbunga**
- [ ] Tambah "Pinjaman Andi" berbunga efektif 2%, pokok 1 jt, uang masuk ke Cash. Cash bertambah Rp1.000.000, kekayaan bersih tidak berubah.
- [ ] Bayar 300rb.
  - Pratinjau di form dan hasil di riwayat: "Bunga Rp20.000 · Pokok Rp280.000".
  - Bayar lagi di bulan yang sama → "Bunga Rp0".
- [ ] Hapus pembayaran pertama dari Riwayat → pecahan bunga/pokok pembayaran kedua berubah (sekarang membawa bunga).
- [ ] Ubah tanggal pembayaran dari Riwayat. Hanya tanggal dan catatan yang bisa diubah, lalu pecahannya dihitung ulang.
- [ ] Tambah hutang berbunga "Sudah berjalan": pokok awal 1 jt, sisa 600rb → sisa tampil Rp600.000.
- [ ] Sesuaikan sisa: 600rb → 550rb → tampil "Rp600.000 → Rp550.000", lalu sisa menjadi Rp550.000.
- [ ] Tambah tagihan manual pada hutang berbunga → muncul di jadwal.

**Batas dan galat**
- [ ] Bayar melebihi sisa → Simpan nonaktif dengan "Melebihi sisa hutang". Kalau lolos dari server, muncul pesan "Pembayaran melebihi sisa hutang".
- [ ] Arsipkan hutang lunas → hilang dari daftar, muncul di "Tampilkan yang diarsip". Bayar ke hutang yang diarsipkan → ditolak.
- [ ] Hapus hutang → konfirmasi, semua pembayarannya ikut terhapus, dan saldo dompet kembali.
- [ ] Mode pesawat saat bayar → pesan offline. Setelah online, "Simpan" lagi → tetap tersimpan sekali.
- [ ] Tab Hutang tanpa hutang → "Belum ada hutang tercatat. Tambahkan paylater atau cicilan kalau ada." dan tombol "Tambah hutang".

**Ringkasan**
- [ ] Ringkasan tab Hutang: total sisa, persen lunas, dan "Perkiraan bebas hutang".

## Ditunda dari Rencana 3

- Pengingat push jatuh tempo (Pro). Dikerjakan di Rencana 5 bersama `expo-notifications`.
- Langkah tambah hutang di onboarding. Gantinya, keadaan kosong tab Hutang punya tombol "Tambah hutang".
- Draf AI untuk hutang dan koreksi sisa hutang lewat suara (Task 9). Menunggu Rencana 2 di-merge ke `main`.
- Ubah tenor atau nominal cicilan setelah hutang dibuat. Untuk sekarang: hapus lalu buat ulang.
- Status hutang dan jadwal di laporan email bulanan (Rencana 6).
