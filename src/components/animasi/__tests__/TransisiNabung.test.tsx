import { act, render, screen } from '@testing-library/react-native';
import { TransisiNabung } from '../TransisiNabung';

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: jest.requireActual('@/theme/tokens').tokens.terang }),
}));
jest.mock('react-native-reanimated', () => {
  const asli = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...asli, default: asli.default, useReducedMotion: () => false };
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const maju = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

describe('TransisiNabung', () => {
  it('menampilkan judul, sub, dan label Memuat', async () => {
    await render(<TransisiNabung judul="Menyiapkan dompetmu" sub="Sebentar ya" onSelesai={jest.fn()} />);
    expect(screen.getByText('Menyiapkan dompetmu')).toBeTruthy();
    expect(screen.getByText('Sebentar ya')).toBeTruthy();
    expect(screen.getByLabelText('Memuat')).toBeTruthy();
  });

  it('memanggil onSelesai setelah minimal + fade keluar 250 ms', async () => {
    const onSelesai = jest.fn();
    await render(<TransisiNabung judul="Tes" onSelesai={onSelesai} />);
    await maju(1900);
    expect(onSelesai).not.toHaveBeenCalled();
    await maju(300);
    expect(onSelesai).toHaveBeenCalledTimes(1);
  });

  it('siap=false: terus berputar sampai siap, lalu menyelesaikan siklus terakhir', async () => {
    const onSelesai = jest.fn();
    const { rerender } = await render(<TransisiNabung judul="Tes" siap={false} onSelesai={onSelesai} />);
    await maju(6000);
    expect(onSelesai).not.toHaveBeenCalled();
    await rerender(<TransisiNabung judul="Tes" siap onSelesai={onSelesai} />);
    await maju(1800 + 250 + 50);
    expect(onSelesai).toHaveBeenCalledTimes(1);
  });

  it('minimalMs lebih panjang menahan overlay lebih lama', async () => {
    const onSelesai = jest.fn();
    await render(<TransisiNabung judul="Tes" minimalMs={3000} onSelesai={onSelesai} />);
    await maju(2200);
    expect(onSelesai).not.toHaveBeenCalled();
    await maju(1800);
    expect(onSelesai).toHaveBeenCalledTimes(1);
  });
});
