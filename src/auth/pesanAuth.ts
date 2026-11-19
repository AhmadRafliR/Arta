import { PESAN_OFFLINE_UMUM, toAppError } from '@/data/errors';

export const PESAN_TERLALU_SERING = 'Terlalu sering mencoba, tunggu sebentar.';

/**
 * Pesan untuk galat OTP (kirim / verifikasi): batas laju dan jaringan dibedakan dari
 * kode salah, yang memakai `fallback`.
 */
export function pesanAuth(err: unknown, fallback: string): string {
  const o = (err && typeof err === 'object' ? err : {}) as { status?: unknown; code?: unknown; message?: unknown };
  const msg = typeof o.message === 'string' ? o.message : '';
  if (o.status === 429 || (typeof o.code === 'string' && /rate_limit/i.test(o.code)) || /rate limit|too many/i.test(msg)) {
    return PESAN_TERLALU_SERING;
  }
  if (toAppError(err).kind === 'offline') return PESAN_OFFLINE_UMUM;
  return fallback;
}
