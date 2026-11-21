import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { GerbangIklan } from '../GerbangIklan';

const mockPush = jest.fn();
const mockKlaim = jest.fn();
const mockTonton = jest.fn();
let mockPro = { pro: false, memuat: false };
let mockAkses: { isPending: boolean; data: Date | null } = { isPending: false, data: null };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ profile: { zona_waktu: 'Asia/Jakarta' } }) }));
jest.mock('@/theme/ThemeProvider', () => {
  const { tokens } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ mode: 'terang', t: tokens.terang }) };
});
jest.mock('@/data/langganan', () => ({ usePro: () => mockPro }));
jest.mock('@/data/aksesIklan', () => ({
  ...jest.requireActual('@/data/aksesIklan'),
  useAksesIklan: () => mockAkses,
  useKlaimAksesIklan: () => ({ mutateAsync: mockKlaim }),
}));
jest.mock('@/iklan/reward', () => ({ tontonIklanReward: (...a: unknown[]) => mockTonton(...a) }));

const btn = (name: string) => screen.getByRole('button', { name });
const tampil = () =>
  render(
    <GerbangIklan fitur="ekspor" nama="ekspor data" dari="ekspor">
      <Text>ISI FITUR</Text>
    </GerbangIklan>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockPro = { pro: false, memuat: false };
  mockAkses = { isPending: false, data: null };
  mockKlaim.mockResolvedValue(new Date(Date.now() + 30 * 60 * 1000));
});

describe('GerbangIklan', () => {
  it('Pro: isi langsung tampil tanpa gerbang', async () => {
    mockPro = { pro: true, memuat: false };
    await tampil();
    expect(screen.getByText('ISI FITUR')).toBeTruthy();
    expect(screen.queryByText(/Tonton satu iklan/)).toBeNull();
  });

  it('status Pro belum pasti: tidak menampilkan isi maupun gerbang', async () => {
    mockPro = { pro: false, memuat: true };
    await tampil();
    expect(screen.queryByText('ISI FITUR')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tonton iklan untuk membuka' })).toBeNull();
  });

  it('non-Pro tanpa akses: gerbang, isi tersembunyi, Lihat Pro ke premium', async () => {
    await tampil();
    expect(screen.queryByText('ISI FITUR')).toBeNull();
    await fireEvent.press(btn('Lihat Pro'));
    expect(mockPush).toHaveBeenCalledWith('/premium?dari=ekspor');
  });

  it('iklan ditonton sampai selesai: akses dicatat', async () => {
    mockTonton.mockResolvedValue('selesai');
    await tampil();
    await fireEvent.press(btn('Tonton iklan untuk membuka'));
    await waitFor(() => expect(mockKlaim).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['dibatalkan', /Tonton sampai habis/],
    ['gagal', /belum tersedia/],
    ['tidak-tersedia', /tidak tersedia di perangkat/],
  ])('hasil %s: tidak ada akses, pesan tampil', async (hasil, pola) => {
    mockTonton.mockResolvedValue(hasil);
    await tampil();
    await fireEvent.press(btn('Tonton iklan untuk membuka'));
    expect(await screen.findByText(pola)).toBeTruthy();
    expect(mockKlaim).not.toHaveBeenCalled();
  });

  it('klaim gagal di server: pesan galat tampil', async () => {
    mockTonton.mockResolvedValue('selesai');
    mockKlaim.mockRejectedValue({ kind: 'server', pesan: 'Terlalu cepat, coba lagi sebentar' });
    await tampil();
    await fireEvent.press(btn('Tonton iklan untuk membuka'));
    expect(await screen.findByText('Terlalu cepat, coba lagi sebentar')).toBeTruthy();
  });

  it('akses masih berlaku: isi tampil dengan info batas waktu', async () => {
    mockAkses = { isPending: false, data: new Date(Date.now() + 15 * 60 * 1000) };
    await tampil();
    expect(screen.getByText('ISI FITUR')).toBeTruthy();
    expect(screen.getByText(/Akses terbuka sampai/)).toBeTruthy();
  });

  it('akses sudah kedaluwarsa: gerbang kembali', async () => {
    mockAkses = { isPending: false, data: new Date(Date.now() - 1000) };
    await tampil();
    expect(screen.queryByText('ISI FITUR')).toBeNull();
  });

  it('akses habis saat layar terbuka: gerbang muncul lagi', async () => {
    jest.useFakeTimers();
    try {
      mockAkses = { isPending: false, data: new Date(Date.now() + 2000) };
      await tampil();
      expect(screen.getByText('ISI FITUR')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.queryByText('ISI FITUR')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
