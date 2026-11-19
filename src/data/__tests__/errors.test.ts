import { toAppError } from '../errors';

describe('toAppError', () => {
  it('TypeError jaringan -> offline', () => {
    const e = toAppError(new TypeError('Network request failed'));
    expect(e.kind).toBe('offline');
    expect(e.pesan).toBe('Tidak ada koneksi. Transaksi belum tersimpan, coba lagi.');
  });
  it('error P0001 -> validasi dengan pesan asli', () => {
    const e = toAppError({ code: 'P0001', message: 'Dompet tujuan tidak boleh sama' });
    expect(e).toEqual({ kind: 'validasi', pesan: 'Dompet tujuan tidak boleh sama' });
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
});
