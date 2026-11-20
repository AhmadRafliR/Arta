import { useQuery, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toAppError, type AppError } from './errors';

export type PeriodeLangganan = 'normal' | 'trial' | 'intro';

/** Status Pro dari server (`entitlements`, ditulis webhook RevenueCat). Sumber kebenaran gerbang Pro. */
export type StatusLangganan = {
  pro: boolean;
  berlakuSampai: string | null;
  periode: PeriodeLangganan | null;
  produk: string | null;
  akanDiperpanjang: boolean | null;
};

export const KUNCI_LANGGANAN = ['langganan'] as const;

const PERIODE: readonly PeriodeLangganan[] = ['normal', 'trial', 'intro'];

export function petakanStatus(data: unknown): StatusLangganan {
  const o = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const teks = (v: unknown) => (typeof v === 'string' && v ? v : null);
  const periode = teks(o.periode);
  return {
    pro: o.pro === true,
    berlakuSampai: teks(o.berlaku_sampai),
    periode: periode && (PERIODE as readonly string[]).includes(periode) ? (periode as PeriodeLangganan) : null,
    produk: teks(o.produk),
    akanDiperpanjang: typeof o.akan_diperpanjang === 'boolean' ? o.akan_diperpanjang : null,
  };
}

export async function ambilStatusLangganan(): Promise<StatusLangganan> {
  const { data, error } = await supabase.rpc('status_langganan');
  if (error) throw toAppError(error, { aksi: 'baca' });
  return petakanStatus(data);
}

export function useStatusLangganan(opts: { refetchInterval?: number | false } = {}) {
  return useQuery<StatusLangganan, AppError>({
    queryKey: KUNCI_LANGGANAN,
    queryFn: ambilStatusLangganan,
    refetchInterval: opts.refetchInterval,
  });
}

/** Gerbang Pro. Selama memuat atau galat, dianggap bukan Pro (fitur tetap terkunci). */
export function usePro(): { pro: boolean; memuat: boolean } {
  const q = useStatusLangganan();
  return { pro: q.data?.pro === true, memuat: q.isPending };
}

/** Muat ulang status Pro dan kuota AI (batas kuota bergantung pada Pro). */
export function muatUlangLangganan(qc: QueryClient): Promise<void> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: KUNCI_LANGGANAN }),
    qc.invalidateQueries({ queryKey: ['kuota-ai'] }),
  ]).then(() => undefined);
}
