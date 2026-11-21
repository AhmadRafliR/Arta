import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HutangBaru from '../../../app/hutang/baru';
import { PESAN_OFFLINE } from '@/data/errors';

const mockSave = jest.fn();
const mockReplace = jest.fn();
let mockId = 0;
const mockNewTxId = jest.fn(() => `id-${++mockId}`);

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true, replace: mockReplace }),
}));
jest.mock('@/data/transactions', () => ({
  useSaveTransactions: () => ({ mutateAsync: mockSave }),
  newTxId: () => mockNewTxId(),
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

async function isiCicilan() {
  await fireEvent.changeText(screen.getByTestId('pemberi'), 'Kredivo');
  await fireEvent.changeText(screen.getByTestId('nominal-cicilan'), '100000');
  await fireEvent.changeText(screen.getByTestId('tenor'), '12');
}

async function isiBerbunga() {
  await fireEvent.changeText(screen.getByTestId('pemberi'), 'Koperasi');
  await fireEvent.press(screen.getByTestId('tipe-berbunga'));
  await fireEvent.changeText(screen.getByTestId('pokok-awal'), '1000000');
  await fireEvent.changeText(screen.getByTestId('bunga'), '2,5');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockId = 0;
  mockSave.mockImplementation(async (items: unknown[]) => items);
});

describe('Hutang baru', () => {
  it('cicilan 100.000 x 12 menampilkan total dan menyimpan satu item', async () => {
    await render(<QueryClientProvider client={new QueryClient()}><HutangBaru /></QueryClientProvider>);
    await isiCicilan();
    expect(screen.getByTestId('total-hutang').props.children).toBe('Rp1.200.000');
    await fireEvent.press(simpan());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    expect(mockSave).toHaveBeenCalledTimes(1);
    const [item] = mockSave.mock.calls[0][0];
    expect(item).toMatchObject({
      id: 'id-1',
      debt_id: 'id-2',
      jenis: 'hutang_baru',
      kategori: 'Kredivo',
      nominal: 1200000,
      wallet_id: null,
      wallet_tujuan_id: null,
      sumber: 'manual',
      transkrip: null,
      hutang: { pemberi: 'Kredivo', tipe: 'cicilan_tetap', tenor_bulan: 12, nominal_cicilan: 100000 },
    });
    expect(item.hutang.jatuh_tempo_pertama).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/hutang/[id]', params: { id: 'id-2' } });
  });

  it('simpan dua kali cepat tetap satu panggilan', async () => {
    let selesai: (v: unknown[]) => void = () => {};
    mockSave.mockImplementation(() => new Promise((r) => (selesai = r)));
    await render(<QueryClientProvider client={new QueryClient()}><HutangBaru /></QueryClientProvider>);
    await isiCicilan();
    // Dua onPress dalam satu render yang sama (sebelum busy sempat tampil): hanya satu yang jalan.
    const tombol = simpan();
    await act(async () => {
      void fireEvent.press(tombol);
      void fireEvent.press(tombol);
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
    await act(async () => selesai([]));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
  });

  it('gagal lalu coba lagi memakai id dan debt_id yang sama', async () => {
    mockSave.mockRejectedValueOnce({ kind: 'offline', pesan: PESAN_OFFLINE });
    await render(<QueryClientProvider client={new QueryClient()}><HutangBaru /></QueryClientProvider>);
    await isiCicilan();
    await fireEvent.press(simpan());
    expect(await screen.findByText(PESAN_OFFLINE)).toBeTruthy();
    expect(screen.getByDisplayValue('Kredivo')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    await fireEvent.press(simpan());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    const [a] = mockSave.mock.calls[0][0];
    const [b] = mockSave.mock.calls[1][0];
    expect(b.id).toBe(a.id);
    expect(b.debt_id).toBe(a.debt_id);
    expect(mockNewTxId).toHaveBeenCalledTimes(2);
  });

  it('berbunga tanpa memilih dompet: Simpan nonaktif; "Tidak masuk dompet" mengaktifkan', async () => {
    await render(<QueryClientProvider client={new QueryClient()}><HutangBaru /></QueryClientProvider>);
    await isiBerbunga();
    expect(nonaktif()).toBe(true);
    await fireEvent.press(screen.getByTestId('dompet-tidak'));
    expect(nonaktif()).toBe(false);
  });

  it('bunga "2,5" dikirim sebagai 2.5, metode efektif bawaan, dompet dipilih', async () => {
    await render(<QueryClientProvider client={new QueryClient()}><HutangBaru /></QueryClientProvider>);
    await isiBerbunga();
    await fireEvent.press(screen.getByTestId('dompet-w1'));
    expect(screen.queryByTestId('dompet-w3')).toBeNull();
    await fireEvent.press(simpan());
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    const [item] = mockSave.mock.calls[0][0];
    expect(item).toMatchObject({
      wallet_id: 'w1',
      nominal: 1000000,
      hutang: { tipe: 'berbunga', pokok_awal: 1000000, bunga_persen_bulanan: 2.5, metode: 'efektif' },
    });
    expect(item.hutang.sisa_pokok_sekarang).toBeUndefined();
  });

  it('sudah berjalan dengan sisa lebih dari pokok: galat dan Simpan nonaktif', async () => {
    await render(<QueryClientProvider client={new QueryClient()}><HutangBaru /></QueryClientProvider>);
    await isiBerbunga();
    await fireEvent.press(screen.getByTestId('dompet-tidak'));
    await fireEvent.press(screen.getByTestId('sudah-berjalan'));
    await fireEvent.changeText(screen.getByTestId('sisa-pokok'), '1500000');
    expect(screen.getByText('Sisa pokok tidak boleh lebih dari pokok awal')).toBeTruthy();
    expect(nonaktif()).toBe(true);
    await fireEvent.changeText(screen.getByTestId('sisa-pokok'), '600000');
    expect(nonaktif()).toBe(false);
    await fireEvent.press(simpan());
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockSave.mock.calls[0][0][0].hutang.sisa_pokok_sekarang).toBe(600000);
  });

  it('Simpan nonaktif sebelum isian wajib terisi', async () => {
    await render(<QueryClientProvider client={new QueryClient()}><HutangBaru /></QueryClientProvider>);
    expect(nonaktif()).toBe(true);
  });

  it('menjelaskan kolom yang belum beres, dan pesannya hilang saat lengkap', async () => {
    await render(<QueryClientProvider client={new QueryClient()}><HutangBaru /></QueryClientProvider>);
    expect(
      screen.getByText(
        'Belum bisa disimpan. Lengkapi: nama pemberi; nominal cicilan per bulan; sisa tenor (1–60 bulan).',
      ),
    ).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('pemberi'), 'Kredivo');
    expect(
      screen.getByText('Belum bisa disimpan. Lengkapi: nominal cicilan per bulan; sisa tenor (1–60 bulan).'),
    ).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('nominal-cicilan'), '100000');
    await fireEvent.changeText(screen.getByTestId('tenor'), '12');
    expect(screen.queryByText(/Belum bisa disimpan/)).toBeNull();
    expect(nonaktif()).toBe(false);
  });
});
