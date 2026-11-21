import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { GerbangIzinNotif, KUNCI_DIKENALKAN } from '../GerbangIzin';

const mockPush = jest.fn();
let mockSegmen: string[] = ['(tabs)'];
let mockTersedia = true;
let mockIzin = false;
let mockAktif = false;
let mockAppState: ((s: string) => void) | null = null;
const mockBukaPengaturan = jest.fn();
const mockSetAktif = jest.fn();
const mockSinkron = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useSegments: () => mockSegmen,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ t: { accFg: '#000', accInk: '#070', mid: '#888', fg: '#000', fg2: '#333', line: '#ccc', acc: '#0f0' } }),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } }, profile: { onboarding_selesai: true } }),
}));
jest.mock('../../../modules/notifikasi-dompet', () => ({
  tersedia: () => mockTersedia,
  izinAktif: () => mockIzin,
  aktif: () => mockAktif,
  bukaPengaturanIzin: () => mockBukaPengaturan(),
  setAktif: (v: boolean) => mockSetAktif(v),
}));
jest.mock('../useNotifikasiDompet', () => ({ sinkronAntrean: () => mockSinkron() }));

const platformAsli = Platform.OS;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockSegmen = ['(tabs)'];
  mockTersedia = true;
  mockIzin = false;
  mockAktif = false;
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

const sudahDikenalkan = () => AsyncStorage.setItem(KUNCI_DIKENALKAN, '1');

describe('GerbangIzinNotif', () => {
  it('pertama kali setelah dipasang: langsung membuka layar catat otomatis, tanpa popup', async () => {
    await render(<GerbangIzinNotif />);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/notifikasi-dompet'));
    expect(await AsyncStorage.getItem(KUNCI_DIKENALKAN)).toBe('1');
    expect(screen.queryByTestId('popup-izin-notif')).toBeNull();
  });

  it('izin belum diberikan: popup tampil; Aktifkan sekarang membuka pengaturan sistem', async () => {
    await sudahDikenalkan();
    await render(<GerbangIzinNotif />);
    expect(await screen.findByTestId('popup-izin-notif')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Aktifkan sekarang' }));
    expect(mockBukaPengaturan).toHaveBeenCalled();
    expect(screen.queryByTestId('popup-izin-notif')).toBeNull();
  });

  it('kembali dari pengaturan dengan izin: catat otomatis langsung dinyalakan', async () => {
    await sudahDikenalkan();
    await render(<GerbangIzinNotif />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Aktifkan sekarang' }));
    mockIzin = true;
    await act(async () => mockAppState?.('active'));
    expect(mockSetAktif).toHaveBeenCalledWith(true);
    expect(screen.queryByTestId('popup-izin-notif')).toBeNull();
  });

  it('Nanti menutup popup; muncul lagi saat app kembali aktif dan izin masih belum ada', async () => {
    await sudahDikenalkan();
    await render(<GerbangIzinNotif />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Nanti' }));
    expect(screen.queryByTestId('popup-izin-notif')).toBeNull();
    await act(async () => mockAppState?.('active'));
    expect(await screen.findByTestId('popup-izin-notif')).toBeTruthy();
  });

  it('Lihat cara kerjanya membuka layar catat otomatis', async () => {
    await sudahDikenalkan();
    await render(<GerbangIzinNotif />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Lihat cara kerjanya' }));
    expect(mockPush).toHaveBeenCalledWith('/notifikasi-dompet');
  });

  it('izin sudah ada, bukan Android, atau di luar tab utama: tidak tampil apa pun', async () => {
    await sudahDikenalkan();
    mockIzin = true;
    const { unmount } = await render(<GerbangIzinNotif />);
    await act(async () => {});
    expect(screen.queryByTestId('popup-izin-notif')).toBeNull();
    unmount();

    mockIzin = false;
    mockSegmen = ['(onboarding)', 'dompet-awal'];
    const r2 = await render(<GerbangIzinNotif />);
    await act(async () => {});
    expect(screen.queryByTestId('popup-izin-notif')).toBeNull();
    r2.unmount();

    mockSegmen = ['(tabs)'];
    Platform.OS = 'ios';
    await render(<GerbangIzinNotif />);
    await act(async () => {});
    expect(screen.queryByTestId('popup-izin-notif')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
