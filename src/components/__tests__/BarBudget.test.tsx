import { fireEvent, render, screen } from '@testing-library/react-native';
import { BarBudget } from '../BarBudget';
import type { PemakaianBudget } from '@/domain/budget';

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    t: { fg: '#000', mid: '#888', acc: '#0f0', warn: '#ea0', warnInk: '#850', danger: '#d55', dangerInk: '#a22' },
  }),
}));

const P = (over: Partial<PemakaianBudget> = {}): PemakaianBudget => ({
  id: 'b1',
  kategori: 'makan',
  batas: 800000,
  terpakai: 320000,
  sisa: 480000,
  persen: 40,
  status: 'aman',
  ...over,
});

describe('BarBudget', () => {
  it('aman: nama berhuruf kapital, nilai, teks dan ikon status', async () => {
    await render(<BarBudget p={P()} />);
    expect(screen.getByText('Makan')).toBeTruthy();
    expect(screen.getByText('Rp320.000 / Rp800.000')).toBeTruthy();
    expect(screen.getByText('Aman, 40% terpakai')).toBeTruthy();
    expect(screen.getByTestId('ikon-status-budget-aman')).toBeTruthy();
    expect(screen.getByTestId('bar-isi').props.style).toMatchObject({ width: '40%', backgroundColor: '#0f0' });
  });

  it('waspada: teks dan ikon waspada, warna warn', async () => {
    await render(<BarBudget p={P({ terpakai: 704000, sisa: 96000, persen: 88, status: 'waspada' })} />);
    expect(screen.getByText('Hampir habis, 88% terpakai')).toBeTruthy();
    expect(screen.getByTestId('ikon-status-budget-waspada')).toBeTruthy();
    expect(screen.getByTestId('bar-isi').props.style).toMatchObject({ width: '88%', backgroundColor: '#ea0' });
  });

  it('lewat: lebar bar dibatasi 100%, teks lewat, warna danger', async () => {
    await render(<BarBudget p={P({ terpakai: 890000, sisa: -90000, persen: 111, status: 'lewat' })} />);
    expect(screen.getByText('Lewat budget Rp90.000')).toBeTruthy();
    expect(screen.getByTestId('ikon-status-budget-lewat')).toBeTruthy();
    expect(screen.getByTestId('bar-isi').props.style).toMatchObject({ width: '100%', backgroundColor: '#d55' });
  });

  it('accessibilityLabel lengkap dan onPress dipanggil', async () => {
    const onPress = jest.fn();
    await render(<BarBudget p={P()} onPress={onPress} />);
    const el = screen.getByRole('button', { name: 'Makan, Rp320.000 / Rp800.000, Aman, 40% terpakai' });
    await fireEvent.press(el);
    expect(onPress).toHaveBeenCalled();
  });
});
