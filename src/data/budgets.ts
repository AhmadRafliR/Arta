import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Budget } from '@/domain/budget';
import { toAppError, type AppError } from './errors';

export const PESAN_BUDGET_KEMBAR = 'Budget untuk kategori ini sudah ada';

export function useBudgets() {
  return useQuery<Budget[], AppError>({
    queryKey: ['budgets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('id,kategori,batas_bulanan')
        .order('kategori');
      if (error) throw toAppError(error, { aksi: 'baca' });
      return (data ?? []).map((r) => {
        const o = r as Record<string, unknown>;
        return { id: o.id as string, kategori: o.kategori as string, batas_bulanan: Number(o.batas_bulanan) };
      });
    },
  });
}

export type InputBudget = { id?: string; kategori: string; batas_bulanan: number };

export function useSimpanBudget() {
  const qc = useQueryClient();
  return useMutation<void, AppError, InputBudget>({
    mutationFn: async ({ id, kategori, batas_bulanan }) => {
      const { error } = id
        ? await supabase.from('budgets').update({ batas_bulanan }).eq('id', id)
        : await supabase.from('budgets').insert({ kategori: kategori.trim(), batas_bulanan });
      if (error) throw toAppError(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  });
}

export function useHapusBudget() {
  const qc = useQueryClient();
  return useMutation<void, AppError, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('budgets').delete().eq('id', id);
      if (error) throw toAppError(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  });
}

/** Pesan tampil untuk galat budget; 23505 (unik) = kategori kembar. */
export function pesanBudget(e: unknown): string {
  if (e && typeof e === 'object' && (e as { code?: unknown }).code === '23505') return PESAN_BUDGET_KEMBAR;
  if (e && typeof e === 'object' && typeof (e as AppError).pesan === 'string') return (e as AppError).pesan;
  return toAppError(e).pesan;
}
