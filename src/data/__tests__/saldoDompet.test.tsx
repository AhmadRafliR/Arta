import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { KUNCI_SALDO_DOMPET, useSaldoDompet, useUpdateWallet } from '../wallets';

const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: (...a: unknown[]) => mockFrom(...a) },
}));

function bungkus() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = jest.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidate };
}

beforeEach(() => jest.clearAllMocks());

describe('useSaldoDompet', () => {
  it('memanggil RPC saldo_dompet dan memetakan saldo per dompet sebagai number', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { wallet_id: 'w1', saldo: 290100 },
        { wallet_id: 'w2', saldo: '-5000' },
      ],
      error: null,
    });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => useSaldoDompet(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRpc).toHaveBeenCalledWith('saldo_dompet');
    expect(result.current.data).toEqual({ w1: 290100, w2: -5000 });
  });

  it('galat RPC menjadi AppError', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'XX', message: 'x' } });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => useSaldoDompet(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: 'lain' });
  });

  it('ubah dompet menyegarkan daftar dompet dan saldo (saldo awal bisa berubah)', async () => {
    const single = jest.fn().mockResolvedValue({
      data: { id: 'w1', nama: 'GoPay', tipe: 'harian', saldo_awal: 1, tanggal_saldo_awal: '2026-11-01', target: null, diarsip: false },
      error: null,
    });
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single }) }) }),
    });
    const { wrapper, invalidate } = bungkus();
    const { result } = await renderHook(() => useUpdateWallet(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'w1', patch: { saldo_awal: 1 } });
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['wallets'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: KUNCI_SALDO_DOMPET });
  });
});
