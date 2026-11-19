import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TipeDompet, Wallet } from '@/domain/types';
import { toAppError, type AppError } from './errors';

type Row = Record<string, unknown>;

export function toWallet(r: Row): Wallet {
  return {
    id: r.id as string,
    nama: r.nama as string,
    tipe: r.tipe as TipeDompet,
    saldo_awal: Number(r.saldo_awal),
    tanggal_saldo_awal: r.tanggal_saldo_awal as string,
    target: r.target == null ? null : Number(r.target),
    diarsip: Boolean(r.diarsip),
  };
}

export function useWallets() {
  return useQuery<Wallet[], AppError>({
    queryKey: ['wallets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('id,nama,tipe,saldo_awal,tanggal_saldo_awal,target,diarsip')
        .order('created_at', { ascending: true });
      if (error) throw toAppError(error, { aksi: 'baca' });
      return (data ?? []).map((r) => toWallet(r as Row));
    },
  });
}

export type NewWallet = Omit<Wallet, 'id' | 'diarsip' | 'target'> & {
  target?: number | null;
};

export function useCreateWallet() {
  const qc = useQueryClient();
  return useMutation<Wallet, AppError, NewWallet>({
    mutationFn: async (w) => {
      const { data, error } = await supabase.from('wallets').insert(w).select().single();
      if (error) throw toAppError(error);
      return toWallet(data as Row);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallets'] }),
  });
}

export function useUpdateWallet() {
  const qc = useQueryClient();
  return useMutation<Wallet, AppError, { id: string; patch: Partial<Omit<Wallet, 'id'>> }>({
    mutationFn: async ({ id, patch }) => {
      const { data, error } = await supabase
        .from('wallets')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw toAppError(error);
      return toWallet(data as Row);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallets'] }),
  });
}
