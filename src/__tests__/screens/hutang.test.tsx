import { fireEvent, render, screen } from '@testing-library/react-native';
import Hutang from '../../../app/(tabs)/hutang';
import { buatHutang } from '@/domain/testFactories';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
let mockPro = false;
let mockDebts: { data?: unknown; error?: { pesan: string } };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate, back: jest.fn(), canGoBack: () => true }),
  useFocusEffect: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/data/debts', () => ({
  useDebts: () => mockDebts,
  useRiwayatPokok: () => ({ data: {} }),
}));
jest.mock('@/data/langganan', () => ({ usePro: () => ({ pro: mockPro, memuat: false }) }));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' } }),
}));
jest.mock('@/nav/useGulirPulau', () => ({ useGulirPulau: () => ({}) }));
jest.mock('@/lib/tanggal', () => ({
  ...jest.requireActual('@/lib/tanggal'),
  hariIni: () => '2026-11-20',
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ t: { fg2: '#555', warnInk: '#8A5A00', mid: '#888', accFg: '#000', fg: '#000', acc: '#0f0' } }),
}));

const kredivo = buatHutang({
  id: 'h1',
  pemberi: 'Kredivo',
  tipe: 'cicilan_tetap',
  pokok_awal: 1_200_000,
  nominal_cicilan: 100_000,
  tenor_bulan: 12,
  bunga_persen_bulanan: null,
  metode: null,
  sisa_pokok: 1_100_000,
  jumlah_tagihan: 12,
  tagihan_lunas: 1,
  jatuh_tempo_berikutnya: '2026-11-23',
  nominal_berikutnya: 100_000,
});
const andi = buatHutang({ id: 'h2', pemberi: 'Pinjaman Andi', pokok_awal: 1_000_000, sisa_pokok: 600_000, metode: 'efektif' });

beforeEach(() => {
  jest.clearAllMocks();
  mockDebts = { data: [kredivo, andi] };
  mockPro = false;
});

describe('Tab Hutang', () => {
  it('menampilkan total, jatuh tempo, dan sub cicilan', async () => {
    await render(<Hutang />);
    expect(screen.getByText('Rp1.700.000')).toBeTruthy();
    // Kartu ringkasan: tagihan terdekat; kartu: tanggal + sisa hari.
    expect(screen.getByText('3 hari lagi')).toBeTruthy();
    expect(screen.getByText('23 Nov 2026 · 3 hari lagi')).toBeTruthy();
    expect(screen.getByText('1/12 lunas · Rp100.000/bln')).toBeTruthy();
    expect(screen.getByText('2 aktif')).toBeTruthy();
  });

  it('tombol Bayar di kartu membuka form bayar', async () => {
    await render(<Hutang />);
    await fireEvent.press(screen.getByRole('button', { name: 'Bayar Kredivo' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/hutang/bayar', params: { id: 'h1' } });
  });

  it('pengingat: bukan Pro membuka Premium, Pro membuka Akun', async () => {
    await render(<Hutang />);
    await fireEvent.press(screen.getByRole('button', { name: 'Pengingat jatuh tempo, fitur Pro' }));
    expect(mockPush).toHaveBeenCalledWith('/premium?dari=pengingat');
    mockPro = true;
    await render(<Hutang />);
    await fireEvent.press(screen.getByRole('button', { name: 'Atur pengingat jatuh tempo' }));
    expect(mockNavigate).toHaveBeenCalledWith('/akun');
  });

  it('ketuk kartu membuka detail', async () => {
    await render(<Hutang />);
    await fireEvent.press(screen.getByRole('button', { name: 'Kredivo' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/hutang/[id]', params: { id: 'h1' } });
  });

  it('kosong: pesan dan tombol tambah', async () => {
    mockDebts = { data: [] };
    await render(<Hutang />);
    expect(screen.getByText('Aman, belum ada hutang')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tambah hutang' }));
    expect(mockPush).toHaveBeenCalledWith('/hutang/baru');
  });

  it('galat menampilkan pesan', async () => {
    mockDebts = { error: { pesan: 'Gagal memuat' } };
    await render(<Hutang />);
    expect(screen.getByText('Gagal memuat')).toBeTruthy();
  });

  it('hutang diarsip tidak tampil di daftar utama, ada tautan', async () => {
    mockDebts = { data: [kredivo, buatHutang({ id: 'h3', pemberi: 'Lama', diarsip: true, sisa_pokok: 0 })] };
    await render(<Hutang />);
    expect(screen.queryByText('Lama')).toBeNull();
    await fireEvent.press(screen.getByText('Tampilkan yang diarsip (1)'));
    expect(screen.getByText('Lama')).toBeTruthy();
  });
});
