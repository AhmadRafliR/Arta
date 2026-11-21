import { render } from '@testing-library/react-native';
import { IKON, type NamaIkon } from '../data';
import { Ikon } from '../Ikon';
import { ikonDompet, ikonKategori } from '../peta';

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: { fg: '#0B424F' } }),
}));

const semua = Object.keys(IKON) as NamaIkon[];

describe('ikon arta', () => {
  it('berisi semua ikon arta (28 asli + ikon UI dari mockup)', () => {
    expect(semua).toHaveLength(61);
    expect(semua).toEqual(
      expect.arrayContaining(['nav-beranda', 'cat-lainnya', 'act-ekspor']),
    );
  });

  it.each(semua)('merender %s dengan testID', async (n) => {
    const { getByTestId } = await render(<Ikon nama={n} />);
    expect(getByTestId('ikon-' + n)).toBeTruthy();
  });

  it('ikonKategori memetakan nama kategori', () => {
    expect(ikonKategori('Makan')).toBe('cat-makan');
    expect(ikonKategori(' ROKOK ')).toBe('cat-rokok');
    expect(ikonKategori('Kopi')).toBe('cat-lainnya');
    expect(ikonKategori(null)).toBe('cat-lainnya');
  });

  it('ikonDompet memetakan tipe dompet', () => {
    expect(ikonDompet('darurat')).toBe('wallet-darurat');
    expect(ikonDompet('harian')).toBe('wallet-harian');
    expect(ikonDompet('investasi')).toBe('wallet-investasi');
  });
});
