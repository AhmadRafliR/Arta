import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import DompetAwal from '../../../app/(onboarding)/dompet-awal';

const mockCreate = jest.fn();
const mockRefresh = jest.fn();
const mockEq = jest.fn();
const mockUpdate = jest.fn((_patch: unknown) => ({ eq: mockEq }));
let mockReduced = true;
let mockAuth: { session: unknown; profile: { nama: string | null } | null; refreshProfile: () => void };

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(() => ({ update: (p: unknown) => mockUpdate(p) })) },
}));
jest.mock('@/data/wallets', () => ({
  useCreateWallet: () => ({ mutateAsync: mockCreate }),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => mockAuth,
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: jest.requireActual('@/theme/tokens').tokens.terang }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-reanimated', () => {
  const asli = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...asli, default: asli.default, useReducedMotion: () => mockReduced };
});

const btn = (name: string) => screen.getByRole('button', { name });
const nonaktif = (name: string) => btn(name).props.accessibilityState?.disabled === true;
const lanjut = () => fireEvent.press(btn('Lanjut isi saldo'));
const simpan = () => btn('Simpan saldo awal');
const saldo = (i: number) => screen.getAllByPlaceholderText('0')[i]; // 0 GoPay, 1 Uang tunai, 2 Dana darurat, 3 target darurat
const cek = (name: string) => screen.getByRole('checkbox', { name });
const namaDibuat = () => mockCreate.mock.calls.map((c) => c[0].nama);

beforeEach(() => {
  jest.clearAllMocks();
  mockReduced = true;
  mockAuth = { session: { user: { id: 'u1' } }, profile: null, refreshProfile: mockRefresh };
  mockCreate.mockResolvedValue({});
  mockEq.mockResolvedValue({ error: null });
});

describe('Dompet awal: langkah 1 (pilih dompet)', () => {
  it('menampilkan topbar, intro, hero Rp0, dan saran dompet terpilih awal', async () => {
    await render(<DompetAwal />);
    expect(screen.getByText('arta')).toBeTruthy();
    expect(screen.getByLabelText('Langkah 1 dari 2')).toBeTruthy();
    expect(screen.getByText('Selamat datang')).toBeTruthy();
    expect(screen.getByText('Isi saldo awal dompetmu')).toBeTruthy();
    expect(screen.getByText('Total saldo awal')).toBeTruthy();
    expect(screen.getByText('Titik mulai hari ini')).toBeTruthy();
    expect(screen.getByText('Belum ada saldo terisi.')).toBeTruthy();
    expect(screen.getByText('Pilih dompet kamu')).toBeTruthy();
    expect(screen.getByText('3 dipilih')).toBeTruthy();
    for (const n of ['GoPay', 'Uang tunai', 'Rekening BCA', 'ShopeePay', 'Dana darurat']) expect(cek(n)).toBeTruthy();
    expect(cek('GoPay').props.accessibilityState.checked).toBe(true);
    expect(cek('ShopeePay').props.accessibilityState.checked).toBe(false);
    expect(screen.getByText('Tambah dompet lain')).toBeTruthy();
    expect(screen.getByText('Lewati, mulai dari Rp0')).toBeTruthy();
    expect(screen.queryByText('Saldo tiap dompet')).toBeNull();
    expect(screen.queryByText(/Lihat sistem desain/)).toBeNull();
  });

  it('mencentang dompet mengubah counter; tanpa pilihan Lanjut nonaktif', async () => {
    await render(<DompetAwal />);
    await fireEvent.press(cek('ShopeePay'));
    expect(screen.getByText('4 dipilih')).toBeTruthy();
    for (const n of ['GoPay', 'Uang tunai', 'Dana darurat', 'ShopeePay']) await fireEvent.press(cek(n));
    expect(screen.getByText('0 dipilih')).toBeTruthy();
    expect(nonaktif('Lanjut isi saldo')).toBe(true);
    expect(nonaktif('Lewati, mulai dari Rp0')).toBe(false);
  });

  it('sapaan memakai nama panggilan, dengan cadangan nama profil', async () => {
    mockAuth.profile = { nama: 'Sari Dewi' };
    await render(<DompetAwal />);
    expect(screen.getByText('Selamat datang, Sari')).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText('Nama panggilan'), ' Budi ');
    expect(screen.getByText('Selamat datang, Budi')).toBeTruthy();
  });

  it('sapaan memakai nama dari akun Google bila profil kosong', async () => {
    mockAuth = { session: { user: { id: 'u1', user_metadata: { full_name: 'Rafli Ahmad' } } }, profile: null, refreshProfile: mockRefresh };
    await render(<DompetAwal />);
    expect(screen.getByText('Selamat datang, Rafli')).toBeTruthy();
  });
});

describe('Dompet awal: langkah 2 (saldo tiap dompet)', () => {
  it('Lanjut membuka langkah 2; Kembali ke langkah 1', async () => {
    await render(<DompetAwal />);
    await lanjut();
    expect(screen.getByLabelText('Langkah 2 dari 2')).toBeTruthy();
    expect(screen.getByText('Berapa isinya sekarang?')).toBeTruthy();
    expect(screen.getByText('Saldo tiap dompet')).toBeTruthy();
    expect(screen.getByText('Rupiah')).toBeTruthy();
    expect(screen.getByText('Total dompet harian')).toBeTruthy();
    expect(screen.getByText('3 dompet')).toBeTruthy();
    expect(screen.getByText(/Saldo awal dicatat sebagai titik mulai, bukan pemasukan/)).toBeTruthy();
    expect(screen.getByText('Isi saldo di bawah atau kosongkan saja.')).toBeTruthy();
    expect(screen.getAllByPlaceholderText('0')).toHaveLength(4); // 3 saldo + target dana darurat
    await fireEvent.press(btn('Kembali'));
    expect(screen.getByText('Isi saldo awal dompetmu')).toBeTruthy();
    expect(screen.queryByText('Saldo tiap dompet')).toBeNull();
  });

  it('total live: hero, ringkasan harian/darurat, strip ikut berubah', async () => {
    await render(<DompetAwal />);
    await lanjut();
    await fireEvent.changeText(saldo(0), '1,5jt');
    expect(screen.getAllByText('Rp1.500.000').length).toBeGreaterThanOrEqual(3); // hero, harian, strip
    await fireEvent.changeText(saldo(2), '2jt');
    expect(screen.getAllByText('Rp3.500.000').length).toBeGreaterThanOrEqual(2); // hero + strip
    expect(screen.getByText('2 dompet terisi · total dana saat ini')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Isi GoPay Rp50.000' }));
    expect(screen.getAllByText('Rp2.050.000').length).toBeGreaterThanOrEqual(1); // harian
    expect(screen.getAllByText('Rp2.050.000').length).toBeLessThan(5);
  });

  it('nominal "abc" -> galat dan Simpan nonaktif; "0" dan kosong valid', async () => {
    await render(<DompetAwal />);
    await lanjut();
    await fireEvent.changeText(saldo(0), 'abc');
    expect(screen.getByText('Nominal tidak valid')).toBeTruthy();
    expect(nonaktif('Simpan saldo awal')).toBe(true);
    await fireEvent.changeText(saldo(0), '0');
    await fireEvent.changeText(saldo(1), '');
    expect(screen.queryByText('Nominal tidak valid')).toBeNull();
    expect(nonaktif('Simpan saldo awal')).toBe(false);
  });

  it('"153.267" -> pratinjau Rp153.267', async () => {
    await render(<DompetAwal />);
    await lanjut();
    await fireEvent.changeText(saldo(0), '153.267');
    expect(screen.getAllByText('Rp153.267').length).toBeGreaterThanOrEqual(1);
  });

  it('tambah dompet lain: pindah ke langkah 2, bagian "Dompet lain", nama kosong nonaktif, bisa dihapus', async () => {
    await render(<DompetAwal />);
    await fireEvent.press(btn('Tambah dompet lain'));
    expect(screen.getByLabelText('Langkah 2 dari 2')).toBeTruthy();
    expect(screen.getByText('Dompet lain')).toBeTruthy();
    expect(screen.getByText('4 dompet')).toBeTruthy();
    expect(screen.getByText('Isi nama dompet dulu.')).toBeTruthy();
    expect(nonaktif('Simpan saldo awal')).toBe(true);
    await fireEvent.changeText(screen.getByPlaceholderText('Nama dompet'), 'Bank Jago');
    expect(nonaktif('Simpan saldo awal')).toBe(false);
    await fireEvent.press(btn('Hapus dompet'));
    expect(screen.queryByText('Dompet lain')).toBeNull();
    expect(screen.getByText('3 dompet')).toBeTruthy();
  });

  it('nama dompet kembar (tak peduli huruf besar) -> pesan dan nonaktif', async () => {
    await render(<DompetAwal />);
    await fireEvent.press(btn('Tambah dompet lain'));
    await fireEvent.changeText(screen.getByPlaceholderText('Nama dompet'), 'gopay');
    expect(screen.getByText('Nama dompet tidak boleh sama.')).toBeTruthy();
    expect(nonaktif('Simpan saldo awal')).toBe(true);
    expect(nonaktif('Lewati, mulai dari Rp0')).toBe(true);
  });
});

describe('Dompet awal: menyimpan', () => {
  it('Simpan: buat dompet berurutan (tanggal lokal, target dana darurat), update profil, lalu layar selesai', async () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 5, 23, 30), doNotFake: ['setTimeout', 'clearTimeout', 'setImmediate', 'nextTick', 'queueMicrotask'] });
    try {
      await render(<DompetAwal />);
      await fireEvent.changeText(screen.getByPlaceholderText('Nama panggilan'), ' Budi ');
      await lanjut();
      await fireEvent.changeText(saldo(0), '1,5jt');
      await fireEvent.changeText(saldo(2), '3jt');
      await fireEvent.changeText(saldo(3), '6jt');
      await fireEvent.press(simpan());
      expect(await screen.findByText('Saldo awal tersimpan')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(mockCreate).toHaveBeenNthCalledWith(1, { nama: 'GoPay', tipe: 'harian', saldo_awal: 1500000, tanggal_saldo_awal: '2026-11-05' });
    expect(mockCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ nama: 'Uang tunai', tipe: 'harian', saldo_awal: 0 }));
    expect(mockCreate).toHaveBeenNthCalledWith(3, { nama: 'Dana darurat', tipe: 'darurat', saldo_awal: 3000000, tanggal_saldo_awal: '2026-11-05', target: 6000000 });
    expect(mockUpdate).toHaveBeenCalledWith({ nama: 'Budi', onboarding_selesai: true });
    expect(mockEq).toHaveBeenCalledWith('id', 'u1');
    expect(screen.getByText('Rp4.500.000')).toBeTruthy();
    expect(screen.getByText('2 dompet siap dipakai. Sekarang kamu bisa langsung mencatat transaksi pertama.')).toBeTruthy();
    expect(mockRefresh).not.toHaveBeenCalled(); // baru setelah "Catat transaksi pertama"
  });

  it('layar selesai: "Catat transaksi pertama" memanggil refreshProfile', async () => {
    await render(<DompetAwal />);
    await lanjut();
    await fireEvent.press(simpan());
    await screen.findByText('Saldo awal tersimpan');
    expect(screen.getByText('Semua dompet mulai dari Rp0. Catat transaksi pertama untuk mengisi saldo.')).toBeTruthy();
    expect(mockUpdate).toHaveBeenCalledWith({ nama: null, onboarding_selesai: true });
    expect(mockCreate).toHaveBeenNthCalledWith(3, expect.objectContaining({ tipe: 'darurat', target: null }));
    await fireEvent.press(btn('Catat transaksi pertama'));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('Lewati (langkah 1): dompet terpilih dibuat dengan saldo 0', async () => {
    await render(<DompetAwal />);
    await fireEvent.press(cek('ShopeePay'));
    await fireEvent.press(btn('Lewati, mulai dari Rp0'));
    await screen.findByText('Saldo awal tersimpan');
    expect(namaDibuat()).toEqual(['GoPay', 'Uang tunai', 'ShopeePay', 'Dana darurat']);
    expect(mockCreate.mock.calls.every((c) => c[0].saldo_awal === 0)).toBe(true);
    expect(screen.getByText('Kamu bisa mengisi saldo kapan saja dari layar Akun.')).toBeTruthy();
  });

  it('Lewati di langkah 2 mengabaikan nominal yang sudah diketik', async () => {
    await render(<DompetAwal />);
    await lanjut();
    await fireEvent.changeText(saldo(0), '1jt');
    await fireEvent.press(btn('Lewati, mulai dari Rp0'));
    await screen.findByText('Saldo awal tersimpan');
    expect(mockCreate.mock.calls.every((c) => c[0].saldo_awal === 0)).toBe(true);
    expect(screen.getByText('Rp0')).toBeTruthy();
  });

  it('Lewati tanpa dompet terpilih membuat "Cash" bawaan', async () => {
    await render(<DompetAwal />);
    for (const n of ['GoPay', 'Uang tunai', 'Dana darurat']) await fireEvent.press(cek(n));
    await fireEvent.press(btn('Lewati, mulai dari Rp0'));
    await screen.findByText('Saldo awal tersimpan');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ nama: 'Cash', tipe: 'harian', saldo_awal: 0 }));
  });

  it('gagal di tengah: galat tampil, retry tidak menduplikasi dompet yang sudah dibuat', async () => {
    mockCreate.mockResolvedValueOnce({}).mockRejectedValueOnce({ kind: 'offline', pesan: 'Tidak ada koneksi.' });
    await render(<DompetAwal />);
    await lanjut();
    await fireEvent.press(simpan());
    expect(await screen.findByText('Tidak ada koneksi.')).toBeTruthy();
    expect(screen.queryByText('Saldo awal tersimpan')).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
    await fireEvent.press(simpan());
    await screen.findByText('Saldo awal tersimpan');
    expect(namaDibuat()).toEqual(['GoPay', 'Uang tunai', 'Uang tunai', 'Dana darurat']); // GoPay sekali saja
  });

  it('setelah gagal sebagian: baris dibuat terkunci; retry hanya sisanya', async () => {
    mockCreate.mockResolvedValueOnce({}).mockRejectedValueOnce({ kind: 'offline', pesan: 'Tidak ada koneksi.' });
    await render(<DompetAwal />);
    await lanjut();
    await fireEvent.changeText(saldo(0), '5000');
    await fireEvent.press(simpan());
    expect(await screen.findByText('Tidak ada koneksi.')).toBeTruthy();
    expect(cek('GoPay').props.accessibilityState.disabled).toBe(true);
    expect(cek('Uang tunai').props.accessibilityState.disabled).toBe(false);
    expect(screen.getByText('sudah dibuat')).toBeTruthy();
    expect(saldo(0).props.editable).toBe(false);
    mockCreate.mockClear();
    await fireEvent.press(simpan());
    await screen.findByText('Saldo awal tersimpan');
    expect(namaDibuat()).toEqual(['Uang tunai', 'Dana darurat']);
    expect(screen.getByText('Rp5.000')).toBeTruthy(); // total mencakup dompet yang dibuat percobaan sebelumnya
  });

  it('nama baris terkunci tetap dihitung dalam cek nama kembar', async () => {
    mockCreate.mockResolvedValueOnce({}).mockRejectedValueOnce({ kind: 'lain', pesan: 'x' });
    await render(<DompetAwal />);
    await lanjut();
    await fireEvent.press(simpan());
    await screen.findByText('x');
    await fireEvent.press(btn('Tambah dompet lain'));
    await fireEvent.changeText(screen.getByPlaceholderText('Nama dompet'), 'GoPay');
    expect(nonaktif('Simpan saldo awal')).toBe(true);
  });

  it('gagal update profil: galat tampil, retry hanya mengulang profil', async () => {
    mockEq.mockResolvedValueOnce({ error: { message: 'boom' } });
    await render(<DompetAwal />);
    await lanjut();
    await fireEvent.press(simpan());
    expect(await screen.findByText('Terjadi kesalahan. Coba lagi.')).toBeTruthy();
    await fireEvent.press(simpan());
    await screen.findByText('Saldo awal tersimpan');
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it('23505 (dompet sudah ada) dianggap sudah dibuat', async () => {
    const dup = { kind: 'lain', pesan: 'Terjadi kesalahan. Coba lagi.', code: '23505' };
    mockCreate.mockRejectedValueOnce(dup).mockRejectedValueOnce(dup).mockRejectedValueOnce(dup);
    await render(<DompetAwal />);
    await lanjut();
    await fireEvent.press(simpan());
    await screen.findByText('Saldo awal tersimpan');
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(mockUpdate).toHaveBeenCalledWith({ nama: null, onboarding_selesai: true });
  });

  it('galat selain 23505 menghentikan proses', async () => {
    mockCreate.mockRejectedValueOnce({ kind: 'lain', pesan: 'Terjadi kesalahan. Coba lagi.', code: '42501' });
    await render(<DompetAwal />);
    await lanjut();
    await fireEvent.press(simpan());
    expect(await screen.findByText('Terjadi kesalahan. Coba lagi.')).toBeTruthy();
    expect(screen.queryByText('Saldo awal tersimpan')).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('ketuk Simpan dua kali saat berjalan: hanya satu proses', async () => {
    let selesai!: () => void;
    mockCreate.mockImplementationOnce(() => new Promise((r) => (selesai = () => r({}))));
    await render(<DompetAwal />);
    await lanjut();
    const pertama = fireEvent.press(simpan()); // tidak di-await: menunggu janji yang belum selesai
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    await fireEvent.press(simpan());
    await fireEvent.press(btn('Lewati, mulai dari Rp0'));
    selesai();
    await pertama;
    await screen.findByText('Saldo awal tersimpan');
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('Dompet awal: overlay "Akun siap"', () => {
  it('tanpa animasi (reduce motion): langsung ke form', async () => {
    await render(<DompetAwal />);
    expect(screen.queryByText('Akun siap')).toBeNull();
    expect(screen.getByText('Isi saldo awal dompetmu')).toBeTruthy();
  });

  it('dengan animasi: tampil ± 1,8 detik lalu menutup', async () => {
    mockReduced = false;
    jest.useFakeTimers();
    try {
      await render(<DompetAwal />);
      expect(screen.getByText('Akun siap')).toBeTruthy();
      expect(screen.getByText('Tinggal satu langkah: beri tahu uangmu ada di mana.')).toBeTruthy();
      expect(screen.queryByText('Isi saldo awal dompetmu')).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(1900);
      });
      expect(screen.queryByText('Akun siap')).toBeNull();
      expect(screen.getByText('Isi saldo awal dompetmu')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});
