import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Ubah from '../../../app/transaksi/[id]';
import { PESAN_OFFLINE } from '@/data/errors';
import { buatPatch } from '@/lib/txPatch';
import { T } from '@/domain/testFactories';

const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockBack = jest.fn();
let mockTx: { data: unknown; isLoading: boolean; error: unknown };

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'tx-1', bulan: '2026-11' }),
}));
jest.mock('@/data/transactions', () => ({
  useTransaction: () => mockTx,
  useUpdateTransaction: () => ({ mutateAsync: mockUpdate }),
  useDeleteTransaction: () => ({ mutateAsync: mockDelete }),
  useSaveTransactions: () => ({ mutateAsync: jest.fn() }),
}));
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
    data:
      jenis === 'pengeluaran'
        ? [
            { id: 'c1', jenis, nama: 'Makan' },
            { id: 'c2', jenis, nama: 'Transport' },
          ]
        : [{ id: 'c3', jenis, nama: 'Gaji' }],
  }),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' } }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: { accFg: '#000', mid: '#888', acc: '#0f0', fg: '#000' } }),
}));

const tx = (over: object = {}) => ({
  ...T('pengeluaran', 25000, 'w1', null, '2026-11-10'),
  id: 'tx-1',
  kategori: 'Makan',
  catatan: 'siang',
  ...over,
});
const simpan = () => screen.getByRole('button', { name: 'Simpan' });

beforeEach(() => {
  jest.clearAllMocks();
  mockTx = { data: tx(), isLoading: false, error: null };
});

describe('buatPatch', () => {
  it('hanya kolom berubah; ganti jenis ikut kirim kategori + wallet_tujuan_id', () => {
    const awal = tx();
    const sama = {
      tanggal: awal.tanggal,
      jenis: awal.jenis,
      kategori: awal.kategori,
      nominal: awal.nominal,
      wallet_id: awal.wallet_id,
      wallet_tujuan_id: null,
      catatan: awal.catatan,
    };
    expect(buatPatch(awal, sama)).toEqual({});
    expect(buatPatch(awal, { ...sama, nominal: 30000 })).toEqual({ nominal: 30000 });
    expect(buatPatch(awal, { ...sama, jenis: 'transfer', kategori: null, wallet_tujuan_id: 'w2' })).toEqual({
      jenis: 'transfer',
      kategori: null,
      wallet_tujuan_id: 'w2',
    });
    expect(buatPatch(awal, { ...sama, jenis: 'pemasukan', kategori: 'Gaji' })).toEqual({
      jenis: 'pemasukan',
      kategori: 'Gaji',
      wallet_tujuan_id: null,
    });
  });
});

describe('Ubah transaksi', () => {
  it('mengisi formulir dari transaksi dan mengirim hanya perubahan', async () => {
    mockUpdate.mockResolvedValue({});
    await render(<Ubah />);
    expect(screen.getByDisplayValue('25000')).toBeTruthy();
    expect(screen.getByDisplayValue('2026-11-10')).toBeTruthy();
    expect(screen.getByDisplayValue('siang')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('nominal'), '30rb');
    await fireEvent.press(simpan());
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockUpdate).toHaveBeenCalledWith({ id: 'tx-1', patch: { nominal: 30000 } });
  });

  it('ganti ke transfer mengirim wallet_tujuan_id dan kategori null', async () => {
    mockUpdate.mockResolvedValue({});
    await render(<Ubah />);
    await fireEvent.press(screen.getByTestId('jenis-transfer'));
    await fireEvent.press(screen.getByTestId('dst-w2'));
    await fireEvent.press(simpan());
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][0]).toEqual({
      id: 'tx-1',
      patch: { jenis: 'transfer', kategori: null, wallet_tujuan_id: 'w2' },
    });
  });

  it('transfer -> pengeluaran mengirim wallet_tujuan_id null', async () => {
    mockTx = { data: tx({ jenis: 'transfer', kategori: null, wallet_tujuan_id: 'w2' }), isLoading: false, error: null };
    mockUpdate.mockResolvedValue({});
    await render(<Ubah />);
    await fireEvent.press(screen.getByTestId('jenis-pengeluaran'));
    await fireEvent.press(screen.getByTestId('kat-Makan'));
    await fireEvent.press(simpan());
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][0].patch).toEqual({ jenis: 'pengeluaran', kategori: 'Makan', wallet_tujuan_id: null });
  });

  it('galat simpan tampil dan layar tidak ditutup', async () => {
    mockUpdate.mockRejectedValue({ kind: 'offline', pesan: PESAN_OFFLINE });
    await render(<Ubah />);
    await fireEvent.changeText(screen.getByTestId('catatan'), 'malam');
    await fireEvent.press(simpan());
    expect(await screen.findByText(PESAN_OFFLINE)).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('hutang: tanpa pilihan jenis, nominal tidak bisa diubah', async () => {
    mockTx = { data: tx({ jenis: 'hutang_bayar', kategori: null, debt_id: 'd1' }), isLoading: false, error: null };
    mockUpdate.mockResolvedValue({});
    await render(<Ubah />);
    expect(screen.queryByTestId('jenis-pengeluaran')).toBeNull();
    expect(screen.queryByTestId('jenis-transfer')).toBeNull();
    expect(screen.getByTestId('nominal').props.editable).toBe(false);
    expect(screen.getByText('Transaksi hutang · hanya tanggal dan catatan yang dapat diubah. Ubah hutangnya dari tab Hutang.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('catatan'), 'revisi');
    await fireEvent.press(simpan());
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][0]).toEqual({ id: 'tx-1', patch: { catatan: 'revisi' } });
  });

  it('penyesuaian: nominal dan dompet read-only, tetap bisa dihapus', async () => {
    mockTx = { data: tx({ jenis: 'penyesuaian', kategori: null, nominal: -5000 }), isLoading: false, error: null };
    await render(<Ubah />);
    expect(screen.getByTestId('nominal').props.editable).toBe(false);
    expect(screen.getByText('penyesuaian · hanya tanggal dan catatan yang dapat diubah')).toBeTruthy();
    expect(screen.queryByTestId('src-w1')).toBeNull();
    expect(screen.getByRole('button', { name: 'Hapus' })).toBeTruthy();
  });

  it('Hapus: konfirmasi lalu delete dengan id itu, kembali', async () => {
    mockDelete.mockResolvedValue(undefined);
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await render(<Ubah />);
    await fireEvent.press(screen.getByRole('button', { name: 'Hapus' }));
    expect(spy.mock.calls[0][0]).toBe('Hapus transaksi ini? Saldo dompet akan dihitung ulang.');
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('tx-1'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    spy.mockRestore();
  });

  it('Hapus dibatalkan: tidak ada mutasi', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<Ubah />);
    await fireEvent.press(screen.getByRole('button', { name: 'Hapus' }));
    expect(mockDelete).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('memuat dan galat muat berupa teks', async () => {
    mockTx = { data: undefined, isLoading: true, error: null };
    const r = await render(<Ubah />);
    expect(screen.getByText('Memuat…')).toBeTruthy();
    mockTx = { data: undefined, isLoading: false, error: { kind: 'offline', pesan: PESAN_OFFLINE } };
    await r.rerender(<Ubah />);
    expect(screen.getByText(PESAN_OFFLINE)).toBeTruthy();
  });
});
