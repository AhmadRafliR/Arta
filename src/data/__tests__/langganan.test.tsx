import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { muatUlangLangganan, petakanStatus, usePro, useStatusLangganan } from '../langganan';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a) },
}));

function bungkus() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => jest.clearAllMocks());

describe('petakanStatus', () => {
  it('memetakan kolom snake_case', () => {
    expect(
      petakanStatus({
        pro: true,
        berlaku_sampai: '2026-12-04T00:00:00+00:00',
        periode: 'trial',
        produk: 'arta_pro:bulanan',
        akan_diperpanjang: true,
      }),
    ).toEqual({
      pro: true,
      berlakuSampai: '2026-12-04T00:00:00+00:00',
      periode: 'trial',
      produk: 'arta_pro:bulanan',
      akanDiperpanjang: true,
    });
  });

  it('data kosong/aneh -> bukan pro, sisanya null', () => {
    expect(petakanStatus(null)).toEqual({
      pro: false,
      berlakuSampai: null,
      periode: null,
      produk: null,
      akanDiperpanjang: null,
    });
    expect(petakanStatus({ pro: 'true', periode: 'seumur-hidup' }).pro).toBe(false);
    expect(petakanStatus({ periode: 'seumur-hidup' }).periode).toBeNull();
  });
});

describe('useStatusLangganan / usePro', () => {
  it('memanggil rpc status_langganan', async () => {
    mockRpc.mockResolvedValue({ data: { pro: true }, error: null });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => useStatusLangganan(), { wrapper });
    await waitFor(() => expect(result.current.data?.pro).toBe(true));
    expect(mockRpc).toHaveBeenCalledWith('status_langganan');
  });

  it('usePro: pro setelah dimuat', async () => {
    mockRpc.mockResolvedValue({ data: { pro: true }, error: null });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => usePro(), { wrapper });
    await waitFor(() => expect(result.current).toEqual({ pro: true, memuat: false }));
  });

  it('usePro: galat -> tetap terkunci', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => usePro(), { wrapper });
    await waitFor(() => expect(result.current.memuat).toBe(false));
    expect(result.current.pro).toBe(false);
  });
});

it('muatUlangLangganan menginvalidasi langganan dan kuota-ai', async () => {
  const { qc } = bungkus();
  const spy = jest.spyOn(qc, 'invalidateQueries');
  await muatUlangLangganan(qc);
  expect(spy).toHaveBeenCalledWith({ queryKey: ['langganan'] });
  expect(spy).toHaveBeenCalledWith({ queryKey: ['kuota-ai'] });
});
