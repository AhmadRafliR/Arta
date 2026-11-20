import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Premium from '../../../app/premium';
import { LanggananContext } from '@/langganan/LanggananProvider';
import type { PenyediaLangganan } from '@/langganan/tipe';

const mockStatus = jest.fn();
jest.mock('@/data/langganan', () => ({
  ...jest.requireActual('@/data/langganan'),
  useStatusLangganan: () => mockStatus(),
  ambilStatusLangganan: jest.fn(),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: { accFg: '#000', mid: '#888', fg: '#111' } }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

const PAKET = [
  { id: 'b', jenis: 'bulanan' as const, harga: 'Rp19.000', hargaPerBulan: null, ujiCobaHari: 14 },
  { id: 't', jenis: 'tahunan' as const, harga: 'Rp190.000', hargaPerBulan: null, ujiCobaHari: null },
];

function penyedia(o: Partial<PenyediaLangganan> = {}): PenyediaLangganan {
  return {
    nama: 'revenuecat',
    masuk: jest.fn(async () => {}),
    keluar: jest.fn(async () => {}),
    paket: jest.fn(async () => PAKET),
    beli: jest.fn(async () => ({ status: 'sukses' as const })),
    pulihkan: jest.fn(async () => ({ status: 'sukses' as const })),
    urlKelola: jest.fn(async () => null),
    ...o,
  };
}

async function tampil(p: PenyediaLangganan) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={qc}>
      <LanggananContext.Provider value={p}>
        <Premium />
      </LanggananContext.Provider>
    </QueryClientProvider>,
  );
}

const belumPro = { data: { pro: false, berlakuSampai: null, periode: null }, isPending: false };

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus.mockReturnValue(belumPro);
});

describe('Premium', () => {
  it('menampilkan harga dan tombol uji coba; menekan memanggil beli', async () => {
    const p = penyedia({ beli: jest.fn(async () => ({ status: 'batal' as const })) });
    await tampil(p);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mulai uji coba 14 hari' })).toBeTruthy());
    expect(screen.getByText('Bulanan · Rp19.000')).toBeTruthy();
    expect(screen.getByText('Tahunan · Rp190.000')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Mulai uji coba 14 hari' }));
    await waitFor(() => expect(p.beli).toHaveBeenCalledWith('b'));
  });

  it('paket tanpa trial: tombol "Langganan {harga}"', async () => {
    await tampil(penyedia());
    await waitFor(() => screen.getByText('Tahunan · Rp190.000'));
    await fireEvent.press(screen.getByRole('button', { name: 'Tahunan · Rp190.000' }));
    expect(screen.getByRole('button', { name: 'Langganan Rp190.000' })).toBeTruthy();
  });

  it('batal tidak menampilkan galat', async () => {
    await tampil(penyedia({ beli: jest.fn(async () => ({ status: 'batal' as const })) }));
    await waitFor(() => screen.getByRole('button', { name: 'Mulai uji coba 14 hari' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Mulai uji coba 14 hari' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('galat dari penyedia ditampilkan', async () => {
    await tampil(penyedia({ beli: jest.fn(async () => ({ status: 'galat' as const, pesan: 'Gagal bayar' })) }));
    await waitFor(() => screen.getByRole('button', { name: 'Mulai uji coba 14 hari' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Mulai uji coba 14 hari' }));
    await waitFor(() => expect(screen.getByText('Gagal bayar')).toBeTruthy());
  });

  it('sudah Pro: kartu Pro aktif + Kelola langganan membuka URL', async () => {
    mockStatus.mockReturnValue({
      data: { pro: true, berlakuSampai: '2026-12-04T10:00:00Z', periode: 'trial' },
      isPending: false,
    });
    const spy = jest.spyOn(Linking, 'openURL').mockImplementation(async () => {});
    const p = penyedia({ urlKelola: jest.fn(async () => 'https://play.example/kelola') });
    await tampil(p);
    expect(screen.getByText('Pro aktif')).toBeTruthy();
    expect(screen.getByText(/Uji coba sampai 4 Des 2026/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Kelola langganan' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('https://play.example/kelola'));
  });

  it('tidak-tersedia: pesan ramah, tanpa tombol beli', async () => {
    await tampil(penyedia({ nama: 'tidak-tersedia', paket: jest.fn(async () => []) }));
    await waitFor(() => expect(screen.getByText(/belum tersedia/)).toBeTruthy());
    expect(screen.queryByRole('button', { name: /uji coba/ })).toBeNull();
  });

  it('mode mock: label uji dan status tidak diubah', async () => {
    await tampil(penyedia({ nama: 'mock' }));
    expect(screen.getByText('Mode uji: pembayaran tidak sungguhan')).toBeTruthy();
  });
});
