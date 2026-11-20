import { fireEvent, render, screen } from '@testing-library/react-native';
import { buatHutang } from '@/domain/testFactories';
import Beranda from '../../../app/(tabs)/index';

const mockNavigate = jest.fn();

let mockBudgets: { data: unknown[] | undefined; error?: unknown } = { data: [] };
let mockBulan: { isLoading: boolean; error: unknown; data: unknown[] | undefined } | null = null;
let mockHutang: { data?: unknown[]; error?: unknown } = { data: [] };
let mockHanyaHarian = false;
let mockJumlahNotif = 0;
const mockBukaCek = jest.fn();

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
    t: { heroFrom: '#0B424F', heroTo: '#1F6A76', heroFg: '#FFFFFF', warnInk: '#8A5A00', fg2: '#555', mid: '#777' },
  }),
}));
jest.mock('@/notifikasi-dompet/useNotifikasiDompet', () => ({
  useNotifikasiDompet: () => ({ jumlah: mockJumlahNotif, draf: [], bukaUntukCek: mockBukaCek }),
}));
jest.mock('@/data/budgets', () => ({ useBudgets: () => mockBudgets }));
jest.mock('@/data/wallets', () => {
  const { W } = jest.requireActual('@/domain/testFactories');
  return {
    useWallets: () => ({
      data: [
        { ...W('GoPay', 200000), nama: 'GoPay' },
        { ...W('Cash', 88000), nama: 'Cash' },
        ...(mockHanyaHarian ? [] : [{ ...W('Tabungan', 5000000, 'darurat'), nama: 'Tabungan' }]),
      ],
    }),
  };
});
jest.mock('@/data/debts', () => ({
  useDebts: () => mockHutang,
  useRiwayatPokok: () => ({ data: {} }),
}));
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
  mockHutang = { data: [] };
  mockHanyaHarian = false;
  mockJumlahNotif = 0;
  mockBukaCek.mockClear();
  mockNavigate.mockClear();
  mockBudgets = { data: [] };
});

function tambahHari(n: number): string {
  const d = new Date(`${jest.requireActual('@/lib/tanggal').hariIni('Asia/Jakarta')}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

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

  it('kartu notifikasi dompet: tersembunyi bila 0, tampil dan membuka cek bila ada', async () => {
    const { unmount } = await render(<Beranda />);
    expect(screen.queryByText(/siap dicek/)).toBeNull();
    await unmount();
    mockJumlahNotif = 3;
    await render(<Beranda />);
    expect(screen.getByText('3 transaksi dari notifikasi siap dicek')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '3 transaksi dari notifikasi siap dicek' }));
    expect(mockBukaCek).toHaveBeenCalledTimes(1);
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

  describe('kartu hutang', () => {
    const kredivo = () =>
      buatHutang({
        pemberi: 'Kredivo',
        tipe: 'cicilan_tetap',
        pokok_awal: 1200000,
        sisa_pokok: 1100000,
        jumlah_tagihan: 12,
        tagihan_lunas: 1,
        jatuh_tempo_berikutnya: tambahHari(3),
        nominal_berikutnya: 100000,
        jatuh_tempo_terakhir: tambahHari(3 + 30 * 10),
      });

    it('menampilkan kartu, kekayaan bersih dikurangi hutang, dan ketuk menuju Hutang', async () => {
      mockHanyaHarian = true;
      mockHutang = { data: [kredivo()] };
      await render(<Beranda />);
      expect(screen.getByText('Kekayaan bersih -Rp812.000')).toBeTruthy();
      expect(screen.getByText('Kredivo · Rp100.000')).toBeTruthy();
      expect(screen.getByText('3 hari lagi')).toBeTruthy();
      expect(screen.getByText(/^Sisa Rp1\.100\.000 · bebas hutang /)).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Hutang' }));
      expect(mockNavigate).toHaveBeenCalledWith('/hutang');
    });

    it('tanpa hutang: kartu tidak tampil', async () => {
      await render(<Beranda />);
      expect(screen.queryByRole('button', { name: 'Hutang' })).toBeNull();
      expect(screen.getByText('Kekayaan bersih Rp5.288.000')).toBeTruthy();
    });

    it('useDebts galat: Beranda tetap menampilkan sisa uang', async () => {
      mockHutang = { data: undefined, error: { kind: 'offline', pesan: 'Tidak ada koneksi. Coba lagi.' } };
      await render(<Beranda />);
      expect(screen.getByText('Rp288.000')).toBeTruthy();
      expect(screen.getByText('Kekayaan bersih Rp5.288.000')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Hutang' })).toBeNull();
    });

    it('useDebts masih memuat: kekayaan memakai hutang 0', async () => {
      mockHutang = { data: undefined };
      await render(<Beranda />);
      expect(screen.getByText('Kekayaan bersih Rp5.288.000')).toBeTruthy();
    });
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
