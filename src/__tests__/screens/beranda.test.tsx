import { fireEvent, render, screen } from '@testing-library/react-native';
import Beranda from '../../../app/(tabs)/index';

const mockNavigate = jest.fn();

let mockBudgets: { data: unknown[] | undefined; error?: unknown } = { data: [] };
let mockBulan: { isLoading: boolean; error: unknown; data: unknown[] | undefined } | null = null;

jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate, push: jest.fn() }), useFocusEffect: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' } }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'terang',
    t: { heroFrom: '#0B424F', heroTo: '#1F6A76', heroFg: '#FFFFFF' },
  }),
}));
jest.mock('@/data/budgets', () => ({ useBudgets: () => mockBudgets }));
jest.mock('@/data/wallets', () => {
  const { W } = jest.requireActual('@/domain/testFactories');
  return {
    useWallets: () => ({
      data: [
        { ...W('GoPay', 200000), nama: 'GoPay' },
        { ...W('Cash', 88000), nama: 'Cash' },
        { ...W('Tabungan', 5000000, 'darurat'), nama: 'Tabungan' },
      ],
    }),
  };
});
jest.mock('@/data/transactions', () => {
  const { T } = jest.requireActual('@/domain/testFactories');
  const bln = jest.requireActual('@/lib/tanggal').hariIni('Asia/Jakarta').slice(0, 7);
  return {
    useAllTransactions: () => ({ data: [] }),
    useTransactions: () =>
      mockBulan ?? {
        isLoading: false,
        error: null,
        data: [
          { ...T('pemasukan', 1500000, 'GoPay', null, `${bln}-05`), kategori: 'Gaji' },
          { ...T('pengeluaran', 25000, 'Cash', null, `${bln}-04`), kategori: 'Makan' },
        ],
      },
  };
});

beforeEach(() => {
  mockBulan = null;
  mockBudgets = { data: [] };
});

describe('Beranda', () => {
  it('sapaan, nama, hero, bulan ini, terbaru', async () => {
    await render(<Beranda />);
    expect(screen.getByText('Rafli')).toBeTruthy();
    expect(screen.getByText('Rp288.000')).toBeTruthy(); // sisa uang: hanya dompet harian
    expect(screen.getByText('Kekayaan bersih Rp5.288.000')).toBeTruthy();
    expect(screen.getByText('Bulan ini')).toBeTruthy();
    expect(screen.getByText('Rp1.500.000')).toBeTruthy(); // masuk
    expect(screen.getByText('Rp25.000')).toBeTruthy(); // keluar
    expect(screen.getByText(/^Gaji · GoPay/)).toBeTruthy();
    expect(screen.getByText('+Rp1.500.000')).toBeTruthy();
    expect(screen.getByText('-Rp25.000')).toBeTruthy();
  });

  it('Semua › menuju Riwayat', async () => {
    await render(<Beranda />);
    await fireEvent.press(screen.getByRole('button', { name: 'Semua transaksi' }));
    expect(mockNavigate).toHaveBeenCalledWith('/riwayat');
  });

  it('Bulan ini memuat: "…" bukan Rp0', async () => {
    mockBulan = { isLoading: true, error: null, data: undefined };
    await render(<Beranda />);
    expect(screen.getAllByText('…')).toHaveLength(2);
    expect(screen.queryByText('Rp0')).toBeNull();
  });

  it('Bulan ini galat: pesan galat bukan Rp0', async () => {
    mockBulan = { isLoading: false, error: { kind: 'offline', pesan: 'Tidak ada koneksi. Coba lagi.' }, data: undefined };
    await render(<Beranda />);
    expect(screen.getAllByText('Tidak ada koneksi. Coba lagi.').length).toBeGreaterThan(0);
    expect(screen.queryByText('Rp0')).toBeNull();
    expect(screen.queryByText('Belum ada transaksi bulan ini. Tekan tombol mic untuk mencatat yang pertama.')).toBeNull();
  });

  it('bulan kosong: salinan keadaan kosong baru', async () => {
    mockBulan = { isLoading: false, error: null, data: [] };
    await render(<Beranda />);
    expect(screen.getByText('Belum ada transaksi bulan ini. Tekan tombol mic untuk mencatat yang pertama.')).toBeTruthy();
  });

  describe('kartu budget kritis', () => {
    const B = (id: string, kategori: string, batas: number) => ({ id, kategori, batas_bulanan: batas });

    it('menampilkan budget paling kritis', async () => {
      mockBudgets = { data: [B('b1', 'makan', 50000), B('b2', 'transport', 500000)] };
      await render(<Beranda />);
      expect(screen.getByText('Budget paling kritis')).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Makan, Rp25\.000 \/ Rp50\.000/ })).toBeTruthy();
      expect(screen.getByText('Aman, 50% terpakai')).toBeTruthy();
      expect(screen.queryByText('Transport')).toBeNull();
    });

    it('tanpa budget: kartu tidak tampil', async () => {
      await render(<Beranda />);
      expect(screen.queryByText('Budget paling kritis')).toBeNull();
    });

    it('budget memuat: kartu tidak tampil dan Beranda tetap utuh', async () => {
      mockBudgets = { data: undefined };
      await render(<Beranda />);
      expect(screen.queryByText('Budget paling kritis')).toBeNull();
      expect(screen.getByText('Bulan ini')).toBeTruthy();
    });

    it('budget galat: kartu tidak tampil', async () => {
      mockBudgets = { data: undefined, error: { kind: 'offline', pesan: 'x' } };
      await render(<Beranda />);
      expect(screen.queryByText('Budget paling kritis')).toBeNull();
    });
  });
});
