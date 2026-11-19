import { toAppError, type AppError } from './errors';

export const PESAN_NAMA_KEMBAR = 'Nama dompet sudah dipakai';

/** Pesan tampil dari galat apa pun; pelanggaran unik (nama dompet kembar) dipetakan khusus. */
export function pesanDompet(e: unknown): string {
  const p =
    e && typeof e === 'object' && typeof (e as AppError).pesan === 'string' ? (e as AppError).pesan : toAppError(e).pesan;
  return /duplicate key|unique constraint|23505/i.test(p) ? PESAN_NAMA_KEMBAR : p;
}
