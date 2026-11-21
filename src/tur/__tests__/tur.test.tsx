import { Platform, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { langkahUntuk, LANGKAH_TUR } from '../langkah';
import { jalurKotak, posisiKartu } from '../OverlayTur';
import { KUNCI_TUR, TurProvider, useTurOpsional } from '../TurProvider';
import { TargetTur } from '../TargetTur';
import { setelUlangLapisan } from '@/lib/lapisan';

const mockNavigate = jest.fn();
let mockSegmen: string[] = ['(tabs)'];
let mockPath = '/';
let mockTersedia = false;
let mockIzin = false;
let mockOnboarding = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
  useSegments: () => mockSegmen,
  usePathname: () => mockPath,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'terang',
    t: { acc: '#52C3BF', accInk: '#17726F', accFg: '#08343D', fg: '#0B424F', fg2: '#47646B', mid: '#52727A', line: '#DDE7EA' },
  }),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } }, profile: { onboarding_selesai: mockOnboarding } }),
}));
jest.mock('../../../modules/notifikasi-dompet', () => ({
  tersedia: () => mockTersedia,
  izinAktif: () => mockIzin,
  aktif: () => false,
  setAktif: jest.fn(),
  bukaPengaturanIzin: jest.fn(),
}));
jest.mock('../registry', () => {
  const asli = jest.requireActual('../registry');
  return { ...asli, ukur: jest.fn(async () => ({ x: 20, y: 120, w: 300, h: 80 })) };
});

const JEDA_NOL = { mulai: 0, navigasi: 0, gulir: 0, tungguTarget: 0 };
const platformAsli = Platform.OS;
const btn = (name: string) => screen.getByRole('button', { name });

function TombolUlang() {
  const tur = useTurOpsional();
  return (
    <Text accessibilityRole="button" accessibilityLabel="Ulangi" onPress={tur?.mulai}>
      ulangi
    </Text>
  );
}

function App() {
  return (
    <TurProvider jeda={JEDA_NOL}>
      <TargetTur id="beranda-saldo">
        <Text>kartu saldo</Text>
      </TargetTur>
      <TombolUlang />
    </TurProvider>
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  setelUlangLapisan();
  mockSegmen = ['(tabs)'];
  mockPath = '/';
  mockTersedia = false;
  mockIzin = false;
  mockOnboarding = true;
});

afterEach(() => {
  Platform.OS = platformAsli;
});

describe('langkah tur', () => {
  it('mencakup semua fitur utama dan langkah notifikasi hanya bila tersedia', () => {
    const id = LANGKAH_TUR.map((l) => l.id);
    for (const f of ['saldo', 'dompet', 'catat', 'riwayat', 'hutang', 'budget', 'darurat', 'investasi', 'laporan', 'notif']) {
      expect(id).toContain(f);
    }
    expect(langkahUntuk({ notifDompet: false }).map((l) => l.id)).not.toContain('notif');
    expect(langkahUntuk({ notifDompet: true }).map((l) => l.id)).toContain('notif');
    expect(id[0]).toBe('sambut');
    expect(id[id.length - 1]).toBe('selesai');
  });
});

describe('geometri sorotan', () => {
  it('jalur kotak bulat tertutup dan radius dibatasi setengah sisi', () => {
    const d = jalurKotak({ x: 0, y: 0, w: 40, h: 20 }, 999);
    expect(d.startsWith('M10 0')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('kartu di bawah target bila muat, di atas bila target di bawah, tengah tanpa target', () => {
    const aman = { top: 24, bottom: 16 };
    expect(posisiKartu({ x: 0, y: 100, w: 100, h: 80 }, 800, aman)).toEqual({ top: 194 });
    expect(posisiKartu({ x: 0, y: 720, w: 60, h: 60 }, 800, aman)).toEqual({ bottom: 94 });
    expect(posisiKartu(null, 800, aman)).toBeNull();
  });
});

describe('TurProvider', () => {
  it('pengguna baru: tur mulai otomatis, menyorot target, dan bisa dilewati', async () => {
    await render(<App />);
    expect(await screen.findByTestId('tur-kartu-sambut')).toBeTruthy();
    expect(screen.getByText('Kenalan dulu sama arta')).toBeTruthy();
    await fireEvent.press(btn('Mulai tur'));
    expect(await screen.findByTestId('tur-kartu-saldo')).toBeTruthy();
    expect(screen.getByText('LANGKAH 2 DARI ' + langkahUntuk({ notifDompet: false }).length)).toBeTruthy();
    await fireEvent.press(btn('Lewati tur'));
    await waitFor(() => expect(screen.queryByTestId('tur-overlay')).toBeNull());
    expect(await AsyncStorage.getItem(KUNCI_TUR)).toBe('1');
    expect(mockNavigate).toHaveBeenLastCalledWith('/');
  });

  it('Kembali ke langkah sebelumnya; tab dibuka sesuai langkah', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Mulai tur' }));
    await screen.findByTestId('tur-kartu-saldo');
    await fireEvent.press(btn('Kembali'));
    expect(await screen.findByTestId('tur-kartu-sambut')).toBeTruthy();
  });

  it('sampai selesai: Mulai pakai arta menutup tur dan menandai selesai', async () => {
    await render(<App />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Mulai tur' }));
    const daftar = langkahUntuk({ notifDompet: false });
    for (let i = 1; i < daftar.length - 1; i++) {
      await screen.findByTestId(`tur-kartu-${daftar[i].id}`);
      await fireEvent.press(btn('Lanjut'));
    }
    await screen.findByTestId('tur-kartu-selesai');
    expect(mockNavigate).toHaveBeenCalledWith('/riwayat');
    expect(mockNavigate).toHaveBeenCalledWith('/akun');
    await fireEvent.press(btn('Mulai pakai arta'));
    await waitFor(() => expect(screen.queryByTestId('tur-overlay')).toBeNull());
    expect(await AsyncStorage.getItem(KUNCI_TUR)).toBe('1');
  });

  it('sudah pernah selesai: tidak mulai otomatis, tapi bisa diulang manual', async () => {
    await AsyncStorage.setItem(KUNCI_TUR, '1');
    await render(<App />);
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());
    expect(screen.queryByTestId('tur-overlay')).toBeNull();
    await fireEvent.press(btn('Ulangi'));
    expect(await screen.findByTestId('tur-kartu-sambut')).toBeTruthy();
  });

  it('di luar tab utama atau onboarding belum selesai: tidak mulai', async () => {
    mockSegmen = ['(onboarding)', 'dompet-awal'];
    await render(<App />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('tur-overlay')).toBeNull();
  });

  it('Android dengan catat otomatis: menunggu layar catat otomatis diperkenalkan dulu', async () => {
    Platform.OS = 'android';
    mockTersedia = true;
    const { unmount } = await render(<App />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('tur-overlay')).toBeNull();
    unmount();
    await AsyncStorage.setItem('arta:notif-dompet-dikenalkan', '1');
    await render(<App />);
    expect(await screen.findByTestId('tur-kartu-sambut')).toBeTruthy();
    // Langkah catat otomatis ikut dalam tur di Android.
    expect(screen.getByText(`LANGKAH 1 DARI ${langkahUntuk({ notifDompet: true }).length}`)).toBeTruthy();
  });
});
