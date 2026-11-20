import { render, screen } from '@testing-library/react-native';
import { WalletChips } from '../WalletChips';

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'terang',
    t: { card: '#fff', line: '#ddd', fg: '#111', fg2: '#555' },
  }),
}));

const lima = [
  { id: '1', nama: 'GoPay', saldo: 152000, tipe: 'harian' as const },
  { id: '2', nama: 'Cash', saldo: 106000, tipe: 'harian' as const },
  { id: '3', nama: 'ShopeePay', saldo: 30000, tipe: 'harian' as const },
  { id: '4', nama: 'Dana', saldo: 5000, tipe: 'harian' as const },
  { id: '5', nama: 'Tabungan nikah 2027 BCA', saldo: 9000000, tipe: 'harian' as const },
];

describe('WalletChips', () => {
  it('menampilkan semua chip di rel horizontal', async () => {
    await render(<WalletChips dompet={lima} />);
    const rel = screen.getByTestId('rel-dompet');
    expect(rel.props.horizontal).toBe(true);
    for (const d of lima) expect(screen.getByText(d.nama)).toBeTruthy();
    expect(screen.getByText('152rb')).toBeTruthy();
    expect(screen.getAllByTestId('ikon-wallet-harian')).toHaveLength(5);
  });

  it('nama panjang dipotong satu baris', async () => {
    await render(<WalletChips dompet={lima} />);
    expect(screen.getByText('Tabungan nikah 2027 BCA').props.numberOfLines).toBe(1);
  });

  it('kosong tidak merender apa pun', async () => {
    await render(<WalletChips dompet={[]} />);
    expect(screen.queryByTestId('rel-dompet')).toBeNull();
  });
});
