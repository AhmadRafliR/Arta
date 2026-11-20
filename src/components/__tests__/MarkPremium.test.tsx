import { render, screen } from '@testing-library/react-native';
import { CREST_AKSEN, CREST_BADAN, MarkPremium } from '../MarkPremium';

let mockMode: 'terang' | 'gelap' = 'terang';
jest.mock('@/theme/ThemeProvider', () => {
  const { tokens } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ mode: mockMode, t: tokens[mockMode] }) };
});

describe('MarkPremium', () => {
  it.each([
    ['gradien', 'terang'],
    ['gradien', 'gelap'],
    ['mono', 'terang'],
    ['mono', 'gelap'],
  ] as const)('merender varian %s dengan label Premium (%s)', async (varian, m) => {
    mockMode = m;
    await render(<MarkPremium varian={varian} />);
    expect(screen.getByLabelText('Premium')).toBeTruthy();
  });

  it('dekoratif: tanpa label Premium', async () => {
    mockMode = 'terang';
    await render(<MarkPremium dekoratif />);
    expect(screen.queryByLabelText('Premium')).toBeNull();
  });

  it('mengekspor data bentuk crest untuk BadgeTier', () => {
    expect(CREST_BADAN.path).toMatch(/^M150 244/);
    expect(CREST_BADAN.rect).toHaveLength(2);
    expect(CREST_BADAN.lingkaran).toHaveLength(1);
    expect(CREST_AKSEN.lingkaran).toHaveLength(7);
  });
});
