import { render, screen } from '@testing-library/react-native';
import { KeadaanKosong } from '../KeadaanKosong';

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: { mid: '#888888', fg2: '#444444' } }),
}));

describe('KeadaanKosong', () => {
  it('merender pesan dan ikon', async () => {
    await render(<KeadaanKosong ikon="cat-lainnya" pesan="Belum ada apa-apa." />);
    expect(screen.getByText('Belum ada apa-apa.')).toBeTruthy();
    expect(screen.getByTestId('ikon-cat-lainnya')).toBeTruthy();
  });
});
