import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toAppError, type AppError } from './errors';

export type FiturIklan = 'ekspor' | 'laporan';

export const MENIT_AKSES_IKLAN = 30;

const kunci = (fitur: FiturIklan) => ['akses-iklan', fitur] as const;

/** Akses sementara dari iklan reward masih berlaku? */
export function aksesBerlaku(sampai: Date | null | undefined, sekarang: Date = new Date()): boolean {
  return !!sampai && sampai.getTime() > sekarang.getTime();
}

/** Batas waktu akses iklan untuk satu fitur (null = belum pernah / tidak ada). */
export function useAksesIklan(fitur: FiturIklan, aktif = true) {
  return useQuery<Date | null, AppError>({
    queryKey: kunci(fitur),
    enabled: aktif,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('akses_iklan')
        .select('berlaku_sampai')
        .eq('fitur', fitur)
        .maybeSingle();
      if (error) throw toAppError(error, { aksi: 'baca' });
      const s = (data as { berlaku_sampai?: string | null } | null)?.berlaku_sampai;
      const d = s ? new Date(s) : null;
      return d && Number.isFinite(d.getTime()) ? d : null;
    },
  });
}

/** Catat akses setelah iklan reward ditonton sampai selesai. Mengembalikan batas waktu baru. */
export function useKlaimAksesIklan(fitur: FiturIklan) {
  const qc = useQueryClient();
  return useMutation<Date, AppError, void>({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('klaim_akses_iklan', { p_fitur: fitur });
      if (error) throw toAppError(error);
      const d = new Date(String(data));
      if (!Number.isFinite(d.getTime())) throw toAppError(new Error('Respons tidak valid'));
      return d;
    },
    onSuccess: (d) => qc.setQueryData(kunci(fitur), d),
  });
}
