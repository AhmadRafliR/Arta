import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ambilStatusLangganan, KUNCI_LANGGANAN, muatUlangLangganan } from '@/data/langganan';
import { useLangganan } from './LanggananProvider';
import type { HasilBeli } from './tipe';

export const JEDA_POLLING_MS = 3000;
export const MAKS_POLLING = 10;
export const PESAN_MENUNGGU = 'Pembayaran diterima. Status Pro akan aktif dalam beberapa menit.';
export const PESAN_UJI = 'Mode uji: pembayaran tidak sungguhan. Status Pro tidak berubah.';

const tunggu = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function useBeli() {
  const penyedia = useLangganan();
  const qc = useQueryClient();
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const hidup = useRef(true);
  useEffect(() => {
    hidup.current = true;
    return () => {
      hidup.current = false;
    };
  }, []);

  /** Setelah sukses: muat ulang lalu polling status server (webhook bisa terlambat) sampai Pro. */
  const tungguPro = useCallback(async (): Promise<boolean> => {
    await muatUlangLangganan(qc);
    for (let i = 0; i < MAKS_POLLING; i++) {
      const s = await qc.fetchQuery({ queryKey: KUNCI_LANGGANAN, queryFn: ambilStatusLangganan, staleTime: 0 }).catch(() => null);
      if (s?.pro) return true;
      await tunggu(JEDA_POLLING_MS);
      if (!hidup.current) return false;
    }
    return false;
  }, [qc]);

  const jalankan = useCallback(
    async (aksi: () => Promise<HasilBeli>) => {
      if (sibuk) return;
      setSibuk(true);
      setPesan(null);
      try {
        const h = await aksi();
        if (!hidup.current) return;
        if (h.status === 'batal') return;
        if (h.status === 'tertunda' || h.status === 'galat') {
          setPesan(h.pesan ?? 'Pembayaran belum berhasil. Coba lagi sebentar lagi.');
          return;
        }
        if (penyedia.nama === 'mock') {
          setPesan(PESAN_UJI);
          return;
        }
        const aktif = await tungguPro();
        if (hidup.current) setPesan(aktif ? null : PESAN_MENUNGGU);
      } catch {
        if (hidup.current) setPesan('Terjadi kesalahan. Coba lagi sebentar lagi.');
      } finally {
        if (hidup.current) setSibuk(false);
      }
    },
    [penyedia, sibuk, tungguPro],
  );

  const beli = useCallback((paketId: string) => jalankan(() => penyedia.beli(paketId)), [jalankan, penyedia]);
  const pulihkan = useCallback(() => jalankan(() => penyedia.pulihkan()), [jalankan, penyedia]);

  return { beli, pulihkan, sibuk, pesan };
}
