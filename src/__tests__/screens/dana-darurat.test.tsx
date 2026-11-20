import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import DanaDarurat from '../../../app/dana-darurat';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockUpdate = jest.fn();
let mockWallets: unknown[];
let mockTxs: unknown[];

const W = (id: string, nama: string, over: object = {}) => ({
  id,
  nama,
  tipe: 'harian',
  saldo_awal: 0,
  tanggal_saldo_awal: '2026-01-01',
  target: null,
  diarsip: false,
  ...over,
});
const P = (id: string, tanggal: string, nominal: number) => ({
  id,
  tanggal,
  jenis: 'pengeluaran',
  kategori: 'makan',
  nominal,
  wallet_id: 'h1',
  wallet_tujuan_id: null,
  debt_id: null,
  porsi_bunga: null,
  porsi_pokok: null,
  catatan: null,
  transkrip: null,
  sumber: 'manual',
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, canGoBack: () => true, replace: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/tanggal', () => ({
  ...jest.requireActual('@/lib/tanggal'),
  hariIni: () => '2026-11-20',
}));
jest.mock('@/data/wallets', () => ({
  useWallets: () => ({ data: mockWallets }),
  useUpdateWallet: () => ({ mutateAsync: mockUpdate }),
}));
jest.mock('@/data/transactions', () => ({
  useAllTransactions: () => ({ data: mockTxs }),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' } }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ t: { acc: '#0f0', accInk: '#070', dangerInk: '#a00', mid: '#888', fg: '#000' } }),
}));

const btn = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue({});
  mockWallets = [
    W('h1', 'GoPay'),
    W('d1', 'Dana Darurat', { tipe: 'darurat', saldo_awal: 5_000_000, target: 10_000_000 }),
  ];
  mockTxs = [P('a', '2026-10-05', 2_000_000), P('b', '2026-09-05', 2_000_000), P('c', '2026-08-05', 2_000_000)];
});

describe('Dana darurat', () => {
  it('menampilkan total, target, persen, dan cakupan bulan', async () => {
    await render(<DanaDarurat />);
    expect(screen.getAllByText('Rp5.000.000').length).toBeGreaterThan(0);
    expect(screen.getByText('dari target Rp10.000.000')).toBeTruthy();
    expect(screen.getAllByText(/50%/).length).toBeGreaterThan(0);
    expect(screen.getByText('Cukup untuk 2,5 bulan pengeluaran')).toBeTruthy();
  });

  it('tanpa data pengeluaran: cakupan tidak tampil', async () => {
    mockTxs = [];
    await render(<DanaDarurat />);
    expect(screen.queryByText(/Cukup untuk/)).toBeNull();
  });

  it('Setor dan Tarik membuka pindah-dana dengan param benar', async () => {
    await render(<DanaDarurat />);
    await fireEvent.press(btn('Setor'));
    expect(mockPush).toHaveBeenCalledWith('/pindah-dana?ke=d1&mode=setor');
    await fireEvent.press(btn('Tarik'));
    expect(mockPush).toHaveBeenCalledWith('/pindah-dana?dari=d1&mode=tarik');
  });

  it('ubah target memanggil useUpdateWallet; 0 menghapus target', async () => {
    await render(<DanaDarurat />);
    await fireEvent.press(btn('Ubah target'));
    await fireEvent.changeText(screen.getByTestId('target-baru'), '12000000');
    await fireEvent.press(btn('Simpan target'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ id: 'd1', patch: { target: 12_000_000 } }));
    await fireEvent.press(btn('Ubah target'));
    await fireEvent.changeText(screen.getByTestId('target-baru'), '0');
    await fireEvent.press(btn('Simpan target'));
    await waitFor(() => expect(mockUpdate).toHaveBeenLastCalledWith({ id: 'd1', patch: { target: null } }));
  });

  it('kosong: pesan dan tombol buat dana darurat', async () => {
    mockWallets = [W('h1', 'GoPay')];
    await render(<DanaDarurat />);
    expect(screen.getByText('Belum ada dana darurat. Sisihkan sedikit tiap bulan untuk jaga-jaga.')).toBeTruthy();
    await fireEvent.press(btn('Buat dana darurat'));
    expect(mockPush).toHaveBeenCalledWith('/dompet/baru?tipe=darurat');
  });

  it('Kembali memanggil router.back', async () => {
    await render(<DanaDarurat />);
    await fireEvent.press(btn('Kembali'));
    expect(mockBack).toHaveBeenCalled();
  });
});
