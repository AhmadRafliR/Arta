import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { LanggananContext } from '../LanggananProvider';
import { JEDA_POLLING_MS, MAKS_POLLING, PESAN_MENUNGGU, useBeli } from '../useBeli';
import type { PenyediaLangganan } from '../tipe';

const mockAmbil = jest.fn();
jest.mock('@/data/langganan', () => ({
  KUNCI_LANGGANAN: ['langganan'],
  ambilStatusLangganan: () => mockAmbil(),
  muatUlangLangganan: jest.fn(async () => {}),
}));

function pasang(nama: PenyediaLangganan['nama'] = 'revenuecat') {
  const p = {
    nama,
    masuk: jest.fn(),
    keluar: jest.fn(),
    paket: jest.fn(),
    beli: jest.fn(async () => ({ status: 'sukses' as const })),
    pulihkan: jest.fn(),
    urlKelola: jest.fn(),
  } as unknown as PenyediaLangganan;
  const qc = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <LanggananContext.Provider value={p}>{children}</LanggananContext.Provider>
    </QueryClientProvider>
  );
  return renderHook(() => useBeli(), { wrapper });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockAmbil.mockReset();
});
afterEach(() => jest.useRealTimers());

describe('useBeli polling', () => {
  it('berhenti begitu pro true', async () => {
    mockAmbil
      .mockResolvedValueOnce({ pro: false })
      .mockResolvedValueOnce({ pro: false })
      .mockResolvedValue({ pro: true });
    const { result } = await pasang();
    let selesai: Promise<void> | undefined;
    await act(async () => {
      selesai = result.current.beli('b');
      await jest.advanceTimersByTimeAsync(JEDA_POLLING_MS * 5);
      await selesai;
    });
    expect(mockAmbil).toHaveBeenCalledTimes(3);
    expect(result.current.pesan).toBeNull();
  });

  it('maksimal 10 kali lalu pesan menunggu', async () => {
    mockAmbil.mockResolvedValue({ pro: false });
    const { result } = await pasang();
    await act(async () => {
      const s = result.current.beli('b');
      await jest.advanceTimersByTimeAsync(JEDA_POLLING_MS * (MAKS_POLLING + 2));
      await s;
    });
    expect(mockAmbil).toHaveBeenCalledTimes(MAKS_POLLING);
    expect(result.current.pesan).toBe(PESAN_MENUNGGU);
  });

  it('mock: tanpa polling', async () => {
    const { result } = await pasang('mock');
    await act(async () => {
      await result.current.beli('b');
    });
    expect(mockAmbil).not.toHaveBeenCalled();
    expect(result.current.pesan).toMatch(/Mode uji/);
  });
});
