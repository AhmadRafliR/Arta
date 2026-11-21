import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { LanggananContext } from '../LanggananProvider';
import type { Paket, PenyediaLangganan } from '../tipe';
import { hariUjiTerbaik, usePaketLangganan } from '../usePaket';

jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ session: null }) }));

const PAKET: Paket[] = [
  { id: 'b', jenis: 'bulanan', harga: 'Rp19.000', hargaPerBulan: null, ujiCobaHari: 7 },
  { id: 't', jenis: 'tahunan', harga: 'Rp190.000', hargaPerBulan: 'Rp15.833', ujiCobaHari: 14 },
];

function penyedia(paket: () => Promise<Paket[]>): PenyediaLangganan {
  return {
    nama: 'revenuecat',
    masuk: async () => {},
    keluar: async () => {},
    paket: jest.fn(paket),
    beli: async () => ({ status: 'sukses' }),
    pulihkan: async () => ({ status: 'sukses' }),
    urlKelola: async () => null,
  };
}

function bungkus(p: PenyediaLangganan) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Bungkus = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <LanggananContext.Provider value={p}>{children}</LanggananContext.Provider>
    </QueryClientProvider>
  );
  return Bungkus;
}

it('hariUjiTerbaik: uji coba terpanjang, null bila tidak ada', () => {
  expect(hariUjiTerbaik(PAKET)).toBe(14);
  expect(hariUjiTerbaik(PAKET.map((p) => ({ ...p, ujiCobaHari: null })))).toBeNull();
  expect(hariUjiTerbaik([])).toBeNull();
  expect(hariUjiTerbaik(undefined)).toBeNull();
});

it('memuat paket dari penyedia aktif', async () => {
  const p = penyedia(async () => PAKET);
  const { result } = await renderHook(() => usePaketLangganan(), { wrapper: bungkus(p) });
  await waitFor(() => expect(result.current.data).toEqual(PAKET));
  expect(p.paket).toHaveBeenCalledTimes(1);
});

it('aktif: false tidak memanggil toko (mis. pengguna Pro)', async () => {
  const p = penyedia(async () => PAKET);
  const { result } = await renderHook(() => usePaketLangganan({ aktif: false }), { wrapper: bungkus(p) });
  await new Promise((r) => setTimeout(r, 10));
  expect(result.current.data).toBeUndefined();
  expect(p.paket).not.toHaveBeenCalled();
});
