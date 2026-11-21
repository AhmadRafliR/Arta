// Pemilihan ID unit iklan (murni, tanpa modul native).
// Saat pengembangan SELALU iklan uji Google. Iklan sungguhan hanya bila ID unit produksi diisi lewat env build.
// Mengklik iklan sungguhan milik sendiri bisa membuat akun AdMob ditangguhkan.

export const PREFIKS_ID_UNIT = 'ca-app-pub-';

export function pilihUnitId(opsi: { dev: boolean; uji: string; produksi: string | undefined }): string | null {
  if (opsi.dev) return opsi.uji;
  const id = opsi.produksi?.trim();
  return id && id.startsWith(PREFIKS_ID_UNIT) && id.includes('/') ? id : null;
}

/** Layar yang boleh menampilkan iklan: hanya layar baca. Layar isian, rekam, cek, dan langganan bebas iklan. */
export const LAYAR_BERIKLAN = ['beranda', 'riwayat'] as const;
