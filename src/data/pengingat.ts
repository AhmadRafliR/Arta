import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toAppError, type AppError } from './errors';

export type HariSebelum = 0 | 1 | 3;
export type PengaturanPengingat = { aktif: boolean; hari_sebelum: HariSebelum; jam: number };

export const PENGINGAT_DEFAULT: PengaturanPengingat = { aktif: true, hari_sebelum: 1, jam: 8 };

export function usePengaturanPengingat() {
  return useQuery<PengaturanPengingat, AppError>({
    queryKey: ['pengingat'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pengaturan_pengingat')
        .select('aktif,hari_sebelum,jam')
        .maybeSingle();
      if (error) throw toAppError(error, { aksi: 'baca' });
      if (!data) return PENGINGAT_DEFAULT;
      const r = data as Record<string, unknown>;
      return {
        aktif: Boolean(r.aktif),
        hari_sebelum: Number(r.hari_sebelum) as HariSebelum,
        jam: Number(r.jam),
      };
    },
  });
}

export function useSimpanPengingat() {
  const qc = useQueryClient();
  return useMutation<PengaturanPengingat, AppError, PengaturanPengingat>({
    mutationFn: async (p) => {
      const { error } = await supabase
        .from('pengaturan_pengingat')
        .upsert(
          { aktif: p.aktif, hari_sebelum: p.hari_sebelum, jam: p.jam, diperbarui_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
      if (error) throw toAppError(error);
      return p;
    },
    onSuccess: (p) => qc.setQueryData(['pengingat'], p),
  });
}
