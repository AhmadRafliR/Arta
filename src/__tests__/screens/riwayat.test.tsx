import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import Riwayat from '../../../app/(tabs)/riwayat';
import { PESAN_OFFLINE } from '@/data/errors';
import { T } from '@/domain/testFactories';

const mockPush = jest.fn();
const mockUseTx = jest.fn();
const mockHapus = jest.fn();

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
  useDeleteTransaction: () => ({ mutateAsync: mockHapus }),
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
  mockHapus.mockResolvedValue(undefined);
});

describe('Riwayat', () => {
  it('pemilih bulan, grup tanggal dengan total harian (transfer dikecualikan)', async () => {
    await render(<Riwayat />);
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(screen.getByText('Bulan ini')).toBeTruthy();
    expect(mockUseTx).toHaveBeenCalledWith('2026-11');
    expect(screen.getByText('Hari ini · Kamis, 19 November')).toBeTruthy();
    expect(screen.getByText('Rp70.000')).toBeTruthy(); // 100000 - 30000
    expect(screen.getByText('Kemarin · Rabu, 18 November')).toBeTruthy();
    expect(screen.getAllByText('-Rp8.000')).toHaveLength(2); // transfer tidak dihitung
  });

  it('kartu ringkasan: selisih, masuk/keluar, catatan transfer; baris hasil', async () => {
    await render(<Riwayat />);
    expect(screen.getByText('Selisih bulan ini')).toBeTruthy();
    expect(screen.getAllByText('Rp62.000')).toHaveLength(2); // selisih kartu + total baris hasil
    expect(screen.getByText('Rp100.000')).toBeTruthy();
    expect(screen.getByText('Rp38.000')).toBeTruthy();
    expect(screen.getByText('1 transfer antar dompet — tidak dihitung pengeluaran harian.')).toBeTruthy();
    expect(screen.getByText('4 transaksi')).toBeTruthy();
  });

  it('geser bulan memakai bulan baru; tidak bisa melewati bulan berjalan', async () => {
    await render(<Riwayat />);
    expect(screen.getByRole('button', { name: 'Bulan berikutnya' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Bulan sebelumnya' }));
    expect(screen.getByText('Oktober 2026')).toBeTruthy();
    expect(screen.getByText('Bulan lalu')).toBeTruthy();
    expect(screen.getByText('Selisih Oktober 2026')).toBeTruthy();
    expect(mockUseTx).toHaveBeenLastCalledWith('2026-10');
    await fireEvent.press(screen.getByRole('button', { name: 'Bulan berikutnya' }));
    expect(screen.getByText('November 2026')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Bulan berikutnya' }));
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(screen.queryByText('Desember 2026')).toBeNull();
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

  it('chip Semua dan Reset melepas filter', async () => {
    await render(<Riwayat />);
    expect(screen.queryByTestId('f-reset')).toBeNull();
    await fireEvent.press(screen.getByTestId('f-dompet-spay'));
    expect(screen.queryByText('Gaji · cash')).toBeNull();
    await fireEvent.press(screen.getByTestId('f-dompet-semua'));
    expect(screen.getByText('Gaji · cash')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('f-jenis-transfer'));
    expect(screen.queryByText('Gaji · cash')).toBeNull();
    await fireEvent.press(screen.getByTestId('f-reset'));
    expect(screen.getByText('Gaji · cash')).toBeTruthy();
    expect(screen.queryByTestId('f-reset')).toBeNull();
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

  it('filter aktif tanpa hasil: pesan filter + tombol Hapus filter', async () => {
    await render(<Riwayat />);
    await fireEvent.press(screen.getByTestId('f-dompet-spay'));
    await fireEvent.press(screen.getByTestId('f-kat-Makan')); // Makan hanya di cash
    expect(screen.getByText('Tidak ada transaksi yang cocok dengan filter.')).toBeTruthy();
    expect(screen.queryByText('Belum ada transaksi di bulan ini.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Hapus filter' }));
    expect(screen.getByText('Gaji · cash')).toBeTruthy();
  });

  it('ketuk baris membuka sheet detail; Ubah membuka /transaksi/[id] dengan bulan', async () => {
    await render(<Riwayat />);
    await fireEvent.press(screen.getByText('Makan · cash'));
    expect(mockPush).not.toHaveBeenCalled();
    const sheet = within(screen.getByTestId('sheet-transaksi'));
    expect(sheet.getByText('Pengeluaran · Hari ini')).toBeTruthy();
    expect(sheet.getByText('Kategori')).toBeTruthy();
    expect(sheet.getByText('Rp30.000')).toBeTruthy(); // rincian nominal
    await fireEvent.press(screen.getByRole('button', { name: 'Ubah' }));
    expect(mockPush).toHaveBeenCalledWith(`/transaksi/${data[1].id}?bulan=2026-11`);
  });

  it('hapus di sheet meminta konfirmasi lalu memanggil hook hapus', async () => {
    await render(<Riwayat />);
    await fireEvent.press(screen.getByText('Makan · cash'));
    await fireEvent.press(screen.getByRole('button', { name: 'Hapus' }));
    expect(mockHapus).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Yakin hapus?' }));
    await waitFor(() => expect(mockHapus).toHaveBeenCalledWith(data[1].id));
    await waitFor(() => expect(screen.queryByTestId('sheet-transaksi')).toBeNull());
  });

  it('hapus gagal: pesan galat tampil di sheet', async () => {
    mockHapus.mockRejectedValue({ kind: 'offline', pesan: PESAN_OFFLINE });
    await render(<Riwayat />);
    await fireEvent.press(screen.getByText('Makan · cash'));
    await fireEvent.press(screen.getByRole('button', { name: 'Hapus' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yakin hapus?' }));
    expect(await screen.findByText(PESAN_OFFLINE)).toBeTruthy();
    expect(screen.getByTestId('sheet-transaksi')).toBeTruthy();
  });

  it('kosong, memuat, galat', async () => {
    mockUseTx.mockReturnValue({ isLoading: false, error: null, data: [] });
    const r = await render(<Riwayat />);
    expect(screen.getByText('Belum ada transaksi di bulan ini.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hapus filter' })).toBeNull();
    mockUseTx.mockReturnValue({ isLoading: true, error: null, data: undefined });
    await r.rerender(<Riwayat />);
    expect(screen.getByText('Memuat…')).toBeTruthy();
    mockUseTx.mockReturnValue({ isLoading: false, error: { kind: 'offline', pesan: PESAN_OFFLINE }, data: undefined });
    await r.rerender(<Riwayat />);
    expect(screen.getByText(PESAN_OFFLINE)).toBeTruthy();
    expect(screen.queryByText('Rp0')).toBeNull();
    expect(screen.queryByText('Belum ada transaksi di bulan ini.')).toBeNull();
  });
});
