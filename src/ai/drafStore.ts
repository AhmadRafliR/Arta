import { useSyncExternalStore } from 'react';
import type { DrafTx, HasilAi } from './tipe';

// Penyimpanan satu hasil AI di memori, untuk mengoper dari layar rekam ke layar cek tanpa parameter URL.
let state: HasilAi | null = null;
const pendengar = new Set<() => void>();

function tetapkan(baru: HasilAi | null) {
  state = baru;
  pendengar.forEach((p) => p());
}

function langgan(cb: () => void) {
  pendengar.add(cb);
  return () => {
    pendengar.delete(cb);
  };
}

export function setDraf(h: HasilAi) {
  tetapkan(h);
}

export function useDraf(): HasilAi | null {
  return useSyncExternalStore(langgan, () => state, () => state);
}

const peringatanDompet = (p: string) => p === 'Pilih dompet' || p.toLowerCase().includes('dompet');

export function ubahDraf(id: string, patch: Partial<Omit<DrafTx, 'id'>>) {
  if (!state) return;
  tetapkan({
    ...state,
    draf: state.draf.map((d) => {
      if (d.id !== id) return d;
      const baru = { ...d, ...patch };
      if (patch.wallet_id) baru.peringatan = baru.peringatan.filter((p) => !peringatanDompet(p));
      return baru;
    }),
  });
}

export function hapusDraf(id: string) {
  if (!state) return;
  tetapkan({ ...state, draf: state.draf.filter((d) => d.id !== id) });
}

export function hapusKoreksi(id: string) {
  if (!state) return;
  tetapkan({ ...state, koreksi: state.koreksi.filter((k) => k.id !== id) });
}

export function kosongkan() {
  tetapkan(null);
}
