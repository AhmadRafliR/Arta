import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useSaveTransactions, type NewTx } from '../transactions';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a) },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));

const item: NewTx = {
  id: 'tx-1',
  tanggal: '2026-11-19',
  jenis: 'pengeluaran',
  kategori: 'Makan',
  nominal: 15000,
  wallet_id: 'w1',
  wallet_tujuan_id: null,
  catatan: null,
  transkrip: null,
  sumber: 'manual',
};

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const W = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return W;
}

it('mutasi gagal offline lalu diulang memakai id yang sama', async () => {
  mockRpc
    .mockResolvedValueOnce({ data: null, error: new TypeError('Network request failed') })
    .mockResolvedValueOnce({ data: [{ ...item, nominal: '15000' }], error: null });
  const { result } = await renderHook(() => useSaveTransactions(), { wrapper: wrapper() });

  await act(async () => {
    result.current.mutate([item]);
  });
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error?.kind).toBe('offline');

  await act(async () => {
    result.current.mutate([item]);
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(mockRpc).toHaveBeenCalledTimes(2);
  expect(mockRpc.mock.calls[0][1].items[0].id).toBe('tx-1');
  expect(mockRpc.mock.calls[1][1].items[0].id).toBe('tx-1');
  expect(result.current.data?.[0].nominal).toBe(15000);
});
