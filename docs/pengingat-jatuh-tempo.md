# Pengingat jatuh tempo hutang (notifikasi lokal)

Fitur khusus Pro. Notifikasi dijadwalkan **di perangkat** dengan `expo-notifications` (trigger tipe DATE, saluran Android `pengingat`). Tidak memakai server, FCM, atau push token.

## Cara kerja

1. `useSinkronPengingat()` (dipanggil di `app/_layout.tsx`) membaca tagihan `debt_schedule` berstatus `belum` dengan `jatuh_tempo >= hari ini` dari hutang yang tidak diarsip (`src/data/tagihanMendatang.ts`) dan pengaturan pengingat (aktif, H-0/1/3, jam).
2. `susunJadwalPengingat` (`src/notifikasi/jadwalPengingat.ts`) menghitung waktu kirim = (jatuh tempo - N hari) pukul `jam`:00 di zona waktu profil (bawaan Asia/Jakarta). Bila N > 0, pengingat hari H juga dibuat. Tagihan pada waktu kirim yang sama digabung; waktu yang sudah lewat dilewati; maksimum 40 notifikasi (batas iOS 64).
3. `jadwalkanUlangPengingat` (`src/notifikasi/lokal.ts`) membatalkan notifikasi terjadwal bertanda `data.jenis = 'pengingat-hutang'` (notifikasi lain tidak disentuh), lalu menjadwalkan ulang. Dijalankan setiap data/pengaturan berubah dan saat app kembali ke foreground.
4. Logout, non-Pro, atau sakelar dimatikan: semua pengingat dibatalkan. Izin notifikasi tidak pernah diminta otomatis; hanya saat sakelar dinyalakan.
5. Mengetuk notifikasi membuka `/hutang`.

## Batasan

- HP harus pernah membuka app agar jadwal diperbarui (tagihan baru, ubah pengaturan, tagihan lunas dari perangkat lain). Jadwal yang sudah ada tetap berbunyi walau app tertutup.
- Penghemat baterai (mis. Xiaomi/HyperOS, Oppo, Vivo) dapat menunda atau membatalkan alarm. Matikan optimasi baterai untuk arta dan izinkan "Mulai otomatis".
- Penjadwalan ulang setelah HP restart ditangani expo-notifications, tetapi beberapa pabrikan memerlukan app dibuka sekali.
- Push server lama (Edge Function `debt-reminders` + Expo push token) belum aktif: butuh Firebase/FCM (`google-services.json`) dan pg_cron. Kodenya (`src/notifikasi/push.ts`) dipertahankan, hanya `lepasPush` yang masih dipakai saat logout.

## Uji manual di HP (Android, build dengan expo-notifications)

1. Login sebagai akun Pro, buka Akun > Pengingat jatuh tempo, nyalakan sakelar, izinkan notifikasi.
2. Tekan "Kirim notifikasi uji": dalam ~5 detik muncul "Notifikasi arta aktif". Ketuk: app membuka `/hutang`.
3. Buat hutang dengan tagihan besok; pilih H-1 dan jam terdekat berikutnya (mis. satu jam lagi tidak tersedia di pilihan: ubah jam HP/zona atau gunakan tagihan beberapa hari ke depan lalu cek tanggal). Pastikan notifikasi muncul pada jam terpilih dengan app tertutup.
4. Matikan sakelar: notifikasi terjadwal hilang (tidak muncul pada jamnya).
5. Logout: tidak ada pengingat tersisa. Tolak izin saat sakelar dinyalakan: tampil pesan dan tombol "Buka Pengaturan".
6. Uji juga dengan optimasi baterai aktif vs nonaktif (Xiaomi) bila pengingat terlambat.
