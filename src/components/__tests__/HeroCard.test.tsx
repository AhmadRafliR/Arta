import { render, screen } from '@testing-library/react-native';
import { HeroCard } from '../HeroCard';

let mockHeroFg = '#FFFFFF';
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'terang',
    t: { heroFrom: '#0B424F', heroTo: '#1F6A76', get heroFg() { return mockHeroFg; }, heroSub: '#CCCCCC' },
  }),
}));

describe('HeroCard', () => {
  beforeEach(() => {
    mockHeroFg = '#FFFFFF';
  });

  it('data Rafli: sisa uang dan kekayaan bersih', async () => {
    await render(<HeroCard sisa={288000} kekayaan={7922717} />);
    expect(screen.getByText('SISA UANG · SEMUA DOMPET')).toBeTruthy();
    expect(screen.getByText('Rp288.000')).toBeTruthy();
    expect(screen.getByText('Kekayaan bersih Rp7.922.717')).toBeTruthy();
  });

  it('mode gelap: nominal memakai heroFg token', async () => {
    mockHeroFg = '#0B0B0C';
    await render(<HeroCard sisa={288000} kekayaan={7922717} />);
    expect(screen.getByText('Rp288.000')).toHaveStyle({ color: '#0B0B0C' });
  });
});
