import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toAppError, type AppError } from './errors';

export type Category = { id: string; jenis: 'pemasukan' | 'pengeluaran'; nama: string };

export function useCategories(jenis: 'pemasukan' | 'pengeluaran') {
  return useQuery<Category[], AppError>({
    queryKey: ['categories', jenis],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id,jenis,nama')
        .eq('jenis', jenis)
        .order('nama', { ascending: true });
      if (error) throw toAppError(error, { aksi: 'baca' });
      return (data ?? []) as Category[];
    },
  });
}
