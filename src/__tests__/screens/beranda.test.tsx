import { fireEvent, render, screen } from '@testing-library/react-native';
import Beranda from '../../../app/(tabs)/index';

const mockNavigate = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate, push: jest.fn() }) }));
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
    useTransactions: () => ({
      isLoading: false,
      data: [
        { ...T('pemasukan', 1500000, 'GoPay', null, `${bln}-05`), kategori: 'Gaji' },
        { ...T('pengeluaran', 25000, 'Cash', null, `${bln}-04`), kategori: 'Makan' },
      ],
    }),
  };
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
    expect(screen.getByText('Gaji · GoPay')).toBeTruthy();
    expect(screen.getByText('+1,5jt')).toBeTruthy();
    expect(screen.getByText('-25rb')).toBeTruthy();
  });

  it('Semua › menuju Riwayat', async () => {
    await render(<Beranda />);
    await fireEvent.press(screen.getByRole('button', { name: 'Semua transaksi' }));
    expect(mockNavigate).toHaveBeenCalledWith('/riwayat');
  });
});
