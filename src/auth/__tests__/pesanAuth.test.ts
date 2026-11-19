import { pesanAuth, PESAN_TERLALU_SERING } from '../pesanAuth';

const F = 'Kode salah atau kedaluwarsa.';

describe('pesanAuth', () => {
  it('429 / rate limit -> terlalu sering', () => {
    expect(pesanAuth({ status: 429, message: 'x' }, F)).toBe(PESAN_TERLALU_SERING);
    expect(pesanAuth({ message: 'email rate limit exceeded' }, F)).toBe(PESAN_TERLALU_SERING);
    expect(pesanAuth({ code: 'over_email_send_rate_limit', message: 'x' }, F)).toBe(PESAN_TERLALU_SERING);
  });
  it('jaringan -> offline', () => {
    expect(pesanAuth({ name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 }, F)).toBe(
      'Tidak ada koneksi. Coba lagi.',
    );
  });
  it('kode salah / kedaluwarsa -> fallback', () => {
    expect(pesanAuth({ status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' }, F)).toBe(F);
  });
});
