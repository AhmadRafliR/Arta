import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthGate } from '../AuthGate';
import { ambilBaruMasuk, batalkanBaruMasuk, tandaiBaruMasuk } from '../baruMasuk';
import { TransisiProvider } from '@/animasi/TransisiProvider';

let mockLoading = true;
let mockSession: { user: { id: string } } | null = null;
let mockProfile: { onboarding_selesai: boolean } | null = null;
jest.mock('../AuthProvider', () => ({
  useAuth: () => ({
    session: mockSession,
    profile: mockProfile,
    loading: mockLoading,
    profileError: false,
    refreshProfile: jest.fn(),
    signOut: jest.fn(),
  }),
}));
jest.mock('expo-router', () => ({
  useSegments: () => ['(auth)'],
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: jest.requireActual('@/theme/tokens').tokens.terang }),
}));

const bungkus = (ui: React.ReactElement) => <TransisiProvider>{ui}</TransisiProvider>;

beforeEach(() => {
  mockSession = null;
  mockProfile = null;
  batalkanBaruMasuk();
});

describe('AuthGate', () => {
  it('memuat: menampilkan mark memuat di atas konten', async () => {
    mockLoading = true;
    await render(
      bungkus(
        <AuthGate>
          <Text className="font-sans">konten</Text>
        </AuthGate>,
      ),
    );
    expect(screen.getByText('konten')).toBeTruthy();
    expect(screen.getByLabelText('Memuat')).toBeTruthy();
  });

  it('siap: tanpa mark memuat', async () => {
    mockLoading = false;
    await render(
      bungkus(
        <AuthGate>
          <Text className="font-sans">konten</Text>
        </AuthGate>,
      ),
    );
    expect(screen.queryByLabelText('Memuat')).toBeNull();
  });

  it('baru masuk (ditandai): memutar transisi sampai profil termuat, lalu menutup', async () => {
    jest.useFakeTimers();
    try {
      mockLoading = true;
      mockSession = { user: { id: 'u1' } };
      tandaiBaruMasuk();
      const ui = (
        <AuthGate>
          <Text className="font-sans">konten</Text>
        </AuthGate>
      );
      await render(bungkus(ui));
      expect(screen.getByText('Menyiapkan dompetmu')).toBeTruthy();
      expect(ambilBaruMasuk()).toBe(false); // penanda dihabiskan
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(screen.getByText('Menyiapkan dompetmu')).toBeTruthy(); // profil belum siap: tetap menutupi
    } finally {
      jest.useRealTimers();
    }
  });

  it('sesi tersimpan (tanpa penanda): tidak memutar transisi', async () => {
    mockLoading = true;
    mockSession = { user: { id: 'u1' } };
    await render(
      bungkus(
        <AuthGate>
          <Text className="font-sans">konten</Text>
        </AuthGate>,
      ),
    );
    expect(screen.queryByText('Menyiapkan dompetmu')).toBeNull();
  });
});
