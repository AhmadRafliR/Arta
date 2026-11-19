import { toAppError, type AppError } from './errors';

export const PESAN_NAMA_KEMBAR = 'Nama dompet sudah dipakai';

const adaPesan = (e: unknown): e is AppError =>
  !!e && typeof e === 'object' && typeof (e as AppError).pesan === 'string';

/** Galat unik (23505) hanya berarti "nama kembar" saat membuat / mengganti nama dompet. */
export function adalahNamaKembar(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { code?: unknown }).code === '23505';
}

/** Pesan tampil dari galat apa pun. `namaUnik`: operasi nama dompet, jadi 23505 dipetakan khusus (berdasar kode, bukan teks). */
export function pesanDompet(e: unknown, opts: { namaUnik?: boolean } = {}): string {
  if (opts.namaUnik && adalahNamaKembar(e)) return PESAN_NAMA_KEMBAR;
  return adaPesan(e) ? e.pesan : toAppError(e).pesan;
}
