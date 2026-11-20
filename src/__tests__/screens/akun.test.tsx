import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import Akun from '../../../app/(tabs)/akun';

const mockPush = jest.fn();
const mockSignOut = jest.fn();
let mockStatus: { pro: boolean; periode?: string | null; berlakuSampai?: string | null; akanDiperpanjang?: boolean | null };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useFocusEffect: jest.fn(),
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({})) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/data/wallets', () => ({ useWallets: () => ({ data: [] }) }));
jest.mock('@/data/transactions', () => ({ useAllTransactions: () => ({ data: [] }) }));
jest.mock('@/data/langganan', () => ({ useStatusLangganan: () => ({ data: mockStatus }) }));
jest.mock('@/components/BadgeTier', () => {
  const { Text } = jest.requireActual('react-native');
  return { BadgeTier: ({ tier }: { tier: string }) => <Text className="font-sans">{`badge-${tier}`}</Text> };
});
jest.mock('@/components/PengaturanPengingat', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    PengaturanPengingat: ({ pro, onBukaPremium }: { pro: boolean; onBukaPremium: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={`pengingat-${pro}`} onPress={onBukaPremium}>
        <Text className="font-sans">pengingat</Text>
      </Pressable>
    ),
  };
});
// MenuRencana (rencana 4) punya badge Pro sendiri; diuji terpisah.
jest.mock('@/components/MenuRencana', () => ({ MenuRencana: () => null }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ signOut: mockSignOut }) }));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'sistem', setPref: jest.fn(), t: { accFg: '#000', mid: '#888', fg: '#000', dangerInk: '#a00' } }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = { pro: false };
});

it('Free: badge free, ekspor bertanda Pro, pengingat terkunci', async () => {
  await render(<Akun />);
  expect(screen.getByText('badge-free')).toBeTruthy();
  expect(screen.getByText('Free: catat AI 30× per bulan')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Ekspor data · Pro' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'pengingat-false' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Lihat Pro' }));
  expect(mockPush).toHaveBeenCalledWith('/premium');
  await fireEvent.press(screen.getByRole('button', { name: 'pengingat-false' }));
  expect(mockPush).toHaveBeenCalledWith('/premium?dari=pengingat');
});

it('Pro uji coba: badge pro dan tanggal berakhir', async () => {
  mockStatus = { pro: true, periode: 'trial', berlakuSampai: '2026-12-04T00:00:00Z', akanDiperpanjang: true };
  await render(<Akun />);
  expect(screen.getByText('badge-pro')).toBeTruthy();
  expect(screen.getByText('Uji coba Pro sampai 4 Des 2026')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'pengingat-true' })).toBeTruthy();
});

it('menu data & privasi membuka rute yang benar', async () => {
  mockStatus = { pro: true };
  await render(<Akun />);
  await fireEvent.press(screen.getByRole('button', { name: 'Ekspor data' }));
  expect(mockPush).toHaveBeenCalledWith('/ekspor');
  await fireEvent.press(screen.getByRole('button', { name: 'Hapus akun' }));
  expect(mockPush).toHaveBeenCalledWith('/hapus-akun');
  await fireEvent.press(screen.getByRole('button', { name: 'Kebijakan privasi' }));
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(expect.stringContaining('kebijakan-privasi'));
});

it('Keluar memanggil signOut', async () => {
  await render(<Akun />);
  await fireEvent.press(screen.getByRole('button', { name: 'Keluar' }));
  expect(mockSignOut).toHaveBeenCalled();
});
