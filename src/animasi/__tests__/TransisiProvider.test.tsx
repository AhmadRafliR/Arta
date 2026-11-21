import { act, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { TransisiProvider, useTransisi } from '../TransisiProvider';

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: jest.requireActual('@/theme/tokens').tokens.terang }),
}));
jest.mock('react-native-reanimated', () => {
  const asli = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...asli, default: asli.default, useReducedMotion: () => false };
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const ambil: { putar: ReturnType<typeof useTransisi>['putar'] } = { putar: () => Promise.resolve() };
function Ambil() {
  const v = useTransisi();
  useEffect(() => {
    ambil.putar = v.putar;
  }, [v]);
  return <Text className="font-sans">isi app</Text>;
}
const maju = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

describe('useTransisi', () => {
  it('galat bila dipakai di luar provider', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Ambil />)).rejects.toThrow('useTransisi harus dipakai di dalam TransisiProvider');
    err.mockRestore();
  });

  it('putar menampilkan overlay lalu resolve setelah keluar', async () => {
    await render(
      <TransisiProvider>
        <Ambil />
      </TransisiProvider>,
    );
    expect(screen.queryByTestId('transisi-nabung')).toBeNull();
    let selesai = false;
    await act(async () => {
      void ambil.putar({ judul: 'Menyiapkan dompetmu' }).then(() => {
        selesai = true;
      });
    });
    expect(screen.getByText('Menyiapkan dompetmu')).toBeTruthy();
    expect(screen.getByText('isi app', { includeHiddenElements: true })).toBeTruthy();
    await maju(1700);
    expect(selesai).toBe(false);
    await maju(500);
    expect(selesai).toBe(true);
    expect(screen.queryByTestId('transisi-nabung')).toBeNull();
  });

  it('tunggu: overlay bertahan sampai promise selesai', async () => {
    await render(
      <TransisiProvider>
        <Ambil />
      </TransisiProvider>,
    );
    let lepas!: () => void;
    const tunggu = new Promise<void>((r) => {
      lepas = r;
    });
    let selesai = false;
    await act(async () => {
      void ambil.putar({ judul: 'Tunggu', tunggu }).then(() => {
        selesai = true;
      });
    });
    await maju(6000);
    expect(selesai).toBe(false);
    expect(screen.getByText('Tunggu')).toBeTruthy();
    await act(async () => {
      lepas();
    });
    await maju(1800 + 300);
    expect(selesai).toBe(true);
    expect(screen.queryByText('Tunggu')).toBeNull();
  });
});
