export type AppError = { kind: 'offline' | 'validasi' | 'lain'; pesan: string; code?: string };

export const PESAN_OFFLINE = 'Tidak ada koneksi. Transaksi belum tersimpan, coba lagi.';
export const PESAN_OFFLINE_UMUM = 'Tidak ada koneksi. Coba lagi.';
export const PESAN_UMUM = 'Terjadi kesalahan. Coba lagi.';
export const PESAN_NOMINAL_BESAR = 'Nominal terlalu besar';

export type AksiGalat = 'simpan-transaksi' | 'baca' | 'lain';

const POLA_OFFLINE =
  /network request failed|network request timed out|network error|load failed|internet connection appears to be offline|failed to fetch/i;

/**
 * Ubah galat apa pun jadi AppError dengan pesan yang aman ditampilkan.
 * Pesan RPC (P0001) tampil apa adanya; kode Postgres dipertahankan di `code`
 * agar pemanggil bisa memetakan (mis. 23505) tanpa mencocokkan teks pesan.
 */
export function toAppError(e: unknown, opts: { aksi?: AksiGalat } = {}): AppError {
  const o = e && typeof e === 'object' ? (e as { code?: unknown; message?: unknown; name?: unknown }) : {};
  const msg = typeof o.message === 'string' ? o.message : typeof e === 'string' ? e : '';
  const code = typeof o.code === 'string' && o.code ? o.code : undefined;
  const dengan = (a: Omit<AppError, 'code'>): AppError => (code ? { ...a, code } : a);

  if (code === 'P0001' && msg) return dengan({ kind: 'validasi', pesan: msg });
  if (code === '22003') return dengan({ kind: 'validasi', pesan: PESAN_NOMINAL_BESAR });
  if (o.name === 'FunctionsFetchError' || o.name === 'AuthRetryableFetchError' || POLA_OFFLINE.test(msg)) {
    return dengan({ kind: 'offline', pesan: opts.aksi === 'simpan-transaksi' ? PESAN_OFFLINE : PESAN_OFFLINE_UMUM });
  }
  if (__DEV__ && msg) console.warn('[galat]', code ?? '', msg);
  return dengan({ kind: 'lain', pesan: PESAN_UMUM });
}
