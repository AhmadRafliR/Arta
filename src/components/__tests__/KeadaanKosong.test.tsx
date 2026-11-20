import { render, screen } from '@testing-library/react-native';
import { KeadaanKosong } from '../KeadaanKosong';

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'terang',
    t: {
      mid: '#888888',
      fg2: '#444444',
      ilusTintFrom: '#0B424F',
      ilusTintTo: '#1F6A76',
      ilusOnTint: '#FFFFFF',
      ilusAksen: '#52C3BF',
      ilusGaris: '#5B7C84',
    },
  }),
}));

describe('KeadaanKosong', () => {
  it('merender pesan dan ikon', async () => {
    await render(<KeadaanKosong ikon="cat-lainnya" pesan="Belum ada apa-apa." />);
    expect(screen.getByText('Belum ada apa-apa.')).toBeTruthy();
    expect(screen.getByTestId('ikon-cat-lainnya')).toBeTruthy();
  });

  it('ilustrasi menggantikan lingkaran ikon', async () => {
    await render(<KeadaanKosong ilustrasi="hutang" ikon="nav-hutang" pesan="Belum ada hutang." />);
    expect(screen.getByText('Belum ada hutang.')).toBeTruthy();
    expect(screen.getByTestId('ilustrasi-hutang', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('ikon-nav-hutang', { includeHiddenElements: true })).toBeNull();
  });
});
