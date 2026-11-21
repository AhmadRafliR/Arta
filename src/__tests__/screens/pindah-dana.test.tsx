import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import PindahDana from '../../../app/pindah-dana';

const mockBack = jest.fn();
const mockSave = jest.fn();
let mockParams: Record<string, string>;
let mockWallets: unknown[];

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

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/data/wallets', () => ({
  useWallets: () => ({ data: mockWallets }),
  useSaldoDompet: () => ({
    data: Object.fromEntries((mockWallets as { id: string; saldo_awal: number }[]).map((w) => [w.id, w.saldo_awal])),
  }),
}));
jest.mock('@/data/transactions', () => ({
  useAllTransactions: () => ({ data: [] }),
  useSaveTransactions: () => ({ mutateAsync: mockSave }),
  newTxId: jest.fn(() => 'tx-fixed'),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' } }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ t: { acc: '#0f0', accFg: '#000', mid: '#888', fg: '#000' } }),
}));

const btn = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { ke: 'd1', mode: 'setor' };
  mockWallets = [
    W('h1', 'GoPay', { saldo_awal: 900_000 }),
    W('h2', 'BCA', { saldo_awal: 100_000 }),
    W('h3', 'Lama', { diarsip: true }),
    W('d1', 'Dana Darurat', { tipe: 'darurat' }),
  ];
  mockSave.mockImplementation(async (items: unknown[]) => items);
});

describe('Pindah dana', () => {
  it('setor: transfer harian ke darurat dengan judul dan catatan bawaan', async () => {
    await render(<PindahDana />);
    expect(screen.getByText('Setor dana darurat')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lama' })).toBeNull();
    expect(screen.getByText('Saldo GoPay: Rp900.000')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('nominal'), '250000');
    await fireEvent.press(btn('Simpan'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    const [item] = mockSave.mock.calls[0][0];
    expect(item).toMatchObject({
      id: 'tx-fixed',
      jenis: 'transfer',
      kategori: 'transfer',
      nominal: 250_000,
      wallet_id: 'h1',
      wallet_tujuan_id: 'd1',
      catatan: 'Setor dana darurat Dana Darurat',
      transkrip: null,
      sumber: 'manual',
    });
    expect(item.tanggal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('tarik: transfer darurat ke dompet harian pilihan', async () => {
    mockParams = { dari: 'd1', mode: 'tarik' };
    await render(<PindahDana />);
    expect(screen.getByText('Tarik dana darurat')).toBeTruthy();
    await fireEvent.press(btn('BCA'));
    await fireEvent.changeText(screen.getByTestId('nominal'), '50000');
    await fireEvent.press(btn('Simpan'));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls[0][0][0]).toMatchObject({ wallet_id: 'd1', wallet_tujuan_id: 'h2', nominal: 50_000 });
  });

  it('judul beli', async () => {
    mockWallets = [...mockWallets, W('i1', 'Emas', { tipe: 'investasi' })];
    mockParams = { ke: 'i1', mode: 'beli' };
    await render(<PindahDana />);
    expect(screen.getByText('Beli investasi')).toBeTruthy();
  });

  it('judul jual: dari investasi ke harian', async () => {
    mockWallets = [...mockWallets, W('i1', 'Emas', { tipe: 'investasi' })];
    mockParams = { dari: 'i1', mode: 'jual' };
    await render(<PindahDana />);
    expect(screen.getByText('Jual investasi')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('nominal'), '1000');
    await fireEvent.press(btn('Simpan'));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.calls[0][0][0]).toMatchObject({ wallet_id: 'i1', wallet_tujuan_id: 'h1' });
  });

  it('Simpan nonaktif sampai nominal valid', async () => {
    await render(<PindahDana />);
    expect(btn('Simpan').props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('nominal'), 'abc');
    expect(btn('Simpan').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(btn('Simpan'));
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('tekan Simpan dua kali: satu panggilan', async () => {
    let selesai: (v: unknown[]) => void = () => {};
    mockSave.mockImplementation(() => new Promise((r) => (selesai = r)));
    await render(<PindahDana />);
    await fireEvent.changeText(screen.getByTestId('nominal'), '1000');
    await fireEvent.press(btn('Simpan'));
    await fireEvent.press(btn('Simpan'));
    expect(mockSave).toHaveBeenCalledTimes(1);
    selesai([]);
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('gagal lalu coba ulang memakai id yang sama', async () => {
    mockSave.mockRejectedValueOnce({ kind: 'offline', pesan: 'Tidak ada koneksi. Coba lagi.' });
    await render(<PindahDana />);
    await fireEvent.changeText(screen.getByTestId('nominal'), '1000');
    await fireEvent.press(btn('Simpan'));
    expect(await screen.findByText('Tidak ada koneksi. Coba lagi.')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    await fireEvent.press(btn('Simpan'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(2));
    expect(mockSave.mock.calls[0][0][0].id).toBe('tx-fixed');
    expect(mockSave.mock.calls[1][0][0].id).toBe('tx-fixed');
  });
});
