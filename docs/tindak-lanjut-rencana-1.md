# Tindak lanjut dari Rencana 1 (Fondasi)

Catatan dari review per-task dan review akhir yang **sengaja ditunda** ke rencana berikutnya. Tidak ada yang kritis untuk uji manual Rencana 1.

## Sebelum pengguna sungguhan / Rencana 2
- Migrasi `NOT NULL` untuk kolom ber-default: `wallets.tipe`, `wallets.diarsip`, `profiles.mode_tampilan`, `profiles.onboarding_selesai`, `transactions.sumber`, `created_at` (null `onboarding_selesai` bisa membuat gerbang login menggantung).
- `GRANT` untuk `service_role` saat Edge Functions dipakai. Konvensi: setiap tabel baru butuh `GRANT` eksplisit; pertimbangkan `revoke all … from anon, public`.
- Batas ukuran array di RPC `save_transactions` (penting untuk catat pakai AI yang mengirim banyak item).
- Putuskan apakah RPC menolak dompet yang diarsipkan.
- Check constraint tabel `wallet_tujuan_id <> wallet_id` (sekarang hanya dicek RPC + UI).
- Tes integrasi untuk jalur "RPC mengembalikan [] lalu update" (penyesuaian).

## Sebelum uji tertutup Play Store
- SMTP sendiri (mis. Resend) — SMTP bawaan Supabase dibatasi ketat. Template email berisi `{{ .Token }}`.
- `zona_waktu` diambil dari perangkat saat onboarding (`Intl.DateTimeFormat().resolvedOptions().timeZone`), dan onboarding memakai `hariIni(zona_waktu)`.
- Splash & ikon asli (masih warna template Expo) — menunggu file SVG dari Rafli.
- Kirim kode ulang / ganti email di layar kode.
- `signOut` saat offline: fallback `scope: 'local'` atau pesan.
- Akun: tampilkan galat saat daftar dompet gagal dimuat; teks offline saat membuka app tanpa koneksi + batas waktu muat profil.

## Kualitas & UX (bisa kapan saja)
- Saldo dihitung di server (view/RPC agregat) agar tidak memuat semua transaksi ke HP; paging keyset `(tanggal, id)`.
- TabBar memakai API `navigation` publik, bukan `emitter`/`navigateToTab`; tambah tes.
- Kategori kosong saat kategori belum termuat → tunggu atau wajibkan.
- Dompet diarsipkan yang saldonya berubah lagi (karena edit transaksi lama) belum diberi tanda.
- Edge case penyesuaian: jika penyesuaian sebelumnya ternyata tersimpan lalu pengguna memasukkan saldo awal lagi → "Saldo sudah sama" dan penyesuaian lama tetap (hapus baris id sendiri bila selisih null).
- Token warna `danger`/`dangerInk` sudah ada, tetapi teks galat belum memakainya (masih `text-fg`); tombol "Coba lagi" pada galat; tombol Hapus di dalam scroll/keyboard; safe area bawah modal.
- `formatRingkas` 999.950 → "1000rb"; `parseNominal` "1,5"/"25.50" tanpa akhiran dibaca ribuan.
- Hapus dependensi template yang tidak dipakai, tambah konfigurasi ESLint, tindak lanjuti `npm audit`.
- Ubah tema saat offline bisa kembali saat app dibuka lagi (profil menimpa).
- Ilustrasi keadaan kosong, badge Free/Pro, ikon app, dan splash menunggu file SVG dari Rafli di `docs/design/arta/`.
