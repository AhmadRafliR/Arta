import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { pesanBudget, useBudgets, useHapusBudget, useSimpanBudget } from '../budgets';

const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
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

describe('useBudgets', () => {
  it('membaca budgets urut kategori dan mengubah angka jadi number', async () => {
    const order = jest.fn().mockResolvedValue({
      data: [{ id: 'b1', kategori: 'Makan', batas_bulanan: '800000' }],
      error: null,
    });
    const select = jest.fn().mockReturnValue({ order });
    mockFrom.mockReturnValue({ select });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => useBudgets(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFrom).toHaveBeenCalledWith('budgets');
    expect(select).toHaveBeenCalledWith('id,kategori,batas_bulanan');
    expect(order).toHaveBeenCalledWith('kategori');
    expect(result.current.data).toEqual([{ id: 'b1', kategori: 'Makan', batas_bulanan: 800000 }]);
  });

  it('galat baca -> AppError', async () => {
    const order = jest.fn().mockResolvedValue({ data: null, error: { code: 'XX', message: 'x' } });
    mockFrom.mockReturnValue({ select: jest.fn().mockReturnValue({ order }) });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => useBudgets(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: 'lain' });
  });
});

describe('useSimpanBudget', () => {
  it('tanpa id: insert dengan kategori ter-trim, lalu invalidasi', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert });
    const { wrapper, invalidate } = bungkus();
    const { result } = await renderHook(() => useSimpanBudget(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ kategori: '  Makan ', batas_bulanan: 800000 });
    });
    expect(insert).toHaveBeenCalledWith({ kategori: 'Makan', batas_bulanan: 800000 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['budgets'] });
  });

  it('dengan id: update hanya batas_bulanan', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });
    const { wrapper, invalidate } = bungkus();
    const { result } = await renderHook(() => useSimpanBudget(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'b1', kategori: 'Makan', batas_bulanan: 900000 });
    });
    expect(update).toHaveBeenCalledWith({ batas_bulanan: 900000 });
    expect(eq).toHaveBeenCalledWith('id', 'b1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['budgets'] });
  });

  it('galat 23505 dipertahankan di code dan tidak invalidasi', async () => {
    const insert = jest.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate' } });
    mockFrom.mockReturnValue({ insert });
    const { wrapper, invalidate } = bungkus();
    const { result } = await renderHook(() => useSimpanBudget(), { wrapper });
    let galat: unknown;
    await act(async () => {
      galat = await result.current.mutateAsync({ kategori: 'Makan', batas_bulanan: 1 }).catch((e: unknown) => e);
    });
    expect(galat).toMatchObject({ code: '23505' });
    expect(pesanBudget(galat)).toBe('Budget untuk kategori ini sudah ada');
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('useHapusBudget', () => {
  it('delete by id lalu invalidasi', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ delete: del });
    const { wrapper, invalidate } = bungkus();
    const { result } = await renderHook(() => useHapusBudget(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('b1');
    });
    expect(eq).toHaveBeenCalledWith('id', 'b1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['budgets'] });
  });
});

describe('pesanBudget', () => {
  it('selain 23505 meneruskan pesan AppError, dan galat mentah jadi pesan umum', () => {
    expect(pesanBudget({ kind: 'offline', pesan: 'Tidak ada koneksi. Coba lagi.' })).toBe('Tidak ada koneksi. Coba lagi.');
    expect(pesanBudget(new Error('x'))).toBe('Terjadi kesalahan. Coba lagi.');
  });
});
