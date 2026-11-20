import { render, screen } from '@testing-library/react-native';
import { IlustrasiKosong } from '../IlustrasiKosong';

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'terang',
    t: {
      ilusTintFrom: '#0B424F',
      ilusTintTo: '#1F6A76',
      ilusOnTint: '#FFFFFF',
      ilusAksen: '#52C3BF',
      ilusGaris: '#5B7C84',
    },
  }),
}));

describe('IlustrasiKosong', () => {
  it.each(['transaksi', 'hutang', 'laporan'] as const)('merender jenis %s', async (jenis) => {
    await render(<IlustrasiKosong jenis={jenis} />);
    expect(screen.getByTestId(`ilustrasi-${jenis}`, { includeHiddenElements: true })).toBeTruthy();
  });

  it('dekoratif: tersembunyi dari pembaca layar', async () => {
    await render(<IlustrasiKosong jenis="laporan" />);
    expect(screen.queryByTestId('ilustrasi-laporan')).toBeNull();
  });
});
