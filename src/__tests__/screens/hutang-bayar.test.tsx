import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import HutangBayar from '../../../app/hutang/bayar';
import { buatHutang, T } from '@/domain/testFactories';
import type { Hutang, Tx } from '@/domain/types';

const mockSave = jest.fn();
const mockBack = jest.fn();
let mockHutang: Hutang;
let mockTxs: Tx[];
let mockId = 0;
const mockNewTxId = jest.fn(() => `id-${++mockId}`);

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'h1' }),
}));
jest.mock('@/data/transactions', () => ({
  useSaveTransactions: () => ({ mutateAsync: mockSave }),
  useDebtTransactions: () => ({ data: mockTxs }),
  newTxId: () => mockNewTxId(),
}));
jest.mock('@/data/debts', () => ({
  useDebt: () => ({ data: mockHutang, isLoading: false, error: null }),
}));
jest.mock('@/data/wallets', () => ({
  useWallets: () => ({
    data: [
      { id: 'w1', nama: 'GoPay', tipe: 'harian', saldo_awal: 0, tanggal_saldo_awal: '2026-11-01', target: null, diarsip: false },
      { id: 'w3', nama: 'Lama', tipe: 'harian', saldo_awal: 0, tanggal_saldo_awal: '2026-11-01', target: null, diarsip: true },
    ],
  }),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' } }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: { accFg: '#000', mid: '#888', acc: '#0f0', fg: '#000' } }),
}));

const simpan = () => screen.getByRole('button', { name: 'Simpan' });
const nonaktif = () => simpan().props.accessibilityState?.disabled === true;
const porsi = () => [screen.getByTestId('porsi-bunga').props.children, screen.getByTestId('porsi-pokok').props.children];

beforeEach(() => {
  jest.clearAllMocks();
  mockId = 0;
  mockTxs = [];
  mockHutang = buatHutang();
  mockSave.mockImplementation(async (items: unknown[]) => items);
});

describe('Bayar hutang', () => {
  it('cicilan: nominal bawaan dari tagihan berikutnya', async () => {
    mockHutang = buatHutang({
      tipe: 'cicilan_tetap',
      nominal_cicilan: 100000,
      tenor_bulan: 12,
      bunga_persen_bulanan: null,
      metode: null,
      pokok_awal: 1200000,
      sisa_pokok: 1200000,
      nominal_berikutnya: 100000,
      jumlah_tagihan: 12,
    });
    await render(<HutangBayar />);
    expect(screen.getByDisplayValue('100000')).toBeTruthy();
    expect(screen.getByText('Rp100.000')).toBeTruthy();
  });

  it('berbunga tanpa jadwal: nominal kosong', async () => {
    await render(<HutangBayar />);
    expect(screen.getByTestId('nominal').props.value).toBe('');
    expect(nonaktif()).toBe(true);
  });

  it('berbunga flat 2% dari 1.000.000, belum bayar bulan ini: bunga di depan', async () => {
    await render(<HutangBayar />);
    await fireEvent.changeText(screen.getByTestId('tanggal'), '2026-11-19');
    await fireEvent.changeText(screen.getByTestId('nominal'), '300000');
    expect(porsi()).toEqual(['Rp20.000', 'Rp280.000']);
    expect(screen.getByTestId('sisa-setelah').props.children).toBe('Rp720.000');
  });

  it('sudah ada pembayaran bulan itu: semuanya pokok', async () => {
    mockTxs = [{ ...T('hutang_bayar', 100000, 'w1', null, '2026-11-05'), debt_id: 'h1' }];
    await render(<HutangBayar />);
    await fireEvent.changeText(screen.getByTestId('tanggal'), '2026-11-19');
    await fireEvent.changeText(screen.getByTestId('nominal'), '300000');
    expect(porsi()).toEqual(['Rp0', 'Rp300.000']);
    // bulan lain: bunga ditagih lagi
    await fireEvent.changeText(screen.getByTestId('tanggal'), '2026-12-01');
    expect(porsi()).toEqual(['Rp20.000', 'Rp280.000']);
  });

  it('melebihi sisa: peringatan dan Simpan nonaktif', async () => {
    mockHutang = buatHutang({ sisa_pokok: 100000 });
    await render(<HutangBayar />);
    await fireEvent.changeText(screen.getByTestId('tanggal'), '2026-11-19');
    await fireEvent.press(screen.getByTestId('dompet-w1'));
    await fireEvent.changeText(screen.getByTestId('nominal'), '500000');
    expect(screen.getByText('Melebihi sisa hutang (Rp100.000)')).toBeTruthy();
    expect(nonaktif()).toBe(true);
  });

  it('tanpa dompet: Simpan nonaktif', async () => {
    await render(<HutangBayar />);
    await fireEvent.changeText(screen.getByTestId('nominal'), '300000');
    expect(nonaktif()).toBe(true);
  });

  it('simpan: item hutang_bayar dengan debt_id lalu tutup', async () => {
    await render(<HutangBayar />);
    await fireEvent.changeText(screen.getByTestId('tanggal'), '2026-11-19');
    await fireEvent.changeText(screen.getByTestId('nominal'), '300000');
    await fireEvent.press(screen.getByTestId('dompet-w1'));
    await fireEvent.press(simpan());
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockSave.mock.calls[0][0][0]).toMatchObject({
      id: 'id-1',
      tanggal: '2026-11-19',
      jenis: 'hutang_bayar',
      kategori: 'Kredivo',
      nominal: 300000,
      wallet_id: 'w1',
      wallet_tujuan_id: null,
      debt_id: 'h1',
      transkrip: null,
      sumber: 'manual',
    });
  });

  it('galat server: pesan tampil, isian tetap, percobaan ulang memakai id sama', async () => {
    mockSave.mockRejectedValueOnce({ kind: 'server', pesan: 'Hutang sudah diarsipkan' });
    await render(<HutangBayar />);
    await fireEvent.changeText(screen.getByTestId('nominal'), '300000');
    await fireEvent.press(screen.getByTestId('dompet-w1'));
    await fireEvent.press(simpan());
    expect(await screen.findByText('Hutang sudah diarsipkan')).toBeTruthy();
    expect(screen.getByDisplayValue('300000')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    await fireEvent.press(simpan());
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockSave.mock.calls[1][0][0].id).toBe('id-1');
  });
});
