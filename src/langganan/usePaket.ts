import { useQuery } from '@tanstack/react-query';
import { KUNCI_PAKET_LANGGANAN } from '@/data/langganan';
import { useLangganan } from './LanggananProvider';
import type { Paket } from './tipe';

/**
 * Paket langganan dari toko. Google Play hanya mengembalikan tawaran yang boleh diambil akun Google ini,
 * jadi `ujiCobaHari` kosong bila uji coba sudah pernah dipakai. Di-cache agar Akun dan Premium sama.
 */
export function usePaketLangganan(opsi: { aktif?: boolean } = {}) {
  const penyedia = useLangganan();
  return useQuery<Paket[]>({
    queryKey: [...KUNCI_PAKET_LANGGANAN, penyedia.nama],
    queryFn: () => penyedia.paket(),
    enabled: opsi.aktif ?? true,
    staleTime: 5 * 60_000,
  });
}

/** Uji coba gratis terpanjang yang tersedia untuk akun ini (hari), atau null bila tidak ada. */
export function hariUjiTerbaik(daftar: readonly Paket[] | undefined): number | null {
  const n = Math.max(0, ...(daftar ?? []).map((p) => p.ujiCobaHari ?? 0));
  return n > 0 ? n : null;
}
