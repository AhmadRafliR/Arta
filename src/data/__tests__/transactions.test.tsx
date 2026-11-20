import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useDebtTransactions, useSaveTransactions, type NewTx } from '../transactions';

const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: (...a: unknown[]) => mockFrom(...a) },
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

const klien: QueryClient[] = [];
afterEach(() => {
  klien.splice(0).forEach((c) => c.clear());
});

function wrapper() {
  // gcTime: Infinity -> tanpa timer gc yang menahan worker Jest; dibersihkan di afterEach.
  const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  klien.push(qc);
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

describe('useAllTransactions', () => {
  it('mengambil halaman berikutnya sampai halaman pendek', async () => {
    const { useAllTransactions, PAGE_SIZE } = require('../transactions');
    const mk = (n: number, off: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `t${off + i}`, tanggal: '2026-11-19', jenis: 'pemasukan', nominal: '1',
        wallet_id: 'w1', wallet_tujuan_id: null, debt_id: null,
      }));
    const ranges: number[][] = [];
    const pages = [mk(PAGE_SIZE, 0), mk(5, PAGE_SIZE)];
    const q: any = {
      select: () => q, order: () => q,
      range: (a: number, b: number) => { ranges.push([a, b]); return Promise.resolve({ data: pages[ranges.length - 1], error: null }); },
    };
    mockFrom.mockReturnValue(q);
    const { result } = await renderHook(() => useAllTransactions(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(PAGE_SIZE + 5);
    expect(ranges).toEqual([[0, PAGE_SIZE - 1], [PAGE_SIZE, 2 * PAGE_SIZE - 1]]);
  });
});

describe('hutang', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it('useSaveTransactions meneruskan debt_id dan hutang apa adanya', async () => {
    const hutangBaru: NewTx = {
      ...item,
      id: 'tx-h',
      jenis: 'hutang_baru',
      kategori: 'Kredivo',
      nominal: 1200000,
      wallet_id: null,
      debt_id: 'd1',
      hutang: {
        pemberi: 'Kredivo',
        tipe: 'cicilan_tetap',
        tanggal_mulai: '2026-11-20',
        nominal_cicilan: 100000,
        tenor_bulan: 12,
        jatuh_tempo_pertama: '2026-12-05',
      },
    };
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const { result } = await renderHook(() => useSaveTransactions(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync([hutangBaru]);
    });
    expect(mockRpc).toHaveBeenCalledWith('save_transactions', { items: [hutangBaru] });
    const dikirim = mockRpc.mock.calls[0][1].items[0];
    expect(dikirim.debt_id).toBe('d1');
    expect(dikirim.hutang).toEqual(hutangBaru.hutang);
  });

  it('item lama tanpa debt_id/hutang tetap dikirim tanpa field tambahan', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const { result } = await renderHook(() => useSaveTransactions(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync([item]);
    });
    const dikirim = mockRpc.mock.calls[0][1].items[0];
    expect(dikirim).not.toHaveProperty('debt_id');
    expect(dikirim).not.toHaveProperty('hutang');
  });

  it('galat P0001 "Pembayaran melebihi sisa hutang" -> AppError validasi dengan pesan sama', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'Pembayaran melebihi sisa hutang' } });
    const { result } = await renderHook(() => useSaveTransactions(), { wrapper: wrapper() });
    await act(async () => {
      await result.current.mutateAsync([{ ...item, jenis: 'hutang_bayar', debt_id: 'd1' }]).catch(() => {});
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: 'validasi', pesan: 'Pembayaran melebihi sisa hutang', code: 'P0001' });
  });

  it('simpan sukses juga menginvalidasi kunci debts', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
    klien.push(qc);
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const W = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = await renderHook(() => useSaveTransactions(), { wrapper: W });
    await act(async () => {
      await result.current.mutateAsync([item]);
    });
    const kunci = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(kunci).toEqual(expect.arrayContaining([['transactions'], ['wallets'], ['debts']]));
  });

  it('useDebtTransactions: transaksi debt_id, kolom porsi, terbaru dulu, angka dikonversi', async () => {
    const calls: [string, unknown[]][] = [];
    const hasil = {
      data: [
        {
          ...item, id: 't2', jenis: 'hutang_bayar', nominal: '300000', debt_id: 'd1',
          porsi_bunga: '20000', porsi_pokok: '280000',
        },
      ],
      error: null,
    };
    const q: any = {
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(hasil).then(res, rej),
    };
    for (const m of ['select', 'eq', 'order']) {
      q[m] = (...a: unknown[]) => { calls.push([m, a]); return q; };
    }
    mockFrom.mockReturnValue(q);
    const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
    klien.push(qc);
    const W = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = await renderHook(() => useDebtTransactions('d1'), { wrapper: W });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('transactions');
    const kolom = String(calls.find(([m]) => m === 'select')?.[1][0]);
    expect(kolom).toContain('porsi_bunga');
    expect(kolom).toContain('porsi_pokok');
    expect(kolom).toContain('debt_id');
    expect(calls).toContainEqual(['eq', ['debt_id', 'd1']]);
    const urutan = calls.filter(([m]) => m === 'order').map(([, a]) => a);
    expect(urutan[0]).toEqual(['tanggal', { ascending: false }]);
    expect(urutan[1]).toEqual(['created_at', { ascending: false }]);
    expect(result.current.data?.[0]).toMatchObject({ nominal: 300000, porsi_bunga: 20000, porsi_pokok: 280000 });
    expect(qc.getQueryData(['transactions', 'debt', 'd1'])).toBeDefined();
  });
});
