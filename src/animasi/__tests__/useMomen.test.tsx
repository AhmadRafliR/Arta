import { act, renderHook, screen } from '@testing-library/react-native';
import { useMomen } from '../useMomen';
import { TransisiProvider } from '../TransisiProvider';

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: jest.requireActual('@/theme/tokens').tokens.terang }),
}));
jest.mock('react-native-reanimated', () => {
  const asli = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...asli, default: asli.default, useReducedMotion: () => false };
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useMomen', () => {
  it('di luar TransisiProvider tidak error dan tidak melakukan apa-apa', async () => {
    const { result } = await renderHook(() => useMomen());
    expect(() => result.current('Transaksi tersimpan')).not.toThrow();
  });

  it('di dalam TransisiProvider memutar overlay dengan judul yang diberikan', async () => {
    const { result } = await renderHook(() => useMomen(), { wrapper: TransisiProvider });
    await act(async () => {
      result.current('Budget tersimpan');
    });
    expect(screen.getByTestId('transisi-nabung')).toBeTruthy();
    expect(screen.getByText('Budget tersimpan')).toBeTruthy();
  });
});
