import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Investasi from '../../../app/investasi/index';
import Nilai from '../../../app/investasi/nilai';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockSave = jest.fn();
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
const TF = {
  id: 'tf1',
  tanggal: '2026-10-01',
  jenis: 'transfer',
  kategori: 'transfer',
  nominal: 260_000,
  wallet_id: 'h1',
  wallet_tujuan_id: 'i1',
  debt_id: null,
  porsi_bunga: null,
  porsi_pokok: null,
  catatan: null,
  transkrip: null,
  sumber: 'manual',
};
const ADJ = (nominal: number) => ({
  ...TF,
  id: 'adj',
  jenis: 'penyesuaian',
  nominal,
  wallet_id: 'i1',
  wallet_tujuan_id: null,
});

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, canGoBack: () => true, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'i1' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/data/wallets', () => ({
  useWallets: () => ({ data: mockWallets }),
}));
jest.mock('@/data/transactions', () => ({
  useAllTransactions: () => ({ data: mockTxs }),
  useSaveTransactions: () => ({ mutateAsync: mockSave }),
  newTxId: jest.fn(() => 'tx-fixed'),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' } }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    t: {
      acc: '#0f0',
      accInk: '#070',
      accFg: '#000',
      dangerInk: '#a00',
      mid: '#888',
      fg: '#000',
      fg2: '#333',
      heroFrom: '#014',
      heroTo: '#027',
      heroFg: '#fff',
      amSub: '#ddd',
      amLine: '#999',
      plUpBg: '#cff',
      plUpFg: '#014',
      plDownBg: '#fee',
      plDownFg: '#a00',
      c1: '#070',
      c2: '#0a0',
      c3: '#0c0',
      c4: '#cb7',
    },
  }),
}));

const btn = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockImplementation(async (items: unknown[]) => items);
  mockWallets = [W('h1', 'GoPay', { saldo_awal: 1_000_000 }), W('i1', 'Reksa Dana', { tipe: 'investasi' })];
  mockTxs = [TF];
});

describe('Investasi', () => {
  it('menampilkan nilai, modal, dan untung bertanda', async () => {
    mockTxs = [TF, ADJ(30_000)]; // modal 260.000, nilai 290.000
    await render(<Investasi />);
    expect(screen.getAllByText('Rp290.000').length).toBeGreaterThan(0);
    expect(screen.getByText('Modal Rp260.000')).toBeTruthy();
    expect(screen.getAllByText('+Rp30.000 · +11,5%').length).toBeGreaterThan(0);
    expect(screen.getByText('1 aset')).toBeTruthy();
    // Update terakhir = tanggal penyesuaian terakhir.
    expect(screen.getByText('1 Okt 2026')).toBeTruthy();
    expect(screen.getByTestId('alokasi-aset')).toBeTruthy();
  });

  it('rugi memakai tanda minus', async () => {
    mockTxs = [TF, ADJ(-10_000)];
    await render(<Investasi />);
    expect(screen.getAllByText('-Rp10.000 · -3,8%').length).toBeGreaterThan(0);
  });

  it('kartu membuka rincian; tombol Beli, Jual, Update nilai, Ubah, Tambah aset', async () => {
    await render(<Investasi />);
    const buka = () => fireEvent.press(btn('Rincian Reksa Dana'));
    await buka();
    expect(screen.getByTestId('sheet-aset')).toBeTruthy();
    expect(screen.getByText('Untung / rugi')).toBeTruthy();
    await fireEvent.press(btn('Beli'));
    expect(mockPush).toHaveBeenLastCalledWith('/pindah-dana?ke=i1&mode=beli');
    await buka();
    await fireEvent.press(btn('Jual'));
    expect(mockPush).toHaveBeenLastCalledWith('/pindah-dana?dari=i1&mode=jual');
    await buka();
    await fireEvent.press(btn('Update nilai'));
    expect(mockPush).toHaveBeenLastCalledWith('/investasi/nilai?id=i1');
    await buka();
    await fireEvent.press(btn('Ubah'));
    expect(mockPush).toHaveBeenLastCalledWith('/dompet/i1');
    await fireEvent.press(btn('Tambah aset'));
    expect(mockPush).toHaveBeenLastCalledWith('/dompet/baru?tipe=investasi');
  });

  it('tombol Kembali menutup layar', async () => {
    await render(<Investasi />);
    await fireEvent.press(btn('Kembali'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('kosong: pesan dan tombol tambah aset', async () => {
    mockWallets = [W('h1', 'GoPay')];
    await render(<Investasi />);
    expect(screen.getByText('Belum ada investasi')).toBeTruthy();
    expect(
      screen.getByText('Tambahkan aset seperti reksa dana, saham, atau emas supaya nilainya terpantau.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('alokasi-aset')).toBeNull();
    await fireEvent.press(btn('Tambah aset'));
    expect(mockPush).toHaveBeenCalledWith('/dompet/baru?tipe=investasi');
  });
});

describe('Update nilai investasi', () => {
  it('mengirim penyesuaian +150.000 dan menampilkan pratinjau untung', async () => {
    // nilai sekarang 260.000 (hanya transfer), nilai baru 410.000
    await render(<Nilai />);
    await fireEvent.changeText(screen.getByTestId('nilai-baru'), '410000');
    expect(screen.getByText('Untung jadi +Rp150.000')).toBeTruthy();
    expect(screen.getByText('+Rp150.000')).toBeTruthy(); // selisih
    expect(screen.getByText('+57,7%')).toBeTruthy(); // perubahan dari 260.000
    await fireEvent.press(btn('Simpan'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(mockSave.mock.calls[0][0][0]).toMatchObject({
      id: 'tx-fixed',
      jenis: 'penyesuaian',
      kategori: 'penyesuaian',
      nominal: 150_000,
      wallet_id: 'i1',
      wallet_tujuan_id: null,
      catatan: 'Update nilai investasi',
      sumber: 'manual',
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('nilai sama: tombol "Nilainya sama" nonaktif', async () => {
    await render(<Nilai />);
    await fireEvent.changeText(screen.getByTestId('nilai-baru'), '260000');
    const b = btn('Nilainya sama');
    expect(b.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(b);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('nilai baru 0 diizinkan', async () => {
    await render(<Nilai />);
    await fireEvent.changeText(screen.getByTestId('nilai-baru'), '0');
    await fireEvent.press(btn('Simpan'));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls[0][0][0].nominal).toBe(-260_000);
  });
});
