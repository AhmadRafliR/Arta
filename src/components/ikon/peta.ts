import type { TipeDompet } from '@/domain/types';
import type { NamaIkon } from './data';

const KATEGORI = ['rokok', 'makan', 'parkir', 'kuliah', 'transport', 'ortu', 'gaji'] as const;

/** Ikon kategori berdasarkan nama (abaikan huruf besar dan spasi tepi). */
export function ikonKategori(kategori: string | null): NamaIkon {
  const k = (kategori ?? '').trim().toLowerCase();
  const cocok = KATEGORI.find((x) => x === k);
  return cocok ? (`cat-${cocok}` as NamaIkon) : 'cat-lainnya';
}

export function ikonDompet(tipe: TipeDompet): NamaIkon {
  return `wallet-${tipe}` as NamaIkon;
}
