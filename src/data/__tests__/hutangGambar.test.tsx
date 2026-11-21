import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { bacaScreenshotHutang, tentukanMime, useBacaScreenshotHutang } from '../hutangGambar';

const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } },
}));

const galatHttp = (body: unknown) => ({
  name: 'FunctionsHttpError',
  message: 'non-2xx',
  context: { json: async () => body },
});
const kuota = { bulan: '2026-11', terpakai: 1, batas: 30, pro: false };
const draf = {
  pemberi: 'Kredivo', tipe: 'cicilan_tetap', nominal_cicilan: 250000, tenor_bulan: 6, jatuh_tempo: '2026-12-05',
  pokok_awal: null, bunga_persen_bulanan: null, sisa_pokok: null, catatan: null,
};

beforeEach(() => jest.clearAllMocks());

describe('bacaScreenshotHutang', () => {
  it('sukses: invoke parse-hutang dengan body kontrak', async () => {
    mockInvoke.mockResolvedValue({ data: { draf, pesan: null, kuota }, error: null });
    const h = await bacaScreenshotHutang({ base64: 'QUJD', mime: 'image/png' });
    expect(mockInvoke).toHaveBeenCalledWith('parse-hutang', { body: { gambar_base64: 'QUJD', mime: 'image/png' } });
    expect(h.draf?.pemberi).toBe('Kredivo');
    expect(h.kuota).toEqual(kuota);
  });

  it('draf null: pesan server diteruskan', async () => {
    mockInvoke.mockResolvedValue({ data: { draf: null, pesan: 'Bukan tagihan', kuota }, error: null });
    const h = await bacaScreenshotHutang({ base64: 'QUJD', mime: 'image/jpeg' });
    expect(h.draf).toBeNull();
    expect(h.pesan).toBe('Bukan tagihan');
  });

  it('galat server: pesan dari server', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: galatHttp({ galat: 'ai_gagal', pesan: 'AI sibuk' }) });
    await expect(bacaScreenshotHutang({ base64: 'QUJD', mime: 'image/jpeg' })).rejects.toMatchObject({
      kind: 'lain',
      pesan: 'AI sibuk',
    });
  });

  it('kuota habis: kind kuota', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: galatHttp({ galat: 'quota_exceeded', pesan: 'Kuota habis' }) });
    await expect(bacaScreenshotHutang({ base64: 'QUJD', mime: 'image/jpeg' })).rejects.toMatchObject({ kind: 'kuota' });
  });

  it('gambar > 6 MB ditolak tanpa memanggil server', async () => {
    await expect(
      bacaScreenshotHutang({ base64: 'A'.repeat(9 * 1024 * 1024), mime: 'image/jpeg' }),
    ).rejects.toMatchObject({ kind: 'validasi' });
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe('tentukanMime', () => {
  it('mimeType, lalu ekstensi, lalu bawaan jpeg', () => {
    expect(tentukanMime('image/webp', 'a.jpg')).toBe('image/webp');
    expect(tentukanMime(undefined, 'file:///x/a.PNG?v=1')).toBe('image/png');
    expect(tentukanMime(null, 'file:///x/a.heic')).toBe('image/jpeg');
  });
});

describe('useBacaScreenshotHutang', () => {
  it('meng-invalidate kuota-ai setelah selesai', async () => {
    mockInvoke.mockResolvedValue({ data: { draf, pesan: null, kuota }, error: null });
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = await renderHook(() => useBacaScreenshotHutang(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ base64: 'QUJD', mime: 'image/jpeg' });
    });
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['kuota-ai'] }));
  });
});
