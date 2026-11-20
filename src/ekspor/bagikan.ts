import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { AppError } from '@/data/errors';

export const PESAN_TIDAK_BISA_BAGIKAN = 'Perangkat ini tidak mendukung berbagi berkas.';

/** Tulis berkas ke cache app lalu buka lembar berbagi sistem. */
export async function simpanDanBagikan(nama: string, isi: string | Uint8Array, mime: string, uti?: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    const e: AppError = { kind: 'lain', pesan: PESAN_TIDAK_BISA_BAGIKAN };
    throw e;
  }
  const berkas = new File(Paths.cache, nama);
  berkas.create({ overwrite: true });
  await berkas.write(isi);
  await Sharing.shareAsync(berkas.uri, { mimeType: mime, dialogTitle: 'Ekspor data arta', ...(uti ? { UTI: uti } : {}) });
}
