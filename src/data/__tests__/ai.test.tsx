import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { kirimKeAi, sisaKuota, useKuotaAi } from '../ai';

const mockInvoke = jest.fn();
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    rpc: (...a: unknown[]) => mockRpc(...a),
  },
}));
const mockBaca = jest.fn();
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (...a: unknown[]) => mockBaca(...a),
}));

const sukses = {
  transkrip: 'makan 15rb',
  draf: [],
  koreksi: [],
  tidakDidukung: [],
  butuh_klarifikasi: false,
  pertanyaan: null,
  kuota: { bulan: '2026-11', terpakai: 1, batas: 30, pro: false },
};

beforeEach(() => jest.clearAllMocks());

const galatHttp = (body: unknown) => ({
  name: 'FunctionsHttpError',
  message: 'Edge Function returned a non-2xx status code',
  context: { json: async () => body },
});

describe('kirimKeAi', () => {
  it('teks: invoke parse dengan body {teks}', async () => {
    mockInvoke.mockResolvedValue({ data: sukses, error: null });
    const h = await kirimKeAi({ teks: 'makan 15rb' });
    expect(mockInvoke).toHaveBeenCalledWith('parse', { body: { teks: 'makan 15rb' } });
    expect(h).toEqual(sukses);
  });

  it('audio: baca base64 lalu kirim audio_base64 dan mime', async () => {
    mockBaca.mockResolvedValue('QUJD');
    mockInvoke.mockResolvedValue({ data: sukses, error: null });
    await kirimKeAi({ audioUri: 'file:///a.m4a', mime: 'audio/m4a' });
    expect(mockBaca).toHaveBeenCalledWith('file:///a.m4a', { encoding: 'base64' });
    expect(mockInvoke).toHaveBeenCalledWith('parse', { body: { audio_base64: 'QUJD', mime: 'audio/m4a' } });
  });

  it('quota_exceeded -> kind kuota dengan pesan server', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: galatHttp({ galat: 'quota_exceeded', pesan: 'Kuota habis' }) });
    await expect(kirimKeAi({ teks: 'x' })).rejects.toMatchObject({ kind: 'kuota', pesan: 'Kuota habis' });
  });

  it('ai_gagal -> pesan server; server tanpa pesan -> pesan umum', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: galatHttp({ galat: 'ai_gagal', pesan: 'AI sibuk' }) });
    await expect(kirimKeAi({ teks: 'x' })).rejects.toMatchObject({ kind: 'lain', pesan: 'AI sibuk' });
    mockInvoke.mockResolvedValue({ data: null, error: galatHttp({ galat: 'server' }) });
    await expect(kirimKeAi({ teks: 'x' })).rejects.toMatchObject({ kind: 'lain', pesan: 'Terjadi kesalahan. Coba lagi.' });
  });

  it('body galat tak terbaca -> kind lain umum', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        message: 'x',
        context: {
          json: async () => {
            throw new Error('bukan json');
          },
        },
      },
    });
    await expect(kirimKeAi({ teks: 'x' })).rejects.toMatchObject({ kind: 'lain', pesan: 'Terjadi kesalahan. Coba lagi.' });
  });

  it('kegagalan jaringan -> offline', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function' },
    });
    await expect(kirimKeAi({ teks: 'x' })).rejects.toMatchObject({ kind: 'offline', pesan: 'Tidak ada koneksi. Coba lagi.' });
    mockInvoke.mockRejectedValue(new TypeError('Network request failed'));
    await expect(kirimKeAi({ teks: 'x' })).rejects.toMatchObject({ kind: 'offline' });
  });

  it('sukses menginvalidasi [kuota-ai] bila queryClient diberikan', async () => {
    mockInvoke.mockResolvedValue({ data: sukses, error: null });
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    await kirimKeAi({ teks: 'x' }, qc);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['kuota-ai'] });
    qc.clear();
  });
});

describe('sisaKuota', () => {
  it('menghitung sisa dan tidak negatif', () => {
    expect(sisaKuota({ terpakai: 12, batas: 30 })).toBe(18);
    expect(sisaKuota({ terpakai: 40, batas: 30 })).toBe(0);
  });
});

describe('useKuotaAi', () => {
  it('memanggil rpc kuota_ai', async () => {
    mockRpc.mockResolvedValue({ data: { bulan: '2026-11', terpakai: 2, batas: 30, pro: false }, error: null });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const W = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = await renderHook(() => useKuotaAi(), { wrapper: W });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRpc).toHaveBeenCalledWith('kuota_ai');
    expect(result.current.data?.terpakai).toBe(2);
    qc.clear();
  });
});
