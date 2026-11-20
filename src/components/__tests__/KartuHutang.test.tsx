import { fireEvent, render, screen } from '@testing-library/react-native';
import { KartuHutang } from '../KartuHutang';
import { buatHutang } from '@/domain/testFactories';

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ t: { fg2: '#555', warnInk: '#8A5A00', mid: '#888', accInk: '#17726F' } }),
}));

describe('KartuHutang', () => {
  it('sisa 0 menampilkan Lunas', async () => {
    await render(<KartuHutang hutang={buatHutang({ sisa_pokok: 0 })} hariIni="2026-11-20" onPress={jest.fn()} />);
    expect(screen.getByText('Lunas')).toBeTruthy();
    expect(screen.getByText('Rp0')).toBeTruthy();
    expect(screen.getByText('Sudah lunas semua')).toBeTruthy();
    // Sudah lunas: tidak ada tombol Bayar meski onBayar diberikan.
    await render(
      <KartuHutang hutang={buatHutang({ sisa_pokok: 0 })} hariIni="2026-11-20" onPress={jest.fn()} onBayar={jest.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Bayar Kredivo' })).toBeNull();
  });

  it('cicilan: sub dan badge jatuh tempo, ketuk memanggil onPress', async () => {
    const onPress = jest.fn();
    const h = buatHutang({
      tipe: 'cicilan_tetap',
      sisa_pokok: 1_100_000,
      jumlah_tagihan: 12,
      tagihan_lunas: 1,
      nominal_cicilan: 100_000,
      jatuh_tempo_berikutnya: '2026-11-23',
    });
    await render(<KartuHutang hutang={h} hariIni="2026-11-20" onPress={onPress} />);
    expect(screen.getByText('1/12 lunas · Rp100.000/bln')).toBeTruthy();
    expect(screen.getByText('Cicilan tetap')).toBeTruthy();
    expect(screen.getByText('23 Nov 2026 · 3 hari lagi')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Kredivo' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('berbunga: sub bunga dan metode', async () => {
    await render(<KartuHutang hutang={buatHutang({ bunga_persen_bulanan: 2, metode: 'efektif' })} hariIni="2026-11-20" onPress={jest.fn()} />);
    expect(screen.getByText('Berbunga 2%/bln')).toBeTruthy();
    expect(screen.getByText('Pokok Rp1.000.000 · efektif')).toBeTruthy();
  });

  it('onBayar: tombol Bayar terpisah dari ketuk kartu', async () => {
    const onPress = jest.fn();
    const onBayar = jest.fn();
    await render(<KartuHutang hutang={buatHutang()} hariIni="2026-11-20" onPress={onPress} onBayar={onBayar} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Bayar Kredivo' }));
    expect(onBayar).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('diarsip: lencana Diarsip, tanpa tombol Bayar', async () => {
    await render(<KartuHutang hutang={buatHutang({ diarsip: true })} hariIni="2026-11-20" onPress={jest.fn()} onBayar={jest.fn()} />);
    expect(screen.getByText('Diarsip')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bayar Kredivo' })).toBeNull();
  });
});
