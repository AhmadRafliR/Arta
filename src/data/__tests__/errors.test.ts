import { toAppError, PESAN_OFFLINE, PESAN_OFFLINE_UMUM, PESAN_UMUM } from '../errors';

describe('toAppError', () => {
  it('TypeError jaringan -> offline', () => {
    const e = toAppError(new TypeError('Network request failed'), { aksi: 'simpan-transaksi' });
    expect(e.kind).toBe('offline');
    expect(e.pesan).toBe('Tidak ada koneksi. Transaksi belum tersimpan, coba lagi.');
  });
  it('error P0001 -> validasi dengan pesan asli', () => {
    const e = toAppError({ code: 'P0001', message: 'Dompet tujuan tidak boleh sama' });
    expect(e).toEqual({ kind: 'validasi', pesan: 'Dompet tujuan tidak boleh sama', code: 'P0001' });
  });
  it('lainnya -> lain', () => {
    expect(toAppError(new Error('boom')).kind).toBe('lain');
    expect(toAppError('x').kind).toBe('lain');
  });
  it('bentuk terbungkus supabase-js -> offline', () => {
    expect(toAppError({ message: 'TypeError: Network request failed', code: '' }).kind).toBe('offline');
  });
  it('FunctionsFetchError -> offline', () => {
    expect(toAppError({ name: 'FunctionsFetchError', message: 'Failed to send a request' }).kind).toBe('offline');
  });
  it('TypeError pemrograman -> lain', () => {
    expect(toAppError(new TypeError('undefined is not a function')).kind).toBe('lain');
  });

  it('pola "network error" -> offline', () => {
    expect(toAppError(new Error('Network Error')).kind).toBe('offline');
  });
  it('AuthRetryableFetchError -> offline', () => {
    expect(toAppError({ name: 'AuthRetryableFetchError', message: 'x' }).kind).toBe('offline');
  });
  it('pesan offline: transaksi vs netral', () => {
    const e = new TypeError('Network request failed');
    expect(toAppError(e, { aksi: 'simpan-transaksi' }).pesan).toBe(PESAN_OFFLINE);
    expect(toAppError(e, { aksi: 'baca' }).pesan).toBe(PESAN_OFFLINE_UMUM);
    expect(toAppError(e).pesan).toBe(PESAN_OFFLINE_UMUM);
    expect(PESAN_OFFLINE_UMUM).toBe('Tidak ada koneksi. Coba lagi.');
  });
  it('kode Postgres dipertahankan', () => {
    expect(toAppError({ code: '23505', message: 'duplicate key value violates unique constraint "x"' }).code).toBe('23505');
  });
  it('23505 tidak membocorkan pesan mentah', () => {
    const e = toAppError({ code: '23505', message: 'duplicate key value violates unique constraint "x"' });
    expect(e.pesan).toBe(PESAN_UMUM);
    expect(e.kind).toBe('lain');
  });
  it('22003 -> Nominal terlalu besar', () => {
    const e = toAppError({ code: '22003', message: 'value out of range for type bigint' });
    expect(e.pesan).toBe('Nominal terlalu besar');
    expect(e.code).toBe('22003');
  });
  it('galat lain memakai pesan umum, bukan pesan mentah', () => {
    expect(toAppError({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }).pesan).toBe(PESAN_UMUM);
    expect(toAppError(new Error('JWT expired')).pesan).toBe(PESAN_UMUM);
    expect(toAppError('x').pesan).toBe(PESAN_UMUM);
  });
});
