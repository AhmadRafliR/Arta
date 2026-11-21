import { fireEvent, render, screen } from '@testing-library/react-native';
import { T } from '@/domain/testFactories';
import type { Tx } from '@/domain/types';
import { DiagramPengeluaran } from '../DiagramPengeluaran';

let mockMode: 'terang' | 'gelap' = 'terang';
jest.mock('@/theme/ThemeProvider', () => ({ useTheme: () => ({ mode: mockMode, t: {} }) }));
jest.mock('react-native-reanimated', () => {
  const asli = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...asli, default: asli.default, useReducedMotion: () => true };
});

const tx = (nominal: number, kategori: string | null): Tx => ({
  ...T('pengeluaran', nominal, 'w', null, '2026-11-10'),
  id: `${nominal}-${kategori}`,
  kategori,
});
const DATA = [tx(360000, 'Makan'), tx(240000, 'Transport'), tx(100000, null)];

describe('DiagramPengeluaran', () => {
  beforeEach(() => {
    mockMode = 'terang';
  });

  it('merender legenda dan total', async () => {
    await render(<DiagramPengeluaran data={DATA} bulan="2026-11" />);
    expect(screen.getByText('Ke mana uangmu')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Makan, Rp360.000, 52 persen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Transport, Rp240.000, 34 persen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lainnya, Rp100.000, 14 persen' })).toBeTruthy();
    expect(screen.getByText('Rp700.000')).toBeTruthy();
    expect(screen.getByText('Pengeluaran bulan ini')).toBeTruthy();
  });

  it('label aksesibilitas ringkasan donut', async () => {
    await render(<DiagramPengeluaran data={DATA} bulan="2026-11" />);
    expect(screen.getByLabelText('Pengeluaran bulan ini Rp700.000; terbesar Makan 52%')).toBeTruthy();
  });

  it('ketuk baris menyorot lalu ketuk lagi kembali ke total', async () => {
    await render(<DiagramPengeluaran data={DATA} bulan="2026-11" />);
    await fireEvent.press(screen.getByRole('button', { name: /^Transport/ }));
    expect(screen.getAllByText('Transport').length).toBeGreaterThan(1);
    expect(screen.queryByText('Rp700.000')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Transport/ }));
    expect(screen.getByText('Rp700.000')).toBeTruthy();
    expect(screen.getByText('Pengeluaran bulan ini')).toBeTruthy();
  });

  it('ketuk irisan menyorot', async () => {
    await render(<DiagramPengeluaran data={DATA} bulan="2026-11" />);
    await fireEvent.press(screen.getByTestId('irisan-makan'));
    expect(screen.queryByText('Rp700.000')).toBeNull();
    expect(screen.getAllByText('Makan').length).toBeGreaterThan(1);
  });

  it('keadaan kosong, memuat, galat', async () => {
    const { rerender } = await render(<DiagramPengeluaran data={[]} bulan="2026-11" />);
    expect(screen.getByText('Belum ada pengeluaran bulan ini.')).toBeTruthy();
    expect(screen.queryByTestId('irisan-makan')).toBeNull();
    await rerender(<DiagramPengeluaran data={undefined} bulan="2026-11" />);
    expect(screen.getByText('Memuat…')).toBeTruthy();
    await rerender(<DiagramPengeluaran data={undefined} bulan="2026-11" galat="Gagal memuat" />);
    expect(screen.getByText('Gagal memuat')).toBeTruthy();
  });

  it('satu kategori: donut penuh dengan legenda', async () => {
    await render(<DiagramPengeluaran data={[tx(1000, 'Makan')]} bulan="2026-11" />);
    expect(screen.getByTestId('irisan-makan')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Makan, Rp1.000, 100 persen' })).toBeTruthy();
  });

  it.each([
    ['terang', '#2a78d6', '#9a9a96'],
    ['gelap', '#3987e5', '#6f6f6b'],
  ] as const)('warna titik legenda tema %s', async (m, utama, abu) => {
    mockMode = m;
    await render(<DiagramPengeluaran data={DATA} bulan="2026-11" />);
    expect(screen.getByTestId('titik-makan')).toHaveStyle({ backgroundColor: utama });
    expect(screen.getByTestId('titik-lainnya')).toHaveStyle({ backgroundColor: abu });
  });

  it('tautan Lihat riwayat memanggil callback', async () => {
    const onLihat = jest.fn();
    await render(<DiagramPengeluaran data={DATA} bulan="2026-11" onLihatRiwayat={onLihat} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Lihat riwayat' }));
    expect(onLihat).toHaveBeenCalled();
  });
});
