import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { hariIni } from '@/lib/tanggal';
import { toAppError, type AppError } from './errors';

export type TagihanMendatang = {
  id: string;
  debtId: string;
  pemberi: string;
  jatuhTempo: string;
  nominal: number;
};

type Row = Record<string, unknown>;
type Hutang = { pemberi?: unknown; diarsip?: unknown };

/** Baris debt_schedule + embed debts(pemberi,diarsip) -> TagihanMendatang; null bila hutang diarsip. */
export function toTagihanMendatang(r: Row): TagihanMendatang | null {
  const d = r.debts as Hutang | Hutang[] | null;
  const hutang = Array.isArray(d) ? d[0] : d;
  if (!hutang || hutang.diarsip === true) return null;
  return {
    id: r.id as string,
    debtId: r.debt_id as string,
    pemberi: String(hutang.pemberi ?? ''),
    jatuhTempo: r.jatuh_tempo as string,
    nominal: Number(r.nominal),
  };
}

/** Tagihan belum lunas, jatuh tempo >= hari ini, dari semua hutang yang tidak diarsip. Kunci diawali 'debts'. */
export function useTagihanMendatang(zona: string | null | undefined, aktif = true) {
  const mulai = hariIni(zona ?? undefined);
  return useQuery<TagihanMendatang[], AppError>({
    queryKey: ['debts', 'mendatang', mulai],
    enabled: aktif,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('debt_schedule')
        .select('id,debt_id,jatuh_tempo,nominal,status,debts(pemberi,diarsip)')
        .eq('status', 'belum')
        .gte('jatuh_tempo', mulai)
        .order('jatuh_tempo', { ascending: true })
        .limit(100);
      if (error) throw toAppError(error, { aksi: 'baca' });
      return ((data ?? []) as unknown as Row[])
        .map(toTagihanMendatang)
        .filter((x): x is TagihanMendatang => x !== null);
    },
  });
}
