export type AppError = { kind: 'offline' | 'validasi' | 'lain'; pesan: string };

export const PESAN_OFFLINE = 'Tidak ada koneksi. Transaksi belum tersimpan, coba lagi.';

export function toAppError(e: unknown): AppError {
  if (e && typeof e === 'object') {
    const o = e as { code?: unknown; message?: unknown };
    const msg = typeof o.message === 'string' ? o.message : '';
    if (o.code === 'P0001') return { kind: 'validasi', pesan: msg };
    if (
      e instanceof TypeError ||
      /network request failed|failed to fetch|network error/i.test(msg)
    ) {
      return { kind: 'offline', pesan: PESAN_OFFLINE };
    }
    return { kind: 'lain', pesan: msg || 'Terjadi kesalahan.' };
  }
  return { kind: 'lain', pesan: typeof e === 'string' && e ? e : 'Terjadi kesalahan.' };
}
