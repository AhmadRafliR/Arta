import { render, screen } from '@testing-library/react-native';
import { HeroCard } from '../HeroCard';

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'terang',
    t: { heroFrom: '#0B424F', heroTo: '#1F6A76', heroFg: '#FFFFFF' },
  }),
}));

describe('HeroCard', () => {
  it('data Rafli: sisa uang, kekayaan bersih, chip dompet', async () => {
    await render(
      <HeroCard
        sisa={288000}
        kekayaan={7922717}
        dompet={[
          { id: 'g', nama: 'GoPay', saldo: 152000 },
          { id: 'c', nama: 'Cash', saldo: 106000 },
          { id: 's', nama: 'ShopeePay', saldo: 30000 },
        ]}
      />,
    );
    expect(screen.getByText('SISA UANG · SEMUA DOMPET')).toBeTruthy();
    expect(screen.getByText('Rp288.000')).toBeTruthy();
    expect(screen.getByText('Kekayaan bersih Rp7.922.717')).toBeTruthy();
    expect(screen.getByText('GoPay')).toBeTruthy();
    expect(screen.getByText('152rb')).toBeTruthy();
    expect(screen.getByText('30rb')).toBeTruthy();
  });
});
