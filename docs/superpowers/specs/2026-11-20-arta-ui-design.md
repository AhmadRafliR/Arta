# Desain singkat: Integrasi UI "arta" ke app (Rencana 1.5)

Tanggal: 2026-11-20 · Status: disetujui Rafli ("Setuju, gas")

## Maksud
Rafli membuat design kit merek **arta — Own Your Money** dan layar Premium uji coba 14 hari (`C:\projek\index`, `C:\projek\premium-trial`; salinan bersih di `docs/design/arta/`). Layar Rencana 1 yang sudah jadi harus memakai bahasa visual itu: warna, ikon, komponen, dan nama merek. Ini menjadi acuan visual untuk rencana-rencana berikutnya.

## Tujuan / bukan tujuan
- **Tujuan:**
  - Token warna lengkap arta.
  - 28 ikon monoline dipakai di app.
  - Nama dan mark arta.
  - Tab bar, kartu hero, chip dompet, baris transaksi, keadaan kosong, dan tombol sesuai kit.
- **Bukan tujuan:**
  - Bar budget, kartu hutang, pil kuota AI, badge Free/Pro, dan layar Premium. Desainnya sudah ada; dibangun di rencana fiturnya masing-masing (Premium bersama sistem langganan, supaya tombolnya tidak mati).
- **Anti-tujuan:**
  - Mengubah perilaku atau data. Ini murni tampilan; semua tes perilaku yang ada tetap lolos.
  - Warna aksen di luar 10% (aksen hanya untuk mic, tombol utama, dan progres).

## Pendekatan
Yang dipilih: **port token + ikon ke sistem yang ada** (NativeWind CSS vars + `react-native-svg`). Alternatifnya merender HTML ekspor di WebView, tapi ditolak: tidak terasa native, berat, dan tidak bisa memakai data asli.

## Keputusan (dari kit, sebagai kontrak visual)
- **Token terang:**
  - ground #EEF3F5, surface #FFFFFF, surface-2 #F6FAFB;
  - hero #0B424F→#1F6A76 (150°), hero-text #FFF, hero-sub rgba(255,255,255,.74);
  - text #0B424F, text-secondary #47646B, text-muted #52727A, line #DDE7EA;
  - accent #52C3BF, accent-ink #17726F, on-accent #08343D;
  - warn #E0A93B / ink #8A5A00, danger #D95C5C / ink #A32B2B.
- **Token gelap:**
  - ground #0B0B0C, surface #161618, surface-2 #1D1D20;
  - hero #FFFFFF, hero-text #0B0B0C, hero-sub rgba(11,66,79,.78);
  - text #FFFFFF, text-secondary #B9B9BF, text-muted #8A8A8F, line #26262A;
  - accent = accent-ink #C6F432, on-accent #0B0B0C;
  - warn #E9C46A, danger #FF8A8A.
- **Radius:** 10 / 16 / 22.
- **Ikon:**
  - grid 24×24, stroke 1,75, ujung bulat;
  - elemen `ln` = garis `currentColor`, `fill` = isi `currentColor`;
  - sumber: `docs/design/arta/icons.json`.
- **Uang masuk dan progres** pakai accent-ink, bukan mint, karena mint kurang kontras di atas putih.

## Panggilan Claude (koreksi bila salah)
- **Font:** Avenir Next berlisensi dan tidak ada di Android → **Nunito Sans** (gratis, mirip), ditanam saat build.
- **Nama tampil app** jadi "arta"; `slug`/ID paket tidak diubah sampai rilis.
- **Chip dompet di Beranda** tetap hanya dompet harian (sesuai "Sisa uang"), sekarang rel geser dengan ikon tipe, diletakkan di bawah kartu hero seperti kit.
- **Baris transaksi:**
  - judul = catatan ?? kategori ?? jenis;
  - meta = kategori · dompet · tanggal relatif;
  - nominal penuh (`-Rp28.000`), format domain tetap tanpa spasi.
- **Gambar SVG yang tidak ikut ekspor** (badge, 3 ilustrasi kosong, ikon app, splash): keadaan kosong memakai ikon + teks dulu. Ilustrasi menyusul saat Rafli menaruh file `.svg`-nya di `docs/design/arta/`.
- **Teks keadaan kosong** "Tahan tombol mic" → "Tekan tombol mic" (mic kita ditekan, bukan ditahan; tahan-untuk-rekam datang di Rencana 2).
