import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  kirimVerifikasi,
  useHapusPenerima,
  useKirimLaporan,
  usePenerima,
  useTambahPenerima,
} from '../laporan';

const mockFrom = jest.fn();
const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
  },
}));

function bungkus() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = jest.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidate };
}

const galatHttp = (body: unknown) => ({
  name: 'FunctionsHttpError',
  message: 'Edge Function returned a non-2xx status code',
  context: { json: async () => body },
});

const barisBaru = { id: 'p1', email: 'ortu@example.com', terverifikasi: false, verifikasi_dikirim_pada: null };

function siapkanInsert(hasil: { data: unknown; error: unknown }) {
  const single = jest.fn().mockResolvedValue(hasil);
  const select = jest.fn().mockReturnValue({ single });
  const insert = jest.fn().mockReturnValue({ select });
  mockFrom.mockReturnValue({ insert });
  return { insert, select };
}

beforeEach(() => jest.clearAllMocks());

describe('usePenerima', () => {
  it('membaca penerima urut created_at', async () => {
    const order = jest.fn().mockResolvedValue({ data: [barisBaru], error: null });
    const select = jest.fn().mockReturnValue({ order });
    mockFrom.mockReturnValue({ select });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => usePenerima(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFrom).toHaveBeenCalledWith('report_recipients');
    expect(select).toHaveBeenCalledWith('id,email,terverifikasi,verifikasi_dikirim_pada');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(result.current.data).toEqual([barisBaru]);
  });
});

describe('useTambahPenerima', () => {
  it('menormalisasi email, insert hanya {email}, lalu kirim verifikasi dan invalidasi', async () => {
    const { insert } = siapkanInsert({ data: barisBaru, error: null });
    mockInvoke.mockResolvedValue({ data: { terkirim: true }, error: null });
    const { wrapper, invalidate } = bungkus();
    const { result } = await renderHook(() => useTambahPenerima(), { wrapper });
    let hasil: unknown;
    await act(async () => {
      hasil = await result.current.mutateAsync('  Ortu@Example.COM ');
    });
    expect(insert).toHaveBeenCalledWith({ email: 'ortu@example.com' });
    expect(mockInvoke).toHaveBeenCalledWith('report-send', { body: { aksi: 'verifikasi', recipient_id: 'p1' } });
    expect(hasil).toEqual({ penerima: barisBaru, verifikasiTerkirim: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['penerima-laporan'] });
  });

  it('email tidak valid ditolak lokal tanpa memanggil supabase', async () => {
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => useTambahPenerima(), { wrapper });
    let galat: unknown;
    await act(async () => {
      galat = await result.current.mutateAsync('bukan-email').catch((e: unknown) => e);
    });
    expect(galat).toMatchObject({ kind: 'validasi', pesan: 'Alamat email tidak valid' });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('verifikasi gagal tidak menggagalkan penambahan', async () => {
    siapkanInsert({ data: barisBaru, error: null });
    mockInvoke.mockResolvedValue({ data: null, error: galatHttp({ galat: 'bukan_pro', pesan: 'Laporan email khusus Pro.' }) });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => useTambahPenerima(), { wrapper });
    let hasil: unknown;
    await act(async () => {
      hasil = await result.current.mutateAsync('ortu@example.com');
    });
    expect(hasil).toEqual({
      penerima: barisBaru,
      verifikasiTerkirim: false,
      pesanVerifikasi: 'Laporan email khusus Pro.',
    });
  });

  it('23505 -> pesan email sudah ada; verifikasi tidak dipanggil', async () => {
    siapkanInsert({ data: null, error: { code: '23505', message: 'duplicate key' } });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => useTambahPenerima(), { wrapper });
    let galat: unknown;
    await act(async () => {
      galat = await result.current.mutateAsync('ortu@example.com').catch((e: unknown) => e);
    });
    expect(galat).toMatchObject({ pesan: 'Email ini sudah ada di daftar' });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('batas 3 penerima dari trigger diteruskan apa adanya', async () => {
    siapkanInsert({ data: null, error: { code: 'P0001', message: 'Maksimal 3 penerima laporan' } });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => useTambahPenerima(), { wrapper });
    let galat: unknown;
    await act(async () => {
      galat = await result.current.mutateAsync('ortu@example.com').catch((e: unknown) => e);
    });
    expect(galat).toMatchObject({ pesan: 'Maksimal 3 penerima laporan' });
  });
});

describe('useHapusPenerima', () => {
  it('delete by id lalu invalidasi', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ delete: jest.fn().mockReturnValue({ eq }) });
    const { wrapper, invalidate } = bungkus();
    const { result } = await renderHook(() => useHapusPenerima(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('p1');
    });
    expect(eq).toHaveBeenCalledWith('id', 'p1');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['penerima-laporan'] });
  });
});

describe('kirimVerifikasi', () => {
  it('offline -> kind offline', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError', message: 'x' } });
    await expect(kirimVerifikasi('p1')).rejects.toMatchObject({ kind: 'offline', pesan: 'Tidak ada koneksi. Coba lagi.' });
  });

  it('batas 429 -> pesan server', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: galatHttp({ galat: 'batas', pesan: 'Tunggu 10 menit sebelum mengirim ulang verifikasi.' }),
    });
    await expect(kirimVerifikasi('p1')).rejects.toMatchObject({
      pesan: 'Tunggu 10 menit sebelum mengirim ulang verifikasi.',
    });
  });

  it('body bukan JSON -> pesan umum', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsHttpError', message: 'x', context: { json: async () => { throw new Error('bukan json'); } } },
    });
    await expect(kirimVerifikasi('p1')).rejects.toMatchObject({ pesan: 'Terjadi kesalahan. Coba lagi.' });
  });
});

describe('useKirimLaporan', () => {
  it('invoke report-send aksi kirim dengan bulan', async () => {
    mockInvoke.mockResolvedValue({ data: { terkirim: 2, bulan: '2026-11' }, error: null });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => useKirimLaporan(), { wrapper });
    let hasil: unknown;
    await act(async () => {
      hasil = await result.current.mutateAsync({ bulan: '2026-11' });
    });
    expect(mockInvoke).toHaveBeenCalledWith('report-send', { body: { aksi: 'kirim', bulan: '2026-11' } });
    expect(hasil).toEqual({ terkirim: 2, bulan: '2026-11' });
  });

  it('bukan_pro -> AppError dengan pesan server', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: galatHttp({ galat: 'bukan_pro', pesan: 'Laporan email khusus Pro.' }) });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => useKirimLaporan(), { wrapper });
    let galat: unknown;
    await act(async () => {
      galat = await result.current.mutateAsync({ bulan: '2026-11' }).catch((e: unknown) => e);
    });
    expect(galat).toMatchObject({ pesan: 'Laporan email khusus Pro.' });
  });

  it('batas 429 -> pesan server', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: galatHttp({ galat: 'batas', pesan: 'Batas kirim laporan 3 kali per hari' }) });
    const { wrapper } = bungkus();
    const { result } = await renderHook(() => useKirimLaporan(), { wrapper });
    let galat: unknown;
    await act(async () => {
      galat = await result.current.mutateAsync({ bulan: '2026-11' }).catch((e: unknown) => e);
    });
    expect(galat).toMatchObject({ pesan: 'Batas kirim laporan 3 kali per hari' });
  });
});
