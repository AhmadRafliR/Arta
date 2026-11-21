import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { petakanGalat } from './ai';
import { toAppError, type AppError } from './errors';

export type DrafHutang = {
  pemberi: string;
  tipe: 'cicilan_tetap' | 'berbunga';
  nominal_cicilan: number | null;
  tenor_bulan: number | null;
  jatuh_tempo: string | null;
  pokok_awal: number | null;
  bunga_persen_bulanan: number | null;
  sisa_pokok: number | null;
  catatan: string | null;
};

export type MimeGambar = 'image/jpeg' | 'image/png' | 'image/webp';

export type HasilBacaHutang = {
  draf: DrafHutang | null;
  pesan: string | null;
  kuota?: { bulan: string; terpakai: number; batas: number; pro: boolean };
};

export const BATAS_BYTE_GAMBAR = 6 * 1024 * 1024;
export const PESAN_GAMBAR_BESAR = 'Gambar terlalu besar (maks 6 MB). Pilih screenshot yang lebih kecil.';

/** Tentukan mime dari mime bawaan picker, lalu ekstensi uri; bawaan image/jpeg. */
export function tentukanMime(mimeType?: string | null, uri?: string | null): MimeGambar {
  const m = (mimeType ?? '').toLowerCase();
  if (m === 'image/png' || m === 'image/webp' || m === 'image/jpeg') return m;
  if (m === 'image/jpg') return 'image/jpeg';
  const ext = (uri ?? '').split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/** Perkiraan byte dari panjang base64. */
export function byteDariBase64(b64: string): number {
  return Math.floor((b64.length * 3) / 4);
}

export async function bacaScreenshotHutang(input: { base64: string; mime: MimeGambar }): Promise<HasilBacaHutang> {
  if (byteDariBase64(input.base64) > BATAS_BYTE_GAMBAR) {
    throw { kind: 'validasi', pesan: PESAN_GAMBAR_BESAR } satisfies AppError;
  }
  try {
    const { data, error } = await supabase.functions.invoke('parse-hutang', {
      body: { gambar_base64: input.base64, mime: input.mime },
    });
    if (error) throw await petakanGalat(error);
    const d = (data ?? {}) as Partial<HasilBacaHutang>;
    return { draf: d.draf ?? null, pesan: d.pesan ?? null, kuota: d.kuota };
  } catch (e) {
    if (e && typeof e === 'object' && 'kind' in e && 'pesan' in e) throw e as AppError;
    throw toAppError(e, { aksi: 'lain' });
  }
}

export function useBacaScreenshotHutang() {
  const qc = useQueryClient();
  return useMutation<HasilBacaHutang, AppError, { base64: string; mime: MimeGambar }>({
    mutationFn: bacaScreenshotHutang,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['kuota-ai'] });
    },
  });
}
