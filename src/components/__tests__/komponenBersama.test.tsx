import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { tokens } from '@/theme/tokens';
import { BarJudul } from '../BarJudul';
import { BarisField } from '../BarisField';
import { Chip } from '../Chip';
import { KartuSeksi, LabelSub } from '../KartuSeksi';
import { Segmented } from '../Segmented';
import { DaftarDetail, KepalaSheet, SheetBawah } from '../SheetBawah';
import { Tombol } from '../Tombol';

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: require('@/theme/tokens').tokens.terang }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('komponen bersama (mockup arta)', () => {
  it('Chip: label, status terpilih, ikon opsional, dan onPress', async () => {
    const onPress = jest.fn();
    await render(<Chip label="GoPay" selected ikon="wallet-harian" onPress={onPress} />);
    const chip = screen.getByRole('button', { name: 'GoPay' });
    expect(chip.props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('ikon-wallet-harian')).toBeTruthy();
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Chip tanpa ikon tidak menggambar ikon', async () => {
    await render(<Chip label="Cash" selected={false} onPress={() => {}} />);
    expect(screen.queryByTestId('ikon-wallet-harian')).toBeNull();
  });

  it('Tombol: primary, bahaya, dan disabled tidak memanggil onPress', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <Tombol label="Simpan" primary onPress={onPress} />
        <Tombol label="Hapus" bahaya onPress={onPress} />
        <Tombol label="Nonaktif" disabled onPress={onPress} />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Hapus' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Nonaktif' }));
    expect(onPress).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Simpan')).toHaveStyle({ color: tokens.terang.accFg });
    expect(screen.getByText('Hapus')).toHaveStyle({ color: tokens.terang.dangerInk });
  });

  it('BarJudul: judul, tombol kembali hanya bila onKembali ada, slot kanan', async () => {
    const onKembali = jest.fn();
    const { rerender } = await render(<BarJudul judul="Catat" onKembali={onKembali} kanan={<Text>kanan</Text>} />);
    expect(screen.getByText('Catat')).toBeTruthy();
    expect(screen.getByText('kanan')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Kembali' }));
    expect(onKembali).toHaveBeenCalledTimes(1);
    await rerender(<BarJudul judul="Riwayat" />);
    expect(screen.queryByRole('button', { name: 'Kembali' })).toBeNull();
  });

  it('KartuSeksi: tag statis dan tag sebagai tombol', async () => {
    const onTag = jest.fn();
    await render(
      <>
        <KartuSeksi judul="Detail" tag="Pengeluaran">
          <LabelSub>Dompet</LabelSub>
        </KartuSeksi>
        <KartuSeksi judul="Jadwal" tag="Hari ini" onTag={onTag} />
      </>,
    );
    expect(screen.getByText('Pengeluaran')).toBeTruthy();
    expect(screen.getByText('Dompet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Hari ini' }));
    expect(onTag).toHaveBeenCalledTimes(1);
  });

  it('Segmented: menandai segmen aktif dan memanggil onChange', async () => {
    const onChange = jest.fn();
    await render(
      <Segmented
        nilai="tetap"
        onChange={onChange}
        pilihan={[
          { nilai: 'tetap', label: 'Cicilan tetap' },
          { nilai: 'bunga', label: 'Berbunga' },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Cicilan tetap' }).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Berbunga' }));
    expect(onChange).toHaveBeenCalledWith('bunga');
  });

  it('BarisField: label dan isi', async () => {
    await render(
      <BarisField ikon="nav-riwayat" label="Sisa tenor (bulan)" pertama>
        <Text>12</Text>
      </BarisField>,
    );
    expect(screen.getByText('Sisa tenor (bulan)')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByTestId('ikon-nav-riwayat')).toBeTruthy();
  });

  it('SheetBawah: isi tampil saat terbuka, tidak saat tertutup, scrim menutup', async () => {
    const onTutup = jest.fn();
    const { rerender } = await render(
      <SheetBawah terbuka onTutup={onTutup} testID="sheet">
        <KepalaSheet ikon="cat-makan" judul="Makan" sub="GoPay" kanan="Rp25.000" />
        <DaftarDetail baris={[{ label: 'Tanggal', nilai: '20 Nov 2026' }]} />
      </SheetBawah>,
    );
    expect(screen.getByText('Makan')).toBeTruthy();
    expect(screen.getByText('Rp25.000')).toBeTruthy();
    expect(screen.getByText('20 Nov 2026')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tutup' }));
    expect(onTutup).toHaveBeenCalledTimes(1);
    await rerender(
      <SheetBawah terbuka={false} onTutup={onTutup}>
        <Text>isi</Text>
      </SheetBawah>,
    );
    expect(screen.queryByText('isi')).toBeNull();
  });
});
