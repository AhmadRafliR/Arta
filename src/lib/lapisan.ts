import { useSyncExternalStore } from 'react';

/**
 * Koordinasi lapisan layar penuh yang tidak boleh tampil bersamaan (tur fitur, popup izin notifikasi).
 * Masing-masing menandai dirinya aktif; yang lain menunggu sampai lapisan itu selesai.
 */
export type NamaLapisan = 'tur' | 'izin';

let aktif = new Set<NamaLapisan>();
const pendengar = new Set<() => void>();

export function setLapisan(nama: NamaLapisan, nyala: boolean) {
  if (aktif.has(nama) === nyala) return;
  const baru = new Set(aktif);
  if (nyala) baru.add(nama);
  else baru.delete(nama);
  aktif = baru;
  pendengar.forEach((p) => p());
}

export function lapisanLainAktif(nama: NamaLapisan): boolean {
  for (const x of aktif) if (x !== nama) return true;
  return false;
}

function langgan(cb: () => void) {
  pendengar.add(cb);
  return () => {
    pendengar.delete(cb);
  };
}

/** true selama ada lapisan lain (selain `nama`) yang sedang tampil. */
export function useLapisanLainAktif(nama: NamaLapisan): boolean {
  return useSyncExternalStore(
    langgan,
    () => lapisanLainAktif(nama),
    () => lapisanLainAktif(nama),
  );
}

/** Hanya untuk tes. */
export function setelUlangLapisan() {
  aktif = new Set();
  pendengar.forEach((p) => p());
}
