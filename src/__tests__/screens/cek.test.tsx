import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Cek from '../../../app/cek';
import { PESAN_OFFLINE } from '@/data/errors';
import { kosongkan, setDraf } from '@/ai/drafStore';
import type { DrafTx, HasilAi } from '@/ai/tipe';

const mockSave = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: mockReplace }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/data/transactions', () => ({
  useSaveTransactions: () => ({ mutateAsync: mockSave }),
  useAllTransactions: () => ({ data: [] }),
}));
jest.mock('@/data/wallets', () => ({
  useWallets: () => ({
    data: [
      { id: 'w-gopay', nama: 'GoPay', tipe: 'harian', saldo_awal: 200000, tanggal_saldo_awal: '2026-11-01', target: null, diarsip: false },
      { id: 'w-cash', nama: 'Cash', tipe: 'harian', saldo_awal: 50000, tanggal_saldo_awal: '2026-11-01', target: null, diarsip: false },
      { id: 'w-lama', nama: 'Lama', tipe: 'harian', saldo_awal: 0, tanggal_saldo_awal: '2026-11-01', target: null, diarsip: true },
    ],
  }),
}));
jest.mock('@/data/categories', () => ({
  useCategories: (jenis: string) => ({
    data:
      jenis === 'pengeluaran'
        ? [
            { id: 'c1', jenis, nama: 'rokok' },
            { id: 'c2', jenis, nama: 'parkir' },
            { id: 'c3', jenis, nama: 'lainnya' },
          ]
        : [{ id: 'c4', jenis, nama: 'gaji' }],
  }),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' } }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: { accFg: '#000', mid: '#888', acc: '#0f0', fg: '#000', fg2: '#333', warnInk: '#a60' } }),
}));

const draf = (over: Partial<DrafTx> & { id: string }): DrafTx => ({
  tanggal: '2026-11-20',
  jenis: 'pengeluaran',
  kategori: 'lainnya',
  nominal: 1000,
  wallet_id: 'w-gopay',
  wallet_tujuan_id: null,
  catatan: null,
  peringatan: [],
  ...over,
});

const hasil = (over: Partial<HasilAi> = {}): HasilAi => ({
  transkrip: 'tadi rokok 25rb pake gopay, parkir 2rb cash',
  kuota: { bulan: '2026-11', terpakai: 1, batas: 30, pro: false },
  draf: [
    draf({ id: 'd1', kategori: 'rokok', nominal: 25000, wallet_id: 'w-gopay' }),
    draf({ id: 'd2', kategori: 'parkir', nominal: 2000, wallet_id: 'w-cash' }),
  ],
  koreksi: [],
  tidakDidukung: [],
  butuh_klarifikasi: false,
  pertanyaan: null,
  ...over,
});

async function buka(h: HasilAi | null = hasil()) {
  if (h) await act(async () => setDraf(h));
  return render(<Cek />);
}

/** Ambil onPress milik komponen Pressable terdekat dari elemen host. */
function onPressDari(el: unknown): () => Promise<void> {
  let f = (el as { unstable_fiber?: { memoizedProps?: { onPress?: unknown }; return?: unknown } }).unstable_fiber;
  while (f && typeof f.memoizedProps?.onPress !== 'function') f = f.return as typeof f;
  if (!f) throw new Error('onPress tidak ditemukan');
  return f.memoizedProps!.onPress as () => Promise<void>;
}

const tombolSimpan = (n: number) => screen.getByRole('button', { name: `Simpan ${n} transaksi` });

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockImplementation(async (items: unknown[]) => items);
});
afterEach(() => act(() => kosongkan()));

describe('Cek dulu', () => {
  it('menampilkan transkrip, 2 draf bertanda, dan tombol Simpan 2 transaksi', async () => {
    await buka();
    expect(screen.getByText('Cek dulu')).toBeTruthy();
    expect(screen.getByText('“tadi rokok 25rb pake gopay, parkir 2rb cash”')).toBeTruthy();
    expect(screen.getByText('-Rp25.000')).toBeTruthy();
    expect(screen.getByText('-Rp2.000')).toBeTruthy();
    expect(screen.getByText('Rokok · GoPay · Hari ini')).toBeTruthy();
    expect(tombolSimpan(2)).toBeTruthy();
  });

  it('Simpan: satu panggilan berisi 2 item sumber ai dengan transkrip, lalu kosongkan dan tutup', async () => {
    await buka();
    await fireEvent.press(tombolSimpan(2));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockSave).toHaveBeenCalledTimes(1);
    const items = mockSave.mock.calls[0][0];
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      id: 'd1',
      tanggal: '2026-11-20',
      jenis: 'pengeluaran',
      kategori: 'rokok',
      nominal: 25000,
      wallet_id: 'w-gopay',
      wallet_tujuan_id: null,
      catatan: null,
      transkrip: 'tadi rokok 25rb pake gopay, parkir 2rb cash',
      sumber: 'ai',
    });
    expect(items[1]).toMatchObject({ id: 'd2', wallet_id: 'w-cash', sumber: 'ai', transkrip: expect.any(String) });
    // store dikosongkan; tidak ada replace('/') tambahan karena layar ditutup sendiri
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('tekan Simpan dua kali cepat tetap satu panggilan', async () => {
    let selesai: (v: unknown) => void = () => {};
    mockSave.mockImplementation(() => new Promise((r) => (selesai = r)));
    await buka();
    const tombol = tombolSimpan(2);
    // fireEvent menunggu handler async sampai selesai, dan act() tidak boleh tumpang tindih; jadi kedua tekan
    // dipanggil langsung dalam satu act, sebelum render ulang (tombol belum nonaktif): yang menjaga adalah ref.
    const tekan = onPressDari(tombol);
    let pertama: Promise<void> | undefined;
    await act(async () => {
      pertama = tekan();
      void tekan();
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
    await act(async () => {
      selesai([]);
      await pertama;
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('simpan gagal: pesan tampil, draf tetap; coba lagi memakai id yang sama', async () => {
    mockSave.mockRejectedValueOnce({ kind: 'offline', pesan: PESAN_OFFLINE });
    await buka();
    await fireEvent.press(tombolSimpan(2));
    expect(await screen.findByText(PESAN_OFFLINE)).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByText('-Rp25.000')).toBeTruthy();

    await fireEvent.press(tombolSimpan(2));
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockSave).toHaveBeenCalledTimes(2);
    const id = (n: number) => mockSave.mock.calls[n][0].map((x: { id: string }) => x.id);
    expect(id(0)).toEqual(['d1', 'd2']);
    expect(id(1)).toEqual(['d1', 'd2']);
  });

  it('draf tanpa dompet: Simpan nonaktif dengan alasan; pilih GoPay di editor -> aktif', async () => {
    await buka(
      hasil({
        draf: [draf({ id: 'd1', kategori: 'lainnya', nominal: 30000, wallet_id: null, peringatan: ['Dompet "dana" belum ada, pilih dompet'] })],
      }),
    );
    expect(screen.getByText('Dompet "dana" belum ada, pilih dompet')).toBeTruthy();
    expect(tombolSimpan(1).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Pilih dompet untuk semua transaksi dulu.')).toBeTruthy();
    await fireEvent.press(tombolSimpan(1));
    expect(mockSave).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('draf-d1'));
    await fireEvent.press(screen.getByTestId('src-w-gopay'));
    await fireEvent.press(screen.getByRole('button', { name: 'Selesai' }));

    expect(tombolSimpan(1).props.accessibilityState.disabled).toBe(false);
    expect(screen.queryByText('Pilih dompet untuk semua transaksi dulu.')).toBeNull();
    expect(screen.queryByText('Dompet "dana" belum ada, pilih dompet')).toBeNull();
    await fireEvent.press(tombolSimpan(1));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(mockSave.mock.calls[0][0][0]).toMatchObject({ id: 'd1', wallet_id: 'w-gopay' });
  });

  it('editor mengubah nominal, kategori, dan jenis transfer', async () => {
    await buka();
    await fireEvent.press(screen.getByTestId('draf-d2'));
    await fireEvent.changeText(screen.getByTestId('nominal'), '5rb');
    await fireEvent.press(screen.getByTestId('jenis-transfer'));
    await fireEvent.press(screen.getByTestId('dst-w-gopay'));
    await fireEvent.press(screen.getByRole('button', { name: 'Selesai' }));
    expect(screen.getByText('Rp5.000')).toBeTruthy();
    await fireEvent.press(tombolSimpan(2));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(mockSave.mock.calls[0][0][1]).toMatchObject({
      id: 'd2',
      jenis: 'transfer',
      kategori: 'transfer',
      nominal: 5000,
      wallet_id: 'w-cash',
      wallet_tujuan_id: 'w-gopay',
    });
  });

  it('transfer tanpa tujuan menonaktifkan Simpan', async () => {
    await buka(hasil({ draf: [draf({ id: 'd1', jenis: 'transfer', kategori: 'transfer', wallet_tujuan_id: null })] }));
    expect(tombolSimpan(1).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Pilih dompet untuk semua transaksi dulu.')).toBeTruthy();
  });

  it('hapus satu baris -> Simpan 1 transaksi', async () => {
    await buka();
    await fireEvent.press(screen.getByTestId('hapus-d1'));
    expect(screen.queryByText('-Rp25.000')).toBeNull();
    expect(tombolSimpan(1)).toBeTruthy();
  });

  it('koreksi saldo: sebelum -> sesudah dan item penyesuaian bertanda', async () => {
    await buka(hasil({ draf: [], koreksi: [{ id: 'k1', wallet_id: 'w-gopay', saldo_baru: 150000 }] }));
    expect(screen.getByText('Saldo GoPay')).toBeTruthy();
    expect(screen.getByText('Rp200.000 → Rp150.000')).toBeTruthy();
    await fireEvent.press(tombolSimpan(1));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    const [item] = mockSave.mock.calls[0][0];
    expect(item).toMatchObject({
      id: 'k1',
      jenis: 'penyesuaian',
      kategori: 'penyesuaian',
      nominal: -50000,
      wallet_id: 'w-gopay',
      wallet_tujuan_id: null,
      catatan: 'Koreksi saldo lewat suara',
      sumber: 'ai',
      transkrip: expect.any(String),
    });
    expect(item.tanggal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('koreksi yang sudah sama: "Sudah sama" dan tidak ikut disimpan', async () => {
    await buka(hasil({ koreksi: [{ id: 'k1', wallet_id: 'w-cash', saldo_baru: 50000 }] }));
    expect(screen.getByText('Sudah sama')).toBeTruthy();
    await fireEvent.press(tombolSimpan(2));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(mockSave.mock.calls[0][0].map((x: { id: string }) => x.id)).toEqual(['d1', 'd2']);
  });

  it('hanya koreksi yang sudah sama -> Simpan 0 transaksi nonaktif', async () => {
    await buka(hasil({ draf: [], koreksi: [{ id: 'k1', wallet_id: 'w-cash', saldo_baru: 50000 }] }));
    expect(tombolSimpan(0).props.accessibilityState.disabled).toBe(true);
  });

  it('tidakDidukung tampil', async () => {
    await buka(hasil({ tidakDidukung: ['Pencatatan hutang belum didukung (menyusul): bayar kredivo'] }));
    expect(screen.getByText('Pencatatan hutang belum didukung (menyusul): bayar kredivo')).toBeTruthy();
  });

  it('Batal -> konfirmasi -> store kosong dan layar ditutup', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await buka();
    await fireEvent.press(screen.getByRole('button', { name: 'Batal' }));
    expect(spy.mock.calls[0][0]).toBe('Buang hasil catat ini?');
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('-Rp25.000')).toBeNull(); // store kosong -> layar tidak merender draf
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('Batal lalu pilih batal di konfirmasi: draf tetap', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await buka();
    await fireEvent.press(screen.getByRole('button', { name: 'Batal' }));
    expect(mockBack).not.toHaveBeenCalled();
    expect(screen.getByText('-Rp25.000')).toBeTruthy();
    spy.mockRestore();
  });

  it('store kosong saat dibuka -> replace ke Beranda', async () => {
    await buka(null);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
