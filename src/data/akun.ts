import { supabase } from '@/lib/supabase';
import { PESAN_OFFLINE_UMUM, PESAN_UMUM, toAppError, type AppError } from './errors';

type BodyGalat = { galat?: string; pesan?: string };

// Petakan galat functions.invoke (HTTP/relay/fetch) ke AppError (pola sama dengan ai.ts).
async function petakanGalat(e: unknown): Promise<AppError> {
  const o = (e && typeof e === 'object' ? e : {}) as { name?: unknown; context?: { json?: () => Promise<unknown> } };
  if (o.name === 'FunctionsFetchError') return { kind: 'offline', pesan: PESAN_OFFLINE_UMUM };
  if (o.name === 'FunctionsHttpError') {
    let body: BodyGalat = {};
    try {
      const b = await o.context?.json?.();
      if (b && typeof b === 'object') body = b as BodyGalat;
    } catch {
      // body bukan JSON: pakai pesan umum
    }
    return { kind: 'lain', pesan: typeof body.pesan === 'string' && body.pesan ? body.pesan : PESAN_UMUM };
  }
  return toAppError(e, { aksi: 'lain' });
}

/**
 * Hapus akun permanen lewat Edge Function `delete-account`, lalu keluarkan sesi lokal
 * (pengguna di server sudah hilang, jadi signOut global tidak berguna).
 */
export async function hapusAkun(): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('delete-account', { body: { konfirmasi: 'HAPUS' } });
    if (error) throw await petakanGalat(error);
  } catch (e) {
    if (e && typeof e === 'object' && 'kind' in e && 'pesan' in e) throw e as AppError;
    throw toAppError(e, { aksi: 'lain' });
  }
  // Akun sudah terhapus: kegagalan signOut tidak boleh terlihat sebagai gagal hapus.
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // sesi lokal akan kedaluwarsa sendiri; AuthGate tetap menangani
  }
}
