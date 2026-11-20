import { supabase } from '@/lib/supabase';
import { toAppError } from '@/data/errors';

export type Baris = Record<string, unknown>;
export type Urut = { kolom: string; naik: boolean };
/** Rentang tanggal inklusif 'YYYY-MM-DD' pada `kolom`. */
export type FilterTanggal = { kolom: string; dari: string; sampai: string };

/** Sama dengan batas `max_rows` bawaan PostgREST Supabase. */
export const UKURAN_HALAMAN = 1000;

/**
 * Ambil semua baris (RLS membatasi ke milik pengguna) dengan paginasi `.range()` per 1000
 * sampai halaman berisi < 1000 baris. Urutan ditambah `id` sebagai pemutus seri agar
 * batas halaman stabil, jadi `select` wajib memuat kolom `id`.
 */
export async function ambilSemua(tabel: string, select: string, urut: Urut, filter?: FilterTanggal): Promise<Baris[]> {
  const hasil: Baris[] = [];
  for (let dari = 0; ; dari += UKURAN_HALAMAN) {
    let q = supabase.from(tabel).select(select);
    if (filter) q = q.gte(filter.kolom, filter.dari).lte(filter.kolom, filter.sampai);
    let o = q.order(urut.kolom, { ascending: urut.naik });
    if (urut.kolom !== 'id') o = o.order('id', { ascending: true });
    const { data, error } = await o.range(dari, dari + UKURAN_HALAMAN - 1);
    if (error) throw toAppError(error, { aksi: 'baca' });
    const halaman = (data ?? []) as unknown as Baris[];
    hasil.push(...halaman);
    if (halaman.length < UKURAN_HALAMAN) return hasil;
  }
}
