import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { usePengaturanPengingat, useSimpanPengingat } from '../pengingat';

const mockMaybeSingle = jest.fn();
const mockUpsert = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ maybeSingle: () => mockMaybeSingle() }),
      upsert: (...a: unknown[]) => mockUpsert(...a),
    }),
  },
}));

function bungkus() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

beforeEach(() => jest.clearAllMocks());

describe('usePengaturanPengingat', () => {
  it('tanpa baris: default aktif, H-1, 08.00', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => usePengaturanPengingat(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ aktif: true, hari_sebelum: 1, jam: 8 });
  });

  it('membaca baris tersimpan', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { aktif: false, hari_sebelum: 3, jam: 19 }, error: null });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => usePengaturanPengingat(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ aktif: false, hari_sebelum: 3, jam: 19 });
  });

  it('galat dipetakan ke AppError', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => usePengaturanPengingat(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe('lain');
  });
});

describe('useSimpanPengingat', () => {
  it('upsert dengan onConflict user_id dan memperbarui cache', async () => {
    mockUpsert.mockResolvedValue({ error: null });
    const { qc, wrapper } = bungkus();
    const { result } = await renderHook(() => useSimpanPengingat(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ aktif: true, hari_sebelum: 3, jam: 12 });
    });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ aktif: true, hari_sebelum: 3, jam: 12 }),
      { onConflict: 'user_id' },
    );
    expect(qc.getQueryData(['pengingat'])).toEqual({ aktif: true, hari_sebelum: 3, jam: 12 });
  });
});
