import { useCallback } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import type { HasilAi, KuotaAi } from '@/ai/tipe';
import { PESAN_OFFLINE_UMUM, PESAN_UMUM, toAppError, type AppError } from './errors';

export type { HasilAi, KuotaAi };

export type InputAi = { teks: string } | { audioUri: string; mime: string };

export function sisaKuota(k: Pick<KuotaAi, 'terpakai' | 'batas'>): number {
  return Math.max(0, k.batas - k.terpakai);
}

export function useKuotaAi() {
  return useQuery<KuotaAi, AppError>({
    queryKey: ['kuota-ai'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('kuota_ai');
      if (error) throw toAppError(error, { aksi: 'baca' });
      const k = data as Record<string, unknown>;
      return { bulan: String(k.bulan), terpakai: Number(k.terpakai), batas: Number(k.batas), pro: Boolean(k.pro) };
    },
  });
}

type BodyGalat = { galat?: string; pesan?: string };

// Petakan galat functions.invoke (HTTP/relay/fetch) ke AppError.
export async function petakanGalat(e: unknown): Promise<AppError> {
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
    const pesan = typeof body.pesan === 'string' && body.pesan ? body.pesan : undefined;
    if (body.galat === 'quota_exceeded') return { kind: 'kuota', pesan: pesan ?? PESAN_UMUM };
    return { kind: 'lain', pesan: pesan ?? PESAN_UMUM };
  }
  return toAppError(e, { aksi: 'lain' });
}

/**
 * Kirim teks/audio ke Edge Function `parse`. Fungsi biasa; bila `queryClient`
 * diberikan, kuota (`['kuota-ai']`) diinvalidasi setelah sukses. Dari komponen
 * pakai `useKirimKeAi()` yang sudah mengikat query client.
 */
export async function kirimKeAi(input: InputAi, queryClient?: QueryClient): Promise<HasilAi> {
  try {
    const body =
      'teks' in input
        ? { teks: input.teks }
        : {
            audio_base64: await readAsStringAsync(input.audioUri, { encoding: 'base64' }),
            mime: input.mime,
          };
    const { data, error } = await supabase.functions.invoke('parse', { body });
    if (error) throw await petakanGalat(error);
    void queryClient?.invalidateQueries({ queryKey: ['kuota-ai'] });
    return data as HasilAi;
  } catch (e) {
    if (e && typeof e === 'object' && 'kind' in e && 'pesan' in e) throw e as AppError;
    throw toAppError(e, { aksi: 'lain' });
  }
}

export function useKirimKeAi() {
  const qc = useQueryClient();
  return useCallback((input: InputAi) => kirimKeAi(input, qc), [qc]);
}
