import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import DompetAwal from '../../../app/(onboarding)/dompet-awal';

const mockCreate = jest.fn();
const mockRefresh = jest.fn();
const mockEq = jest.fn();
const mockUpdate = jest.fn((_patch: unknown) => ({ eq: mockEq }));

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => ({ update: (p: unknown) => mockUpdate(p) })) },
}));
jest.mock('@/data/wallets', () => ({
  useCreateWallet: () => ({ mutateAsync: mockCreate }),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } }, refreshProfile: mockRefresh }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ t: { accFg: '#000', mid: '#888' } }),
}));

const mulai = () => screen.getByRole('button', { name: 'Mulai' });
const nonaktif = () => mulai().props.accessibilityState?.disabled === true;
const saldo = (i: number) => screen.getAllByPlaceholderText('0')[i];

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({});
  mockEq.mockResolvedValue({ error: null });
});

describe('Dompet awal', () => {
  it('bawaan GoPay, Cash, ShopeePay dan Mulai aktif', async () => {
    await render(<DompetAwal />);
    expect(screen.getByDisplayValue('GoPay')).toBeTruthy();
    expect(screen.getByDisplayValue('Cash')).toBeTruthy();
    expect(screen.getByDisplayValue('ShopeePay')).toBeTruthy();
    expect(nonaktif()).toBe(false);
  });

  it('nominal "abc" -> error dan Mulai nonaktif', async () => {
    await render(<DompetAwal />);
    await fireEvent.changeText(saldo(0), 'abc');
    expect(screen.getByText('Nominal tidak valid')).toBeTruthy();
    expect(nonaktif()).toBe(true);
  });

  it('"153.267" -> pratinjau Rp153.267', async () => {
    await render(<DompetAwal />);
    await fireEvent.changeText(saldo(0), '153.267');
    expect(screen.getByText('Rp153.267')).toBeTruthy();
  });

  it('saldo awal "0" dan kosong valid', async () => {
    await render(<DompetAwal />);
    await fireEvent.changeText(saldo(0), '0');
    await fireEvent.changeText(saldo(1), '');
    expect(screen.queryByText('Nominal tidak valid')).toBeNull();
    expect(nonaktif()).toBe(false);
  });

  it('tanpa dompet -> nonaktif; tambah dompet -> nama kosong nonaktif', async () => {
    await render(<DompetAwal />);
    for (let i = 0; i < 3; i++) await fireEvent.press(screen.getAllByLabelText('Hapus dompet')[0]);
    expect(nonaktif()).toBe(true);
    await fireEvent.press(screen.getByText('Tambah dompet'));
    expect(nonaktif()).toBe(true); // nama kosong
    await fireEvent.changeText(screen.getByPlaceholderText('Nama dompet'), 'Bank');
    expect(nonaktif()).toBe(false);
  });

  it('nama dompet kembar -> nonaktif', async () => {
    await render(<DompetAwal />);
    await fireEvent.changeText(screen.getByDisplayValue('Cash'), 'gopay');
    expect(nonaktif()).toBe(true);
  });

  it('Mulai: buat dompet (harian, tanggal lokal), update profil, refreshProfile', async () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 5, 23, 30), doNotFake: ['setTimeout', 'clearTimeout', 'setImmediate', 'nextTick', 'queueMicrotask'] });
    try {
      await render(<DompetAwal />);
      await fireEvent.changeText(screen.getByPlaceholderText('Nama panggilan'), ' Budi ');
      await fireEvent.changeText(saldo(0), '1,5jt');
      await fireEvent.press(mulai());
      await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    } finally {
      jest.useRealTimers();
    }
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(mockCreate).toHaveBeenNthCalledWith(1, {
      nama: 'GoPay',
      tipe: 'harian',
      saldo_awal: 1500000,
      tanggal_saldo_awal: '2026-11-05',
    });
    expect(mockCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ nama: 'Cash', saldo_awal: 0 }));
    expect(mockUpdate).toHaveBeenCalledWith({ nama: 'Budi', onboarding_selesai: true });
    expect(mockEq).toHaveBeenCalledWith('id', 'u1');
  });

  it('gagal di tengah: pesan tampil, retry tidak menduplikasi dompet yang sudah dibuat', async () => {
    mockCreate
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ kind: 'offline', pesan: 'Tidak ada koneksi.' });
    await render(<DompetAwal />);
    await fireEvent.press(mulai());
    expect(await screen.findByText('Tidak ada koneksi.')).toBeTruthy();
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('GoPay')).toBeTruthy(); // form utuh
    await fireEvent.press(mulai());
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    const namaDibuat = mockCreate.mock.calls.map((c) => c[0].nama);
    expect(namaDibuat).toEqual(['GoPay', 'Cash', 'Cash', 'ShopeePay']); // GoPay sekali saja
  });

  it('gagal update profil: pesan tampil, retry hanya mengulang profil', async () => {
    mockEq.mockResolvedValueOnce({ error: { message: 'boom' } });
    await render(<DompetAwal />);
    await fireEvent.press(mulai());
    expect(await screen.findByText('boom')).toBeTruthy();
    expect(mockRefresh).not.toHaveBeenCalled();
    await fireEvent.press(mulai());
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });
});
