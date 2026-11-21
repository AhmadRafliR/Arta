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

/** Kunci saldo per dompet; di bawah 'transactions' agar ikut segar setiap transaksi berubah. */
export const KUNCI_SALDO_DOMPET = ['transactions', 'saldo-dompet'] as const;

/**
 * Saldo setiap dompet (termasuk arsip) dihitung di database lewat RPC saldo_dompet: satu permintaan kecil,
 * bukan menarik seluruh riwayat transaksi. Hasil sama dengan walletBalances.
 */
export function useSaldoDompet() {
  return useQuery<Record<string, number>, AppError>({
    queryKey: KUNCI_SALDO_DOMPET,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('saldo_dompet');
      if (error) throw toAppError(error, { aksi: 'baca' });
      const hasil: Record<string, number> = {};
      for (const r of (data ?? []) as { wallet_id: string; saldo: number | string }[]) {
        hasil[r.wallet_id] = Number(r.saldo);
      }
      return hasil;
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
    // Saldo awal ikut menentukan saldo: segarkan juga RPC saldo.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['wallets'] }),
        qc.invalidateQueries({ queryKey: KUNCI_SALDO_DOMPET }),
      ]),
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
    // Saldo awal ikut menentukan saldo: segarkan juga RPC saldo.
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['wallets'] }),
        qc.invalidateQueries({ queryKey: KUNCI_SALDO_DOMPET }),
      ]),
  });
}
