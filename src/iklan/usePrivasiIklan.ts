import { useQuery } from '@tanstack/react-query';
import { perluPengaturanPrivasiIklan } from './mulai';

/**
 * Apakah tombol "Pilihan privasi iklan" wajib tampil. Hanya diperiksa untuk pengguna yang melihat iklan
 * (`aktif`), karena pemeriksaan ikut menyiapkan SDK iklan.
 */
export function usePerluPrivasiIklan(aktif: boolean): boolean {
  const q = useQuery({
    queryKey: ['privasi-iklan'],
    queryFn: perluPengaturanPrivasiIklan,
    enabled: aktif,
    staleTime: Infinity,
  });
  return aktif && q.data === true;
}
