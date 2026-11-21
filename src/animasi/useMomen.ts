import { useCallback } from 'react';
import { useTransisiOpsional } from '@/animasi/TransisiProvider';

/**
 * Putar animasi celengan untuk momen penting setelah aksi berhasil (simpan transaksi, budget, dst.).
 * Lepas-dan-lupa: overlay menutupi layar, jadi pemanggil boleh langsung menutup/berpindah halaman
 * di baliknya. Di luar TransisiProvider (tes layar) tidak melakukan apa-apa.
 */
export function useMomen(): (judul: string, sub?: string) => void {
  const transisi = useTransisiOpsional();
  return useCallback(
    (judul: string, sub?: string) => {
      if (transisi) void transisi.putar({ judul, sub });
    },
    [transisi],
  );
}
