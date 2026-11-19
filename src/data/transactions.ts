import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import type { Jenis, Sumber, Tx } from '@/domain/types';
import { toAppError, type AppError } from './errors';

export type NewTx = {
  id: string;
  tanggal: string;
  jenis: Jenis;
  kategori: string | null;
  nominal: number;
  wallet_id: string | null;
  wallet_tujuan_id: string | null;
  catatan: string | null;
  transkrip: string | null;
  sumber: Sumber;
};

type Row = Record<string, unknown>;

const numOrNull = (v: unknown) => (v == null ? null : Number(v));

export function toTx(r: Row): Tx {
  return {
    id: r.id as string,
    tanggal: r.tanggal as string,
    jenis: r.jenis as Jenis,
    kategori: (r.kategori ?? null) as string | null,
    nominal: Number(r.nominal),
    wallet_id: (r.wallet_id ?? null) as string | null,
    wallet_tujuan_id: (r.wallet_tujuan_id ?? null) as string | null,
    debt_id: (r.debt_id ?? null) as string | null,
    porsi_bunga: numOrNull(r.porsi_bunga),
    porsi_pokok: numOrNull(r.porsi_pokok),
    catatan: (r.catatan ?? null) as string | null,
    transkrip: (r.transkrip ?? null) as string | null,
    sumber: r.sumber as Sumber,
  };
}

export function newTxId(): string {
  return randomUUID();
}

const COLS =
  'id,tanggal,jenis,kategori,nominal,wallet_id,wallet_tujuan_id,debt_id,porsi_bunga,porsi_pokok,catatan,transkrip,sumber';

/** bulan 'YYYY-MM' -> [awal, akhir] sebagai string tanggal, tanpa Date/UTC. */
export function rentangBulan(bulan: string): [string, string] {
  const [y, m] = bulan.split('-').map(Number);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const hari = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return [`${bulan}-01`, `${bulan}-${String(hari).padStart(2, '0')}`];
}

export function useTransactions(bulan: string) {
  return useQuery<Tx[], AppError>({
    queryKey: ['transactions', bulan],
    queryFn: async () => {
      const [awal, akhir] = rentangBulan(bulan);
      const { data, error } = await supabase
        .from('transactions')
        .select(COLS)
        .gte('tanggal', awal)
        .lte('tanggal', akhir)
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw toAppError(error, { aksi: 'baca' });
      return (data ?? []).map((r) => toTx(r as Row));
    },
  });
}

/** Satu transaksi menurut id; memakai cache daftar bulan (`bulan`) sebagai data awal bila ada. */
export function useTransaction(id: string, bulan?: string) {
  const qc = useQueryClient();
  return useQuery<Tx, AppError>({
    queryKey: ['transactions', 'one', id],
    initialData: () => qc.getQueryData<Tx[]>(['transactions', bulan])?.find((t) => t.id === id),
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select(COLS).eq('id', id).single();
      if (error) throw toAppError(error, { aksi: 'baca' });
      return toTx(data as Row);
    },
  });
}

export type TxSaldo = Pick<
  Tx,
  'id' | 'tanggal' | 'jenis' | 'nominal' | 'wallet_id' | 'wallet_tujuan_id' | 'debt_id'
>;

const COLS_SALDO = 'id,tanggal,jenis,nominal,wallet_id,wallet_tujuan_id,debt_id';
export const PAGE_SIZE = 1000;

// PostgREST membatasi respons (default 1000 baris); ambil semua halaman.
export function useAllTransactions() {
  return useQuery<TxSaldo[], AppError>({
    queryKey: ['transactions', 'all'],
    queryFn: async () => {
      const out: TxSaldo[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('transactions')
          .select(COLS_SALDO)
          .order('tanggal', { ascending: false })
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw toAppError(error, { aksi: 'baca' });
        const rows = data ?? [];
        for (const r of rows) {
          const t = toTx(r as Row);
          out.push({
            id: t.id,
            tanggal: t.tanggal,
            jenis: t.jenis,
            nominal: t.nominal,
            wallet_id: t.wallet_id,
            wallet_tujuan_id: t.wallet_tujuan_id,
            debt_id: t.debt_id,
          });
        }
        if (rows.length < PAGE_SIZE) break;
      }
      return out;
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['wallets'] }),
    ]);
}

export function useSaveTransactions() {
  const invalidate = useInvalidate();
  return useMutation<Tx[], AppError, NewTx[]>({
    mutationFn: async (items) => {
      let res;
      try {
        res = await supabase.rpc('save_transactions', { items });
      } catch (e) {
        throw toAppError(e, { aksi: 'simpan-transaksi' });
      }
      if (res.error) throw toAppError(res.error, { aksi: 'simpan-transaksi' });
      return ((res.data ?? []) as Row[]).map(toTx);
    },
    onSuccess: invalidate,
  });
}

export function useUpdateTransaction() {
  const invalidate = useInvalidate();
  return useMutation<Tx, AppError, { id: string; patch: Partial<Omit<NewTx, 'id'>> }>({
    mutationFn: async ({ id, patch }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update(patch)
        .eq('id', id)
        .select(COLS)
        .single();
      if (error) throw toAppError(error, { aksi: 'simpan-transaksi' });
      return toTx(data as Row);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidate();
  return useMutation<void, AppError, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw toAppError(error);
    },
    onSuccess: invalidate,
  });
}
