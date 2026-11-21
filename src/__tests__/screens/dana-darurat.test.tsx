import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import DanaDarurat from '../../../app/dana-darurat';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();
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
  useCreateWallet: () => ({ mutateAsync: mockCreate }),
}));
jest.mock('@/data/transactions', () => ({
  useAllTransactions: () => ({ data: mockTxs }),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' } }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'terang',
    t: {
      acc: '#0f0',
      accInk: '#070',
      accFg: '#000',
      dangerInk: '#a00',
      mid: '#888',
      fg: '#000',
      fg2: '#333',
      heroFrom: '#0B424F',
      heroTo: '#1F6A76',
      heroFg: '#fff',
      heroSub: '#ddd',
    },
  }),
}));

const btn = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue({});
  mockCreate.mockResolvedValue({ id: 'dbaru' });
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
    expect(screen.getByText('Target Rp10.000.000')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('2,5 bln')).toBeTruthy();
  });

  it('hero: sisa ke target dan setoran per bulan (sisa / 12)', async () => {
    await render(<DanaDarurat />);
    expect(screen.getAllByText('Rp5.000.000').length).toBeGreaterThan(0);
    expect(screen.getByText('Rp416.667')).toBeTruthy();
  });

  it('saran target: 3× dan 6× rata-rata; Pakai 6× menyimpan target', async () => {
    await render(<DanaDarurat />);
    expect(screen.getByText('Rp6.000.000')).toBeTruthy();
    expect(screen.getByText('s.d. Rp12.000.000')).toBeTruthy();
    await fireEvent.press(btn('Pakai 6×'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ id: 'd1', patch: { target: 12_000_000 } }));
  });

  it('mutasi: setoran dari dompet lain tampil per bulan dan membuka transaksinya', async () => {
    mockTxs = [
      ...mockTxs,
      {
        id: 'm1',
        tanggal: '2026-11-03',
        jenis: 'transfer',
        kategori: null,
        nominal: 500_000,
        wallet_id: 'h1',
        wallet_tujuan_id: 'd1',
        debt_id: null,
        porsi_bunga: null,
        porsi_pokok: null,
        catatan: null,
        transkrip: null,
        sumber: 'manual',
      },
    ];
    await render(<DanaDarurat />);
    expect(screen.getByText('NOV 2026')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Setoran · GoPay, \+Rp500\.000/ }));
    expect(mockPush).toHaveBeenCalledWith('/transaksi/m1');
  });

  it('tanpa mutasi: pesan kosong', async () => {
    await render(<DanaDarurat />);
    expect(screen.getByText(/Belum ada setoran atau penarikan/)).toBeTruthy();
  });

  it('tanpa data pengeluaran: bulan aman dan saran tidak tampil', async () => {
    mockTxs = [];
    await render(<DanaDarurat />);
    expect(screen.queryByText(/Pakai 3×/)).toBeNull();
    expect(screen.queryByText(/ bln$/)).toBeNull();
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
    await waitFor(() => expect(screen.queryByTestId('sheet-target')).toBeNull());
    await fireEvent.press(btn('Ubah target'));
    await fireEvent.changeText(screen.getByTestId('target-baru'), '0');
    await fireEvent.press(btn('Simpan target'));
    await waitFor(() => expect(mockUpdate).toHaveBeenLastCalledWith({ id: 'd1', patch: { target: null } }));
  });

  it('kosong: keadaan kosong dan sheet Buat dana darurat membuat dompet darurat', async () => {
    mockWallets = [W('h1', 'GoPay')];
    await render(<DanaDarurat />);
    expect(screen.getByText('Belum ada dana darurat')).toBeTruthy();
    await fireEvent.press(btn('Buat dana darurat'));
    expect(screen.getByTestId('sheet-buat-darurat')).toBeTruthy();
    // Target terisi 3× rata-rata pengeluaran (2 jt).
    expect(screen.getByDisplayValue('6.000.000')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('buat-saldo'), '7000000');
    await fireEvent.press(btn('Buat'));
    expect(screen.getByText('Saldo awal tidak boleh melebihi target.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('buat-saldo'), '500000');
    await fireEvent.press(btn('Buat'));
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        nama: 'Dana darurat',
        tipe: 'darurat',
        saldo_awal: 500_000,
        tanggal_saldo_awal: '2026-11-20',
        target: 6_000_000,
      }),
    );
  });

  it('Kembali memanggil router.back', async () => {
    await render(<DanaDarurat />);
    await fireEvent.press(btn('Kembali'));
    expect(mockBack).toHaveBeenCalled();
  });
});
