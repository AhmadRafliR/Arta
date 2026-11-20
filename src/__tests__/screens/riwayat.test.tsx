import { fireEvent, render, screen } from '@testing-library/react-native';
import Riwayat from '../../../app/(tabs)/riwayat';
import { PESAN_OFFLINE } from '@/data/errors';
import { T } from '@/domain/testFactories';

const mockPush = jest.fn();
const mockUseTx = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' } }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: { accFg: '#000', mid: '#888', acc: '#0f0', fg: '#000' } }),
}));
jest.mock('@/data/wallets', () => {
  const { W } = jest.requireActual('@/domain/testFactories');
  return { useWallets: () => ({ data: [W('cash', 0), W('spay', 0)] }) };
});
jest.mock('@/data/transactions', () => ({
  useTransactions: (b: string) => mockUseTx(b),
}));
jest.mock('@/lib/tanggal', () => ({
  ...jest.requireActual('@/lib/tanggal'),
  hariIni: () => '2026-11-19',
}));

const kat = (t: ReturnType<typeof T>, k: string) => ({ ...t, kategori: k });
const data = [
  kat(T('pemasukan', 100000, 'cash', null, '2026-11-19'), 'Gaji'),
  kat(T('pengeluaran', 30000, 'cash', null, '2026-11-19'), 'Makan'),
  T('transfer', 50000, 'cash', 'spay', '2026-11-18'),
  kat(T('pengeluaran', 8000, 'spay', null, '2026-11-18'), 'Jajan'),
];

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTx.mockReturnValue({ isLoading: false, error: null, data });
});

describe('Riwayat', () => {
  it('pemilih bulan, grup tanggal dengan total harian (transfer dikecualikan)', async () => {
    await render(<Riwayat />);
    expect(screen.getByText('Nov 2026')).toBeTruthy();
    expect(mockUseTx).toHaveBeenCalledWith('2026-11');
    expect(screen.getByText('19 Nov')).toBeTruthy();
    expect(screen.getByText('Rp70.000')).toBeTruthy(); // 100000 - 30000
    expect(screen.getByText('18 Nov')).toBeTruthy();
    expect(screen.getAllByText('-Rp8.000')).toHaveLength(2); // transfer tidak dihitung
  });

  it('geser bulan memakai bulan baru', async () => {
    await render(<Riwayat />);
    await fireEvent.press(screen.getByRole('button', { name: 'Bulan sebelumnya' }));
    expect(screen.getByText('Okt 2026')).toBeTruthy();
    expect(mockUseTx).toHaveBeenLastCalledWith('2026-10');
    await fireEvent.press(screen.getByRole('button', { name: 'Bulan berikutnya' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Bulan berikutnya' }));
    expect(screen.getByText('Des 2026')).toBeTruthy();
  });

  it('filter dompet spay menampilkan transfer cash->spay; filter jenis menyempitkan', async () => {
    await render(<Riwayat />);
    await fireEvent.press(screen.getByTestId('f-dompet-spay'));
    expect(screen.queryByText('Gaji · cash')).toBeNull();
    expect(screen.getByText('cash → spay')).toBeTruthy();
    expect(screen.getByText('Jajan · spay')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('f-jenis-transfer'));
    expect(screen.queryByText('Jajan · spay')).toBeNull();
    await fireEvent.press(screen.getByTestId('f-jenis-transfer')); // lepas
    expect(screen.getByText('Jajan · spay')).toBeTruthy();
  });

  it('filter kategori', async () => {
    await render(<Riwayat />);
    await fireEvent.press(screen.getByTestId('f-kat-Makan'));
    expect(screen.getByText('Makan · cash')).toBeTruthy();
    expect(screen.queryByText('Gaji · cash')).toBeNull();
  });

  it('kategori terpilih direset saat ganti bulan', async () => {
    await render(<Riwayat />);
    await fireEvent.press(screen.getByTestId('f-kat-Makan'));
    expect(screen.queryByText('Gaji · cash')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Bulan sebelumnya' }));
    // bulan baru berisi data yang sama: bila filter lengket, Gaji tetap tersembunyi
    expect(screen.getByText('Gaji · cash')).toBeTruthy();
    expect(screen.getByText('Makan · cash')).toBeTruthy();
  });

  it('ketuk baris membuka /transaksi/[id] dengan bulan', async () => {
    await render(<Riwayat />);
    await fireEvent.press(screen.getByText('Makan · cash'));
    expect(mockPush).toHaveBeenCalledWith(`/transaksi/${data[1].id}?bulan=2026-11`);
  });

  it('kosong, memuat, galat', async () => {
    mockUseTx.mockReturnValue({ isLoading: false, error: null, data: [] });
    const r = await render(<Riwayat />);
    expect(screen.getByText('Belum ada transaksi.')).toBeTruthy();
    mockUseTx.mockReturnValue({ isLoading: true, error: null, data: undefined });
    await r.rerender(<Riwayat />);
    expect(screen.getByText('Memuat…')).toBeTruthy();
    mockUseTx.mockReturnValue({ isLoading: false, error: { kind: 'offline', pesan: PESAN_OFFLINE }, data: undefined });
    await r.rerender(<Riwayat />);
    expect(screen.getByText(PESAN_OFFLINE)).toBeTruthy();
    expect(screen.queryByText('Rp0')).toBeNull();
    expect(screen.queryByText('Belum ada transaksi.')).toBeNull();
  });
});
