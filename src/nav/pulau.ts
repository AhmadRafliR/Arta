// Logika murni tab bar "pulau dinamis" (tanpa React).

export type StatusNav = 'penuh' | 'pulau';

/** Masuk pulau bila gulir melewati ambang ini (px). */
export const AMBANG_MASUK = 24;
/** Kembali penuh hanya bila gulir sudah di bawah/sama dengan ambang ini (histeresis). */
export const AMBANG_KELUAR = 8;
/** Tinggi bar penuh tanpa safe-area; juga dipakai sebagai spacer bawah layar. */
export const TINGGI_NAV = 76;

export function statusBerikut(sekarang: StatusNav, y: number): StatusNav {
  if (!Number.isFinite(y)) return sekarang;
  if (sekarang === 'penuh') return y > AMBANG_MASUK ? 'pulau' : 'penuh';
  return y <= AMBANG_KELUAR ? 'penuh' : 'pulau';
}
