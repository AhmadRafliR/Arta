import type { HasilBeli, Paket, PenyediaLangganan } from './tipe';

const PAKET_MOCK: Paket[] = [
  { id: 'mock_bulanan', jenis: 'bulanan', harga: 'Rp19.000', hargaPerBulan: 'Rp19.000', ujiCobaHari: 14 },
  { id: 'mock_tahunan', jenis: 'tahunan', harga: 'Rp190.000', hargaPerBulan: 'Rp15.833', ujiCobaHari: null },
];

const jeda = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Penyedia palsu untuk pengembangan tanpa kunci RevenueCat. `beli` hanya mensimulasikan sukses:
 * status Pro tetap dari server dan TIDAK berubah.
 */
export function buatPenyediaMock(opsi: { jedaMs?: number } = {}): PenyediaLangganan {
  const jedaMs = opsi.jedaMs ?? 400;
  const sukses = async (): Promise<HasilBeli> => {
    await jeda(jedaMs);
    return { status: 'sukses' };
  };
  return {
    nama: 'mock',
    masuk: async () => {},
    keluar: async () => {},
    paket: async () => PAKET_MOCK,
    beli: sukses,
    pulihkan: sukses,
    urlKelola: async () => null,
  };
}
