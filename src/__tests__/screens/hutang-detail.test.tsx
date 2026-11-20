import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Detail from '../../../app/hutang/[id]';
import { buatHutang, T } from '@/domain/testFactories';
import type { Tagihan } from '@/domain/types';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockDelete = jest.fn();
const mockUpdate = jest.fn();
const mockTambah = jest.fn();
let mockHutang: ReturnType<typeof buatHutang>;
let mockJadwal: Tagihan[];
let mockTxs: unknown[];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, canGoBack: () => true, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'h1' }),
}));
jest.mock('@/data/debts', () => ({
  useDebt: () => ({ data: mockHutang }),
  useDebtSchedule: () => ({ data: mockJadwal }),
  useUpdateDebt: () => ({ mutateAsync: mockUpdate }),
  useDeleteDebt: () => ({ mutateAsync: mockDelete }),
  useTambahJadwal: () => ({ mutateAsync: mockTambah }),
}));
jest.mock('@/data/transactions', () => ({
  useDebtTransactions: () => ({ data: mockTxs }),
}));
jest.mock('@/data/wallets', () => ({ useWallets: () => ({ data: [] }) }));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' } }),
}));
jest.mock('@/lib/tanggal', () => ({
  ...jest.requireActual('@/lib/tanggal'),
  hariIni: () => '2026-11-20',
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ t: { fg2: '#555', warnInk: '#8A5A00', mid: '#888', accFg: '#000', fg: '#000', acc: '#0f0' } }),
}));

const cicilan = () =>
  buatHutang({
    tipe: 'cicilan_tetap',
    pokok_awal: 1_200_000,
    nominal_cicilan: 100_000,
    tenor_bulan: 12,
    bunga_persen_bulanan: null,
    metode: null,
    sisa_pokok: 1_100_000,
    jumlah_tagihan: 12,
    tagihan_lunas: 1,
  });
const jadwal12 = (): Tagihan[] =>
  Array.from({ length: 12 }, (_, i) => ({
    id: `t${i}`,
    debt_id: 'h1',
    jatuh_tempo: `2027-${String(i + 1).padStart(2, '0')}-05`,
    nominal: 100_000,
    status: i === 0 ? 'lunas' : 'belum',
    transaction_id: i === 0 ? 'x' : null,
  }));

beforeEach(() => {
  jest.clearAllMocks();
  mockHutang = cicilan();
  mockJadwal = jadwal12();
  mockTxs = [];
  mockDelete.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
  mockTambah.mockResolvedValue({});
});

describe('Detail hutang', () => {
  it('jadwal 12 baris dengan 1 Lunas, info cicilan', async () => {
    await render(<Detail />);
    expect(screen.getAllByText('Rp100.000')).toHaveLength(12);
    expect(screen.getAllByText('Lunas')).toHaveLength(1);
    expect(screen.getByText('Cicilan Rp100.000 × 12 bulan')).toBeTruthy();
    expect(screen.getByText('1/12 lunas')).toBeTruthy();
    expect(screen.getByText('Rp1.100.000')).toBeTruthy();
    expect(screen.getByText('Rp100.000 (8%)')).toBeTruthy();
  });

  it('Bayar membuka form bayar', async () => {
    await render(<Detail />);
    await fireEvent.press(screen.getByRole('button', { name: 'Bayar' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/hutang/bayar', params: { id: 'h1' } });
  });

  it('Sesuaikan sisa tidak tampil untuk cicilan', async () => {
    await render(<Detail />);
    expect(screen.queryByRole('button', { name: 'Sesuaikan sisa' })).toBeNull();
  });

  it('berbunga: Sesuaikan sisa tampil dan membuka form', async () => {
    mockHutang = buatHutang({ sisa_pokok: 600_000, metode: 'efektif', total_bunga: 20_000 });
    mockJadwal = [];
    await render(<Detail />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sesuaikan sisa' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/hutang/sesuaikan', params: { id: 'h1' } });
    expect(screen.getByText('Belum ada jadwal.')).toBeTruthy();
  });

  it('hapus: konfirmasi lalu useDeleteDebt', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<Detail />);
    await fireEvent.press(screen.getByRole('button', { name: 'Hapus hutang' }));
    expect(alert).toHaveBeenCalledWith(
      'Hapus hutang ini? Semua pembayarannya ikut terhapus dan saldo dompet dihitung ulang.',
      undefined,
      expect.any(Array),
    );
    const tombol = (alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find((b) => b.text === 'Hapus');
    tombol?.onPress?.();
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('h1'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    alert.mockRestore();
  });

  it('riwayat menampilkan rincian bunga dan pokok, ketuk membuka transaksi', async () => {
    mockHutang = buatHutang({ sisa_pokok: 720_000 });
    mockJadwal = [];
    mockTxs = [{ ...T('hutang_bayar', 300_000, 'w1'), id: 'tx9', debt_id: 'h1', porsi_bunga: 20_000, porsi_pokok: 280_000 }];
    await render(<Detail />);
    expect(screen.getByText('Bunga Rp20.000 · Pokok Rp280.000')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Riwayat tx9' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/transaksi/[id]', params: { id: 'tx9' } });
  });

  it('tambah tagihan: validasi tanggal lalu panggil useTambahJadwal', async () => {
    mockHutang = buatHutang();
    mockJadwal = [];
    await render(<Detail />);
    await fireEvent.press(screen.getByRole('button', { name: 'Tambah tagihan' }));
    await fireEvent.changeText(screen.getByLabelText('Tanggal jatuh tempo'), '2026-13-40');
    await fireEvent.changeText(screen.getByTestId('nominal-tagihan'), '150000');
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan tagihan' }));
    expect(mockTambah).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Tanggal jatuh tempo'), '2026-12-05');
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan tagihan' }));
    await waitFor(() =>
      expect(mockTambah).toHaveBeenCalledWith({ debt_id: 'h1', jatuh_tempo: '2026-12-05', nominal: 150_000 }),
    );
  });

  it('arsipkan memanggil useUpdateDebt', async () => {
    await render(<Detail />);
    await fireEvent.press(screen.getByRole('button', { name: 'Arsipkan' }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ id: 'h1', patch: { diarsip: true } }));
  });
});
