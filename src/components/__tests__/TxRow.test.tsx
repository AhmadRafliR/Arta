import { render, screen } from '@testing-library/react-native';
import type { Tx } from '@/domain/types';
import { TxRow } from '../TxRow';

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: { fg2: '#555', fg: '#111' } }),
}));

const dasar: Tx = {
  id: 'x', tanggal: '2026-11-20', jenis: 'pengeluaran', kategori: null, nominal: 1000,
  wallet_id: 'g', wallet_tujuan_id: null, debt_id: null, porsi_bunga: null, porsi_pokok: null,
  catatan: null, transkrip: null, sumber: 'manual',
};
const nama = (id: string | null) => ({ g: 'GoPay', c: 'Cash', b: 'BCA' } as Record<string, string>)[id ?? ''] ?? null;

describe('TxRow', () => {
  it('pengeluaran dengan catatan', async () => {
    const tx = { ...dasar, kategori: 'makan', catatan: 'Makan siang', nominal: 28000 };
    await render(<TxRow tx={tx} namaDompet={nama} hariIni="2026-11-20" />);
    expect(screen.getByText('Makan siang')).toBeTruthy();
    expect(screen.getByText('Makan · GoPay · Hari ini')).toBeTruthy();
    expect(screen.getByText('-Rp28.000')).toBeTruthy();
    expect(screen.getByTestId('ikon-cat-makan')).toBeTruthy();
  });

  it('pemasukan tanpa catatan: judul = kategori kapital', async () => {
    const tx = { ...dasar, jenis: 'pemasukan' as const, kategori: 'ortu', wallet_id: 'b', tanggal: '2026-11-03', nominal: 750000 };
    await render(<TxRow tx={tx} namaDompet={nama} hariIni="2026-11-20" />);
    expect(screen.getByText('Ortu')).toBeTruthy();
    expect(screen.getByText('Ortu · BCA · 3 Nov')).toBeTruthy();
    expect(screen.getByText('+Rp750.000')).toBeTruthy();
  });

  it('transfer tanpa kategori', async () => {
    const tx = { ...dasar, jenis: 'transfer' as const, wallet_tujuan_id: 'c' };
    await render(<TxRow tx={tx} namaDompet={nama} />);
    expect(screen.getByText('Transfer')).toBeTruthy();
    expect(screen.getByText('GoPay → Cash')).toBeTruthy();
  });

  it('judul panjang dipotong satu baris', async () => {
    const tx = { ...dasar, catatan: 'Catatan yang sangat panjang sekali sampai tidak muat' };
    await render(<TxRow tx={tx} namaDompet={nama} />);
    expect(screen.getByText('Catatan yang sangat panjang sekali sampai tidak muat').props.numberOfLines).toBe(1);
  });
});
