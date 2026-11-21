import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PengaturanPengingat } from '../PengaturanPengingat';

jest.mock('@/theme/ThemeProvider', () => {
  const { tokens } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ mode: 'terang', t: tokens.terang }) };
});

const mockIzin = jest.fn();
const mockUji = jest.fn();
jest.mock('@/notifikasi/lokal', () => ({
  mintaIzinNotifikasi: () => mockIzin(),
  kirimNotifikasiUji: () => mockUji(),
}));

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

async function tampil(pro: boolean, onBukaPremium = jest.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = await render(
    <QueryClientProvider client={qc}>
      <PengaturanPengingat pro={pro} onBukaPremium={onBukaPremium} />
    </QueryClientProvider>,
  );
  return { ui, onBukaPremium };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsert.mockResolvedValue({ error: null });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
});

describe('PengaturanPengingat', () => {
  it('non-Pro: baris terkunci membuka premium, tanpa kontrol', async () => {
    const { onBukaPremium } = await tampil(false);
    await fireEvent.press(await screen.findByRole('button', { name: 'Pengingat jatuh tempo, fitur Pro' }));
    expect(screen.getByLabelText('Paket Pro')).toBeTruthy();
    expect(onBukaPremium).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('H-3')).toBeNull();
    expect(screen.queryByLabelText('Pengingat jatuh tempo')).toBeNull();
  });

  it('Pro: chip H-3 menyimpan hari_sebelum 3', async () => {
    await tampil(true);
    await fireEvent.press(await screen.findByText('H-3'));
    await waitFor(() =>
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ aktif: true, hari_sebelum: 3, jam: 8 }),
        { onConflict: 'user_id' },
      ),
    );
  });

  it('Pro: chip jam 19.00 menyimpan jam 19', async () => {
    await tampil(true);
    await fireEvent.press(await screen.findByText('19.00'));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ jam: 19 }), expect.anything()));
  });

  it('Pro: menyalakan meminta izin notifikasi lalu menyimpan aktif', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { aktif: false, hari_sebelum: 1, jam: 8 }, error: null });
    mockIzin.mockResolvedValue('diberikan');
    await tampil(true);
    const saklar = await screen.findByLabelText('Pengingat jatuh tempo');
    await waitFor(() => expect(saklar.props.value).toBe(false));
    await fireEvent(saklar, 'valueChange', true);
    await waitFor(() => expect(mockIzin).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ aktif: true }), expect.anything()));
  });

  it('izin ditolak: pesan dan tombol Buka Pengaturan, tanpa simpan', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { aktif: false, hari_sebelum: 1, jam: 8 }, error: null });
    mockIzin.mockResolvedValue('ditolak');
    await tampil(true);
    const saklar = await screen.findByLabelText('Pengingat jatuh tempo');
    await waitFor(() => expect(saklar.props.value).toBe(false));
    await fireEvent(saklar, 'valueChange', true);
    expect(await screen.findByText('Izin notifikasi ditolak. Buka Pengaturan untuk mengizinkan.')).toBeTruthy();
    expect(screen.getByText('Buka Pengaturan')).toBeTruthy();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('aktif: tombol uji mengirim notifikasi dan menampilkan umpan balik', async () => {
    mockUji.mockResolvedValue(true);
    await tampil(true);
    await fireEvent.press(await screen.findByRole('button', { name: 'Kirim notifikasi uji' }));
    expect(await screen.findByText('Notifikasi uji dikirim. Cek bilah notifikasi.')).toBeTruthy();
    expect(mockUji).toHaveBeenCalledTimes(1);
  });
});
