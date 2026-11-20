import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Catat from '../../../app/catat';
import { PESAN_OFFLINE } from '@/data/errors';

const mockSave = jest.fn();
const mockUpdate = jest.fn();
const mockBack = jest.fn();
let mockId = 0;
const mockNewTxId = jest.fn(() => `id-${++mockId}`);

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: jest.fn() }),
}));
jest.mock('@/data/transactions', () => ({
  useSaveTransactions: () => ({ mutateAsync: mockSave }),
  useTransactions: () => ({ data: [] }),
  useUpdateTransaction: () => ({ mutateAsync: mockUpdate }),
  newTxId: () => mockNewTxId(),
}));
jest.mock('@/data/budgets', () => ({ useBudgets: () => ({ data: [] }) }));
jest.mock('@/data/wallets', () => ({
  useWallets: () => ({
    data: [
      { id: 'w1', nama: 'GoPay', tipe: 'harian', saldo_awal: 0, tanggal_saldo_awal: '2026-11-01', target: null, diarsip: false },
      { id: 'w2', nama: 'Cash', tipe: 'harian', saldo_awal: 0, tanggal_saldo_awal: '2026-11-01', target: null, diarsip: false },
      { id: 'w3', nama: 'Lama', tipe: 'harian', saldo_awal: 0, tanggal_saldo_awal: '2026-11-01', target: null, diarsip: true },
    ],
  }),
}));
jest.mock('@/data/categories', () => ({
  useCategories: (jenis: string) => ({
    data: [{ id: 'c1', jenis, nama: jenis === 'pengeluaran' ? 'Makan' : 'Gaji' }],
  }),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' } }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: { accFg: '#000', mid: '#888', acc: '#0f0', fg: '#000' } }),
}));

const simpan = () => screen.getByRole('button', { name: 'Simpan' });

beforeEach(() => {
  jest.clearAllMocks();
  mockId = 0;
  mockSave.mockImplementation(async (items: unknown[]) => items); // sukses normal: id ada di hasil
  mockUpdate.mockResolvedValue({});
});

describe('Catat manual', () => {
  it('gagal offline: pesan tampil, nominal utuh, percobaan kedua memakai id yang sama', async () => {
    mockSave.mockRejectedValueOnce({ kind: 'offline', pesan: PESAN_OFFLINE });
    mockSave.mockResolvedValueOnce([]); // retry setelah respons hilang: [] tetap sukses
    await render(<Catat />);
    await fireEvent.changeText(screen.getByTestId('nominal'), '15000');
    await fireEvent.press(screen.getByTestId('kat-Makan'));
    await fireEvent.press(simpan());
    expect(await screen.findByText(PESAN_OFFLINE)).toBeTruthy();
    expect(screen.getByDisplayValue('15000')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();

    await fireEvent.press(simpan());
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockSave).toHaveBeenCalledTimes(2);
    const [a] = mockSave.mock.calls[0][0];
    const [b] = mockSave.mock.calls[1][0];
    expect(a.id).toBe('id-1');
    expect(b.id).toBe('id-1');
    expect(mockNewTxId).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1); // [] = sudah ada: ikuti dengan update ke nilai form
    expect(a).toMatchObject({
      jenis: 'pengeluaran',
      kategori: 'Makan',
      nominal: 15000,
      wallet_id: 'w1',
      sumber: 'manual',
    });
  });

  it('simpan sukses normal: tanpa update lanjutan', async () => {
    await render(<Catat />);
    await fireEvent.changeText(screen.getByTestId('nominal'), '15000');
    await fireEvent.press(screen.getByTestId('kat-Makan'));
    await fireEvent.press(simpan());
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('gagal lalu nominal diubah, retry mengembalikan [] -> update ke nominal baru', async () => {
    mockSave.mockRejectedValueOnce({ kind: 'offline', pesan: PESAN_OFFLINE });
    mockSave.mockResolvedValueOnce([]); // id sudah ada di server dengan nominal lama
    await render(<Catat />);
    await fireEvent.changeText(screen.getByTestId('nominal'), '15000');
    await fireEvent.press(screen.getByTestId('kat-Makan'));
    await fireEvent.press(simpan());
    expect(await screen.findByText(PESAN_OFFLINE)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('nominal'), '20000');
    await fireEvent.press(simpan());
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({
      id: 'id-1',
      patch: expect.objectContaining({ nominal: 20000, jenis: 'pengeluaran', kategori: 'Makan', wallet_id: 'w1' }),
    });
  });

  it('update lanjutan gagal: pesan tampil, tidak menutup', async () => {
    mockSave.mockResolvedValueOnce([]);
    mockUpdate.mockRejectedValueOnce({ kind: 'offline', pesan: 'Tidak ada koneksi. Coba lagi.' });
    await render(<Catat />);
    await fireEvent.changeText(screen.getByTestId('nominal'), '15000');
    await fireEvent.press(screen.getByTestId('kat-Makan'));
    await fireEvent.press(simpan());
    expect(await screen.findByText('Tidak ada koneksi. Coba lagi.')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('Simpan nonaktif tanpa nominal', async () => {
    await render(<Catat />);
    expect(simpan().props.accessibilityState?.disabled).toBe(true);
  });

  it('transfer: tujuan tidak memuat dompet asal, tanpa kategori', async () => {
    await render(<Catat />);
    await fireEvent.press(screen.getByTestId('jenis-transfer'));
    expect(screen.queryByTestId('kat-Makan')).toBeNull();
    expect(screen.getByTestId('dst-w2')).toBeTruthy();
    expect(screen.queryByTestId('dst-w1')).toBeNull(); // asal = w1
    expect(screen.queryByTestId('src-w3')).toBeNull(); // diarsip
    await fireEvent.changeText(screen.getByTestId('nominal'), '50rb');
    await fireEvent.press(screen.getByTestId('dst-w2'));
    await fireEvent.press(simpan());
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockSave.mock.calls[0][0][0]).toMatchObject({
      jenis: 'transfer',
      kategori: null,
      nominal: 50000,
      wallet_id: 'w1',
      wallet_tujuan_id: 'w2',
    });
  });

  it('tanggal tidak valid -> Simpan nonaktif', async () => {
    await render(<Catat />);
    await fireEvent.changeText(screen.getByTestId('nominal'), '1000');
    await fireEvent.press(screen.getByTestId('kat-Makan'));
    expect(simpan().props.accessibilityState?.disabled).toBe(false);
    await fireEvent.changeText(screen.getByTestId('tanggal'), '2026-02-30');
    expect(simpan().props.accessibilityState?.disabled).toBe(true);
  });
});
