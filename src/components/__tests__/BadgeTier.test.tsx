import { render, screen } from '@testing-library/react-native';
import { BadgeTier } from '../BadgeTier';

let mockMode: 'terang' | 'gelap' = 'terang';
jest.mock('@/theme/ThemeProvider', () => {
  const { tokens } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ mode: mockMode, t: tokens[mockMode] }) };
});

describe('BadgeTier', () => {
  it.each(['terang', 'gelap'] as const)('free: label & teks Free (%s)', async (m) => {
    mockMode = m;
    await render(<BadgeTier tier="free" />);
    expect(screen.getByLabelText('Paket Free')).toBeTruthy();
    expect(screen.getByText('Free')).toBeTruthy();
  });

  it.each(['terang', 'gelap'] as const)('pro: label & teks PRO putih (%s)', async (m) => {
    mockMode = m;
    await render(<BadgeTier tier="pro" />);
    expect(screen.getByLabelText('Paket Pro')).toBeTruthy();
    expect(screen.getByText('PRO')).toHaveStyle({ color: '#FFFFFF', letterSpacing: 1 });
  });

  it('free: warna dari token tema gelap', async () => {
    mockMode = 'gelap';
    await render(<BadgeTier tier="free" />);
    expect(screen.getByLabelText('Paket Free')).toHaveStyle({ backgroundColor: '#161618', borderColor: '#26262A' });
    expect(screen.getByText('Free')).toHaveStyle({ color: '#FFFFFF' });
  });

  it('tinggi menentukan bentuk pil', async () => {
    mockMode = 'terang';
    await render(<BadgeTier tier="free" tinggi={48} />);
    expect(screen.getByLabelText('Paket Free')).toHaveStyle({ height: 48, borderRadius: 24 });
  });
});
