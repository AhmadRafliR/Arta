import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Detail from '../../../app/dompet/[id]';
import Baru from '../../../app/dompet/baru';
import Akun from '../../../app/(tabs)/akun';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockUpdate = jest.fn();
const mockCreate = jest.fn();
const mockSave = jest.fn();
const mockUpdateTx = jest.fn();
const mockSetPref = jest.fn();
const mockSignOut = jest.fn();
let mockId = 'w1';
let mockTxs: unknown[];

const W = (id: string, nama: string, over: object = {}) => ({
  id,
  nama,
  tipe: 'harian',
  saldo_awal: 0,
  tanggal_saldo_awal: '2026-11-01',
  target: null,
  diarsip: false,
  ...over,
});
const mockWallets = [
  W('w1', 'GoPay', { saldo_awal: 5000 }),
  W('w2', 'Kosong'),
  W('w3', 'Dana Darurat', { tipe: 'darurat' }),
  W('w4', 'Lama', { diarsip: true }),
];

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, canGoBack: () => true, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockId }),
  useFocusEffect: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/data/wallets', () => ({
  useWallets: () => ({ data: mockWallets }),
  useUpdateWallet: () => ({ mutateAsync: mockUpdate }),
  useCreateWallet: () => ({ mutateAsync: mockCreate }),
}));
jest.mock('@/data/transactions', () => ({
  useAllTransactions: () => ({ data: mockTxs }),
  useSaveTransactions: () => ({ mutateAsync: mockSave }),
  useUpdateTransaction: () => ({ mutateAsync: mockUpdateTx }),
  newTxId: jest.fn(() => 'tx-fixed'),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' }, signOut: mockSignOut }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'sistem', setPref: mockSetPref, t: { accFg: '#000', mid: '#888', acc: '#0f0', fg: '#000' } }),
}));

const btn = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  jest.clearAllMocks();
  mockId = 'w1';
  mockTxs = [];
  mockUpdate.mockResolvedValue({});
  mockCreate.mockResolvedValue({});
  mockSave.mockImplementation(async (items: unknown[]) => items);
  mockUpdateTx.mockResolvedValue({});
});

describe('Detail dompet', () => {
  it('arsip dompet bersaldo: pesan, tidak memanggil update', async () => {
    await render(<Detail />);
    await fireEvent.press(btn('Arsipkan'));
    expect(await screen.findByText('Pindahkan dulu saldonya ke dompet lain')).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('arsip dompet saldo 0: update diarsip=true', async () => {
    mockId = 'w2';
    await render(<Detail />);
    await fireEvent.press(btn('Arsipkan'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ id: 'w2', patch: { diarsip: true } }));
  });

  it('sesuaikan saldo: simpan penyesuaian bertanda dengan id tetap', async () => {
    await render(<Detail />);
    await fireEvent.changeText(screen.getByTestId('saldo-baru'), '3000');
    await fireEvent.press(btn('Simpan penyesuaian'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    const [item] = mockSave.mock.calls[0][0];
    expect(item).toMatchObject({
      id: 'tx-fixed',
      jenis: 'penyesuaian',
      kategori: 'penyesuaian',
      nominal: -2000,
      wallet_id: 'w1',
      wallet_tujuan_id: null,
      catatan: 'Penyesuaian saldo',
      sumber: 'manual',
    });
    expect(item.tanggal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('saldo sama: "Saldo sudah sama", tanpa simpan', async () => {
    await render(<Detail />);
    await fireEvent.changeText(screen.getByTestId('saldo-baru'), '5000');
    await fireEvent.press(btn('Simpan penyesuaian'));
    expect(await screen.findByText('Saldo sudah sama')).toBeTruthy();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('saldo sebenarnya 0 diizinkan', async () => {
    await render(<Detail />);
    await fireEvent.changeText(screen.getByTestId('saldo-baru'), '0');
    await fireEvent.press(btn('Simpan penyesuaian'));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls[0][0][0].nominal).toBe(-5000);
  });

  it('nama kembar: "Nama dompet sudah dipakai"', async () => {
    mockUpdate.mockRejectedValue({ kind: 'lain', pesan: 'Terjadi kesalahan. Coba lagi.', code: '23505' });
    await render(<Detail />);
    await fireEvent.changeText(screen.getByLabelText('Nama dompet'), 'Cash');
    await fireEvent.press(btn('Simpan nama'));
    expect(await screen.findByText('Nama dompet sudah dipakai')).toBeTruthy();
  });
});

describe('Detail dompet: coba ulang setelah respons hilang', () => {
  it('gagal, nominal diubah, retry [] -> update penyesuaian ke nominal baru', async () => {
    mockSave.mockRejectedValueOnce({ kind: 'offline', pesan: 'Tidak ada koneksi. Coba lagi.' });
    mockSave.mockResolvedValueOnce([]);
    await render(<Detail />);
    await fireEvent.changeText(screen.getByTestId('saldo-baru'), '3000');
    await fireEvent.press(btn('Simpan penyesuaian'));
    expect(await screen.findByText('Tidak ada koneksi. Coba lagi.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('saldo-baru'), '1000');
    await fireEvent.press(btn('Simpan penyesuaian'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockSave.mock.calls[1][0][0].id).toBe('tx-fixed');
    expect(mockUpdateTx).toHaveBeenCalledWith({
      id: 'tx-fixed',
      patch: expect.objectContaining({ nominal: -4000, jenis: 'penyesuaian', wallet_id: 'w1' }),
    });
  });

  it('23505 di luar ganti nama tidak jadi "nama kembar"', async () => {
    mockId = 'w2';
    mockUpdate.mockRejectedValue({ kind: 'lain', pesan: 'Terjadi kesalahan. Coba lagi.', code: '23505' });
    await render(<Detail />);
    await fireEvent.press(btn('Arsipkan'));
    expect(await screen.findByText('Terjadi kesalahan. Coba lagi.')).toBeTruthy();
  });
});

describe('Dompet baru', () => {
  it('simpan dompet darurat dengan target', async () => {
    await render(<Baru />);
    await fireEvent.changeText(screen.getByLabelText('Nama dompet'), 'Darurat 2');
    await fireEvent.press(btn('Darurat'));
    await fireEvent.changeText(screen.getByTestId('saldo-awal'), '1000');
    await fireEvent.changeText(screen.getByTestId('target'), '9000');
    await fireEvent.press(btn('Simpan'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ nama: 'Darurat 2', tipe: 'darurat', saldo_awal: 1000, target: 9000 });
  });

  it('target hanya untuk darurat', async () => {
    await render(<Baru />);
    expect(screen.queryByTestId('target')).toBeNull();
    await fireEvent.press(btn('Darurat'));
    expect(screen.getByTestId('target')).toBeTruthy();
  });
});

describe('Akun', () => {
  it('daftar per tipe, arsip tersembunyi sampai dibuka', async () => {
    await render(<Akun />);
    expect(screen.getByText('GoPay')).toBeTruthy();
    expect(screen.getByText('Dana Darurat')).toBeTruthy();
    expect(screen.queryByText('Lama')).toBeNull();
    await fireEvent.press(btn('Diarsipkan'));
    expect(screen.getByText('Lama')).toBeTruthy();
  });

  it('tema dan keluar', async () => {
    await render(<Akun />);
    await fireEvent.press(btn('Gelap'));
    expect(mockSetPref).toHaveBeenCalledWith('gelap');
    await fireEvent.press(btn('Keluar'));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('tambah dompet membuka /dompet/baru', async () => {
    await render(<Akun />);
    await fireEvent.press(btn('Tambah dompet'));
    expect(mockPush).toHaveBeenCalledWith('/dompet/baru');
  });
});
