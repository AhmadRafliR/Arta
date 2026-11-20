import type { Hutang } from '@/domain/types';
import { NAMA_BULAN } from '@/lib/tanggal';

/** 'YYYY-MM-DD' -> '23 Nov 2026' (mockup hutang: fmtDate). */
export function labelTanggal(tanggal: string): string {
  const [y, m, d] = tanggal.split('-').map(Number);
  return `${d} ${NAMA_BULAN[m - 1]} ${y}`;
}

/** Persen bunga gaya Indonesia: 2.5 -> '2,5'. */
export function labelPersen(n: number | null): string {
  return String(n ?? 0).replace('.', ',');
}

/** Bagian pokok yang sudah terbayar, 0..1 (dibatasi agar penyesuaian naik tidak membuat negatif). */
export function porsiTerbayar(h: Hutang): number {
  if (h.pokok_awal <= 0) return h.sisa_pokok <= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, 1 - h.sisa_pokok / h.pokok_awal));
}

/** Lencana jenis hutang: 'Cicilan tetap' atau 'Berbunga 2%/bln'. */
export function labelJenis(h: Hutang): string {
  return h.tipe === 'cicilan_tetap' ? 'Cicilan tetap' : `Berbunga ${labelPersen(h.bunga_persen_bulanan)}%/bln`;
}
