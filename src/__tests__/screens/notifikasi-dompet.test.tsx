import { AppState, Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import NotifikasiDompet from '../../../app/notifikasi-dompet';

const mockBack = jest.fn();
let mockTersedia = true;
let mockIzin = false;
let mockAktif = false;
let mockTerakhir: unknown[] = [];
let mockAppState: ((s: string) => void) | null = null;
const mockBukaPengaturan = jest.fn();
const mockSetAktif = jest.fn();
const mockSinkron = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ t: { accFg: '#000', mid: '#888', fg: '#000', fg2: '#333', line: '#ccc', acc: '#0f0', warnInk: '#a60' } }),
}));
jest.mock('../../../modules/notifikasi-dompet', () => ({
  tersedia: () => mockTersedia,
  izinAktif: () => mockIzin,
  aktif: () => mockAktif,
  bukaPengaturanIzin: () => mockBukaPengaturan(),
  setAktif: (v: boolean) => mockSetAktif(v),
}));
jest.mock('@/notifikasi-dompet/useNotifikasiDompet', () => ({
  useNotifikasiTerakhir: () => mockTerakhir,
  sinkronAntrean: () => mockSinkron(),
}));

const platformAsli = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  mockTersedia = true;
  mockIzin = false;
  mockAktif = false;
  mockTerakhir = [];
  mockAppState = null;
  Platform.OS = 'android';
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_e: string, cb: (s: string) => void) => {
    mockAppState = cb;
    return { remove: jest.fn() };
  }) as never);
});

afterEach(() => {
  Platform.OS = platformAsli;
});

describe('layar Catat otomatis dari notifikasi', () => {
  it('judul, penjelasan cara kerja dan privasi, serta tips Xiaomi', async () => {
    await render(<NotifikasiDompet />);
    expect(screen.getByText('Catat otomatis dari notifikasi', { exact: true })).toBeTruthy();
    expect(screen.getByText(/tidak dikirim ke server/)).toBeTruthy();
    expect(screen.getByText(/hanya notifikasi GoPay dan ShopeePay yang dibaca/)).toBeTruthy();
    expect(screen.getByText(/HP Xiaomi\/HyperOS: matikan penghemat baterai/)).toBeTruthy();
  });

  it('status izin belum aktif, lalu aktif setelah app kembali dari pengaturan', async () => {
    await render(<NotifikasiDompet />);
    expect(screen.getByText('Belum aktif')).toBeTruthy();
    mockIzin = true;
    await act(() => mockAppState?.('active'));
    expect(screen.getByText('Aktif')).toBeTruthy();
  });

  it('tombol membuka pengaturan akses notifikasi', async () => {
    await render(<NotifikasiDompet />);
    await fireEvent.press(screen.getByRole('button', { name: 'Buka pengaturan akses notifikasi' }));
    expect(mockBukaPengaturan).toHaveBeenCalledTimes(1);
  });

  it('sakelar memanggil setAktif dan membaca ulang antrean', async () => {
    await render(<NotifikasiDompet />);
    const sakelar = screen.getByLabelText('Catat otomatis dari notifikasi');
    await fireEvent(sakelar, 'valueChange', true);
    expect(mockSetAktif).toHaveBeenCalledWith(true);
    expect(mockSinkron).toHaveBeenCalled();
    await fireEvent(screen.getByLabelText('Catat otomatis dari notifikasi'), 'valueChange', false);
    expect(mockSetAktif).toHaveBeenLastCalledWith(false);
  });

  it('daftar notifikasi terakhir menampilkan paket, judul, teks, dan status terbaca', async () => {
    mockTerakhir = [
      { kunci: 'a', paket: 'com.gojek.gopay', judul: 'Pembayaran berhasil', teks: 'Rp25.000 ke Kopi', waktu: 1_700_000_000_000, terbaca: true },
      { kunci: 'b', paket: 'com.shopee.id', judul: 'Promo', teks: 'Diskon s.d. 50%', waktu: 1_700_000_100_000, terbaca: false },
    ];
    await render(<NotifikasiDompet />);
    expect(screen.getByText('Notifikasi terakhir yang terbaca')).toBeTruthy();
    expect(screen.getByText('Pembayaran berhasil')).toBeTruthy();
    expect(screen.getByText('Rp25.000 ke Kopi')).toBeTruthy();
    expect(screen.getByText(/^com\.shopee\.id/)).toBeTruthy();
    expect(screen.getByText('Terbaca sebagai transaksi')).toBeTruthy();
    expect(screen.getByText('Bukan transaksi')).toBeTruthy();
  });

  it('di iOS/web: hanya tersedia di Android, tanpa kontrol', async () => {
    Platform.OS = 'ios';
    mockTersedia = false;
    await render(<NotifikasiDompet />);
    expect(screen.getByText('Fitur ini hanya tersedia di Android')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Buka pengaturan akses notifikasi' })).toBeNull();
    expect(screen.queryByLabelText('Catat otomatis dari notifikasi')).toBeNull();
  });

  it('Android tanpa modul native: meminta build baru', async () => {
    mockTersedia = false;
    await render(<NotifikasiDompet />);
    expect(screen.getByText('Modul belum terpasang di build ini')).toBeTruthy();
    expect(screen.queryByLabelText('Catat otomatis dari notifikasi')).toBeNull();
  });

  it('Tutup kembali ke layar sebelumnya', async () => {
    await render(<NotifikasiDompet />);
    await fireEvent.press(screen.getByRole('button', { name: 'Tutup' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
