import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Laporan from '../../../app/laporan';
import { geserBulan, hariIni } from '@/lib/tanggal';

const mockBack = jest.fn();
const mockTambah = jest.fn();
const mockHapus = jest.fn();
const mockVerifikasi = jest.fn();
const mockKirim = jest.fn();
let mockPro: boolean;
let mockDaftar: unknown[];

const P = (id: string, email: string, terverifikasi: boolean) => ({
  id,
  email,
  terverifikasi,
  verifikasi_dikirim_pada: null,
});

jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' } }),
}));
jest.mock('@/theme/ThemeProvider', () => {
  const { tokens } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ mode: 'terang', t: tokens.terang }) };
});
jest.mock('@/data/ai', () => ({
  useKuotaAi: () => ({ isPending: false, data: { bulan: '2026-11', terpakai: 0, batas: 10, pro: mockPro } }),
}));
jest.mock('@/data/laporan', () => ({
  usePenerima: () => ({ isPending: false, isError: false, data: mockDaftar }),
  useTambahPenerima: () => ({ mutateAsync: mockTambah, isPending: false }),
  useHapusPenerima: () => ({ mutate: mockHapus }),
  useKirimVerifikasi: () => ({ mutateAsync: mockVerifikasi }),
  useKirimLaporan: () => ({ mutateAsync: mockKirim, isPending: false }),
}));

const btn = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  jest.clearAllMocks();
  mockPro = true;
  mockDaftar = [];
  mockTambah.mockResolvedValue({
    penerima: P('n1', 'ortu@example.com', false),
    verifikasiTerkirim: true,
  });
  mockVerifikasi.mockResolvedValue({ terkirim: true });
  mockKirim.mockResolvedValue({ terkirim: 1, bulan: '2026-10' });
});

describe('Laporan email', () => {
  it('non-Pro: teks Pro dan tanpa aksi tambah/kirim', async () => {
    mockPro = false;
    await render(<Laporan />);
    expect(screen.getByText(/khusus Pro/)).toBeTruthy();
    expect(screen.getByText('Pro segera hadir.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Kirim laporan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tambah penerima' })).toBeNull();
    expect(screen.queryByLabelText('Email penerima')).toBeNull();
  });

  it('tombol Kembali memanggil router.back', async () => {
    await render(<Laporan />);
    await fireEvent.press(btn('Kembali'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('Pro: status terverifikasi dan menunggu tampil; kirim ulang memanggil verifikasi', async () => {
    mockDaftar = [P('a', 'a@example.com', true), P('b', 'b@example.com', false)];
    await render(<Laporan />);
    expect(screen.getByText('Terverifikasi')).toBeTruthy();
    expect(screen.getByText('Menunggu konfirmasi')).toBeTruthy();
    await fireEvent.press(btn('Kirim ulang b@example.com'));
    await waitFor(() => expect(mockVerifikasi).toHaveBeenCalledWith('b'));
    expect(await screen.findByText('Email konfirmasi dikirim ke b@example.com.')).toBeTruthy();
  });

  it('kirim ulang gagal menampilkan pesan server', async () => {
    mockDaftar = [P('b', 'b@example.com', false)];
    mockVerifikasi.mockRejectedValue({ kind: 'lain', pesan: 'Tunggu 10 menit.' });
    await render(<Laporan />);
    await fireEvent.press(btn('Kirim ulang b@example.com'));
    expect(await screen.findByText('Tunggu 10 menit.')).toBeTruthy();
  });

  it('tambah email memanggil useTambahPenerima lalu menampilkan konfirmasi', async () => {
    await render(<Laporan />);
    await fireEvent.changeText(screen.getByLabelText('Email penerima'), 'ortu@example.com');
    await fireEvent.press(btn('Tambah penerima'));
    await waitFor(() => expect(mockTambah).toHaveBeenCalledWith('ortu@example.com'));
    expect(await screen.findByText('Email konfirmasi dikirim ke ortu@example.com.')).toBeTruthy();
  });

  it('verifikasi gagal saat tambah: tampil pesan verifikasi', async () => {
    mockTambah.mockResolvedValue({
      penerima: P('n1', 'ortu@example.com', false),
      verifikasiTerkirim: false,
      pesanVerifikasi: 'Email belum terkirim.',
    });
    await render(<Laporan />);
    await fireEvent.changeText(screen.getByLabelText('Email penerima'), 'ortu@example.com');
    await fireEvent.press(btn('Tambah penerima'));
    expect(await screen.findByText('Email belum terkirim.')).toBeTruthy();
  });

  it('galat tambah ditampilkan', async () => {
    mockTambah.mockRejectedValue({ kind: 'validasi', pesan: 'Alamat email tidak valid' });
    await render(<Laporan />);
    await fireEvent.changeText(screen.getByLabelText('Email penerima'), 'x');
    await fireEvent.press(btn('Tambah penerima'));
    expect(await screen.findByText('Alamat email tidak valid')).toBeTruthy();
  });

  it('3 penerima: formulir hilang, tampil batas maksimal', async () => {
    mockDaftar = [P('a', 'a@example.com', true), P('b', 'b@example.com', true), P('c', 'c@example.com', false)];
    await render(<Laporan />);
    expect(screen.getByText('Maksimal 3 penerima.')).toBeTruthy();
    expect(screen.queryByLabelText('Email penerima')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tambah penerima' })).toBeNull();
  });

  it('hapus meminta konfirmasi lalu memanggil useHapusPenerima', async () => {
    mockDaftar = [P('a', 'a@example.com', true)];
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<Laporan />);
    await fireEvent.press(btn('Hapus a@example.com'));
    expect(mockHapus).not.toHaveBeenCalled();
    const tombol = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    tombol.find((x) => x.text === 'Hapus')?.onPress?.();
    expect(mockHapus.mock.calls[0][0]).toBe('a');
    alert.mockRestore();
  });

  it('tanpa penerima terverifikasi: tombol kirim nonaktif dengan alasan', async () => {
    mockDaftar = [P('b', 'b@example.com', false)];
    await render(<Laporan />);
    expect(btn('Kirim laporan')).toBeDisabled();
    expect(screen.getByText('Belum ada penerima terverifikasi.')).toBeTruthy();
  });

  it('kirim bulan lalu memakai geserBulan dan menampilkan pesan sukses', async () => {
    mockDaftar = [P('a', 'a@example.com', true)];
    const bulanIni = hariIni('Asia/Jakarta').slice(0, 7);
    await render(<Laporan />);
    await fireEvent.press(btn('Bulan lalu'));
    await fireEvent.press(btn('Kirim laporan'));
    await waitFor(() => expect(mockKirim).toHaveBeenCalledWith({ bulan: geserBulan(bulanIni, -1) }));
    expect(await screen.findByText(/terkirim ke 1 penerima\.$/)).toBeTruthy();
  });

  it('kirim bulan ini (bawaan) dan galat server ditampilkan', async () => {
    mockDaftar = [P('a', 'a@example.com', true)];
    mockKirim.mockRejectedValue({ kind: 'lain', pesan: 'Batas kirim tercapai.' });
    const bulanIni = hariIni('Asia/Jakarta').slice(0, 7);
    await render(<Laporan />);
    await fireEvent.press(btn('Kirim laporan'));
    await waitFor(() => expect(mockKirim).toHaveBeenCalledWith({ bulan: bulanIni }));
    expect(await screen.findByText('Batas kirim tercapai.')).toBeTruthy();
  });
});
