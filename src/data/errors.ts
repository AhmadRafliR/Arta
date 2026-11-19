export type AppError = { kind: 'offline' | 'validasi' | 'lain'; pesan: string };

export const PESAN_OFFLINE = 'Tidak ada koneksi. Transaksi belum tersimpan, coba lagi.';

export function toAppError(e: unknown): AppError {
  if (e && typeof e === 'object') {
    const o = e as { code?: unknown; message?: unknown; name?: unknown };
    const msg = typeof o.message === 'string' ? o.message : '';
    if (o.code === 'P0001') return { kind: 'validasi', pesan: msg };
    if (
      o.name === 'FunctionsFetchError' ||
      /network request failed|network request timed out|load failed|internet connection appears to be offline|failed to fetch/i.test(
        msg,
      )
    ) {
      return { kind: 'offline', pesan: PESAN_OFFLINE };
    }
    return { kind: 'lain', pesan: msg || 'Terjadi kesalahan.' };
  }
  return { kind: 'lain', pesan: typeof e === 'string' && e ? e : 'Terjadi kesalahan.' };
}
