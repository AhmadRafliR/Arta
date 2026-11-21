import { act, render, screen } from '@testing-library/react-native';
import { AnimasiNabung } from '../AnimasiNabung';

let mockMode: 'terang' | 'gelap' = 'terang';
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: mockMode, t: jest.requireActual('@/theme/tokens').tokens[mockMode] }),
}));

let mockKurangiGerak = false;
jest.mock('react-native-reanimated', () => {
  const asli = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...asli, default: asli.default, useReducedMotion: () => mockKurangiGerak };
});

beforeEach(() => {
  mockMode = 'terang';
  mockKurangiGerak = false;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

const maju = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

describe('AnimasiNabung', () => {
  it.each(['terang', 'gelap'] as const)('merender svg celengan, 3 koin, 4 percikan, berlabel (%s)', async (m) => {
    mockMode = m;
    await render(<AnimasiNabung />);
    expect(screen.getByLabelText('Celengan arta sedang menabung')).toBeTruthy();
    expect(screen.getByTestId('nabung-svg')).toBeTruthy();
    for (const i of [0, 1, 2]) expect(screen.getByTestId(`nabung-koin-${i}`)).toBeTruthy();
    for (const i of [0, 1, 2, 3]) expect(screen.getByTestId(`nabung-percik-${i}`)).toBeTruthy();
  });

  it('ukuran bawaan 140 dan bisa diganti', async () => {
    const { rerender } = await render(<AnimasiNabung />);
    expect(screen.getByLabelText('Celengan arta sedang menabung')).toHaveStyle({ width: 140 });
    await rerender(<AnimasiNabung ukuran={120} />);
    expect(screen.getByLabelText('Celengan arta sedang menabung')).toHaveStyle({ width: 120 });
  });

  it('memanggil onSelesai setelah sekitar 1,8 detik, sekali', async () => {
    const onSelesai = jest.fn();
    await render(<AnimasiNabung onSelesai={onSelesai} />);
    await maju(1700);
    expect(onSelesai).not.toHaveBeenCalled();
    await maju(200);
    expect(onSelesai).toHaveBeenCalledTimes(1);
    await maju(5000);
    expect(onSelesai).toHaveBeenCalledTimes(1);
  });

  it('ulang: mengulang siklus sampai ulang=false lalu menyelesaikan siklus terakhir', async () => {
    const onSelesai = jest.fn();
    const { rerender } = await render(<AnimasiNabung ulang onSelesai={onSelesai} />);
    await maju(5500);
    expect(onSelesai).not.toHaveBeenCalled();
    await rerender(<AnimasiNabung ulang={false} onSelesai={onSelesai} />);
    await maju(1800);
    expect(onSelesai).toHaveBeenCalledTimes(1);
  });

  it('kurangi gerak: onSelesai cepat (sekitar 0,4 detik), koin tidak terlihat', async () => {
    mockKurangiGerak = true;
    const onSelesai = jest.fn();
    await render(<AnimasiNabung onSelesai={onSelesai} />);
    expect(screen.getByTestId('nabung-koin-0')).toHaveStyle({ opacity: 0 });
    await maju(450);
    expect(onSelesai).toHaveBeenCalledTimes(1);
  });

  it('unmount sebelum selesai: onSelesai tidak dipanggil', async () => {
    const onSelesai = jest.fn();
    const { unmount } = await render(<AnimasiNabung onSelesai={onSelesai} />);
    await unmount();
    await maju(3000);
    expect(onSelesai).not.toHaveBeenCalled();
  });
});
