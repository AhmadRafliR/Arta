import type { NamaIkon } from '@/components/ikon/data';

export type TipeSaran = 'harian' | 'darurat';

/** Satu dompet pada daftar onboarding (saran bawaan atau tambahan pengguna). */
export type ItemDompet = {
  key: string;
  nama: string;
  tipe: TipeSaran;
  ikon: NamaIkon;
  hint: string;
  custom: boolean;
};

// Daftar saran dari docs/design (akun.html: SUGGEST). Saldo awal selalu 0; angka contoh desain adalah data dummy.
export const SARAN: ItemDompet[] = [
  { key: 'gopay', nama: 'GoPay', tipe: 'harian', ikon: 'ui-pocket', hint: 'E-wallet sehari-hari', custom: false },
  { key: 'cash', nama: 'Uang tunai', tipe: 'harian', ikon: 'ui-rp', hint: 'Di dompet & kantong', custom: false },
  { key: 'bank', nama: 'Rekening BCA', tipe: 'harian', ikon: 'ui-pocket', hint: 'Gaji & transfer', custom: false },
  { key: 'shopeepay', nama: 'ShopeePay', tipe: 'harian', ikon: 'ui-pocket', hint: 'E-wallet belanja', custom: false },
  { key: 'darurat', nama: 'Dana darurat', tipe: 'darurat', ikon: 'ui-shield-ok', hint: 'Uang jaga-jaga', custom: false },
];

export const PILIHAN_AWAL: Record<string, boolean> = { gopay: true, cash: true, darurat: true };

export const LABEL_TIPE: Record<TipeSaran, string> = { harian: 'Dompet harian', darurat: 'Dana darurat' };

/** Pintasan nominal per tipe (akun.html: chips). */
export const PINTASAN: Record<TipeSaran, number[]> = {
  harian: [0, 50000, 100000, 500000],
  darurat: [500000, 1000000, 3500000],
};

/** Nama dompet bawaan bila pengguna melewati tanpa memilih apa pun (agar app tidak kosong). */
export const NAMA_BAWAAN = 'Cash';

export function namaDepan(s: string | null | undefined): string {
  return (s ?? '').trim().split(/\s+/)[0] ?? '';
}
