import { fireEvent, render, screen } from '@testing-library/react-native';
import { KartuHutang } from '../KartuHutang';
import { buatHutang } from '@/domain/testFactories';

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ t: { fg2: '#555', warnInk: '#8A5A00', mid: '#888' } }),
}));

describe('KartuHutang', () => {
  it('sisa 0 menampilkan Lunas', async () => {
    await render(<KartuHutang hutang={buatHutang({ sisa_pokok: 0 })} hariIni="2026-11-20" onPress={jest.fn()} />);
    expect(screen.getByText('Lunas')).toBeTruthy();
    expect(screen.getByText('Rp0')).toBeTruthy();
  });

  it('cicilan: sub dan badge jatuh tempo, ketuk memanggil onPress', async () => {
    const onPress = jest.fn();
    const h = buatHutang({
      tipe: 'cicilan_tetap',
      sisa_pokok: 1_100_000,
      jumlah_tagihan: 12,
      tagihan_lunas: 1,
      jatuh_tempo_berikutnya: '2026-11-23',
    });
    await render(<KartuHutang hutang={h} hariIni="2026-11-20" onPress={onPress} />);
    expect(screen.getByText('Sisa pokok · 1 dari 12 cicilan lunas')).toBeTruthy();
    expect(screen.getByText('3 hari lagi')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Kredivo' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('berbunga: sub bunga dan metode', async () => {
    await render(<KartuHutang hutang={buatHutang({ bunga_persen_bulanan: 2, metode: 'efektif' })} hariIni="2026-11-20" onPress={jest.fn()} />);
    expect(screen.getByText('Sisa pokok · bunga 2%/bln efektif')).toBeTruthy();
  });
});
