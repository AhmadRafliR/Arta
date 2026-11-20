import { buatPenyediaMock } from './mock';
import { buatPenyediaRevenueCat } from './revenuecat';
import type { PenyediaLangganan } from './tipe';

const TIDAK_TERSEDIA = 'Langganan belum tersedia di perangkat ini.';

export function buatPenyediaTidakTersedia(): PenyediaLangganan {
  const galat = async () => ({ status: 'galat' as const, pesan: TIDAK_TERSEDIA });
  return {
    nama: 'tidak-tersedia',
    masuk: async () => {},
    keluar: async () => {},
    paket: async () => [],
    beli: galat,
    pulihkan: galat,
    urlKelola: async () => null,
  };
}

export function pilihPenyedia(opsi: { apiKey?: string | null; platform: string; dev: boolean }): PenyediaLangganan {
  if (opsi.apiKey && opsi.platform === 'android') return buatPenyediaRevenueCat(opsi.apiKey);
  if (!opsi.apiKey && opsi.dev) return buatPenyediaMock();
  return buatPenyediaTidakTersedia();
}
