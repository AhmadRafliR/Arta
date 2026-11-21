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
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({})) }));

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

  it('ketentuan uji coba terlihat sebelum membeli: harga sesudahnya, perpanjangan otomatis, cara batal', async () => {
    await tampil(penyedia());
    await waitFor(() => screen.getByTestId('ketentuan-langganan'));
    expect(screen.getByText('14 hari')).toBeTruthy();
    const teks = screen.getByTestId('ketentuan-langganan').props.children as string;
    expect(teks).toContain('Gratis 14 hari, lalu Rp19.000 per bulan');
    expect(teks).toContain('diperpanjang otomatis');
    expect(teks).toContain('Batalkan sebelum uji coba berakhir');
    expect(screen.getByText(/Batalkan kapan saja di Google Play/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Kebijakan privasi' })).toBeTruthy();
  });

  it('akun yang tidak lagi berhak uji coba: tidak ada klaim "14 hari", harga per periode ditampilkan', async () => {
    const tanpaUji = PAKET.map((p) => ({ ...p, ujiCobaHari: null }));
    await tampil(penyedia({ paket: jest.fn(async () => tanpaUji) }));
    await waitFor(() => screen.getByRole('button', { name: 'Langganan Rp19.000' }));
    expect(screen.queryByText('Coba Premium')).toBeNull();
    expect(screen.queryByText(/14 hari/)).toBeNull();
    expect(screen.getByText('per bulan')).toBeTruthy();
    const teks = screen.getByTestId('ketentuan-langganan').props.children as string;
    expect(teks).toBe(
      'Rp19.000 per bulan, ditagih lewat Google Play saat kamu mengonfirmasi, lalu diperpanjang otomatis tiap bulan sampai kamu membatalkannya.',
    );
  });

  it('tabel fitur sesuai gerbang app: Pro tanpa iklan, ekspor gratis lewat iklan', async () => {
    await tampil(penyedia());
    expect(screen.getByText('Tanpa iklan')).toBeTruthy();
    expect(screen.getAllByText('Tonton iklan').length).toBe(2);
  });

  it('gagal memuat paket: tanpa tombol beli, Coba lagi memuat ulang', async () => {
    const paket = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(PAKET);
    await tampil(penyedia({ paket }));
    await waitFor(() => screen.getByRole('button', { name: 'Coba lagi' }));
    expect(screen.queryByRole('button', { name: /uji coba/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
    await waitFor(() => screen.getByRole('button', { name: 'Mulai uji coba 14 hari' }));
    expect(paket).toHaveBeenCalledTimes(2);
  });

  it('mode mock: label uji dan status tidak diubah', async () => {
    await tampil(penyedia({ nama: 'mock' }));
    expect(screen.getByText('Mode uji: pembayaran tidak sungguhan')).toBeTruthy();
  });
});
