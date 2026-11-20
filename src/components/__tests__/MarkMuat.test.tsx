import { render, screen } from '@testing-library/react-native';
import { MarkMuat } from '../MarkMuat';

let mockMode: 'terang' | 'gelap' = 'terang';
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: mockMode }),
}));

let mockKurangiGerak = false;
jest.mock('react-native-reanimated', () => {
  const asli = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...asli, default: asli.default, useReducedMotion: () => mockKurangiGerak };
});

describe('MarkMuat', () => {
  beforeEach(() => {
    mockMode = 'terang';
    mockKurangiGerak = false;
  });

  it.each(['terang', 'gelap'] as const)('merender progressbar berlabel Memuat (%s)', async (m) => {
    mockMode = m;
    await render(<MarkMuat />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.getByLabelText('Memuat')).toBeTruthy();
  });

  it('ukuran bawaan 72', async () => {
    await render(<MarkMuat />);
    expect(screen.getByLabelText('Memuat')).toHaveStyle({ width: 72, height: 72 });
  });

  it('ukuran bisa diganti', async () => {
    await render(<MarkMuat ukuran={120} />);
    expect(screen.getByLabelText('Memuat')).toHaveStyle({ width: 120, height: 120 });
  });

  it('animasi: koin mulai tak terlihat di atas slot', async () => {
    await render(<MarkMuat />);
    expect(screen.getByTestId('koin-muat')).toHaveStyle({ opacity: 0 });
    expect(screen.getByTestId('glow-muat')).toHaveStyle({ opacity: 0.22 });
  });

  it('kurangi gerak: koin diam di slot, glow .35', async () => {
    mockKurangiGerak = true;
    await render(<MarkMuat />);
    expect(screen.getByTestId('koin-muat')).toHaveStyle({ opacity: 1 });
    expect(screen.getByTestId('glow-muat')).toHaveStyle({ opacity: 0.35 });
  });
});
