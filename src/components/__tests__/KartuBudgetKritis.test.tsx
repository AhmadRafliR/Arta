import { render, screen } from '@testing-library/react-native';
import { KartuBudgetKritis } from '../KartuBudgetKritis';

let mockBudgets: { data: unknown[] | undefined };
let mockTxs: { data: unknown[] | undefined };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ profile: { zona_waktu: 'Asia/Jakarta' } }) }));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    t: { mid: '#888', acc: '#0f0', fg: '#000', warn: '#ea0', warnInk: '#850', danger: '#d55', dangerInk: '#a22' },
  }),
}));
jest.mock('@/data/budgets', () => ({ useBudgets: () => mockBudgets }));
jest.mock('@/data/transactions', () => ({ useTransactions: () => mockTxs }));

const bln = jest.requireActual('@/lib/tanggal').hariIni('Asia/Jakarta').slice(0, 7);
const X = (id: string, nominal: number, kategori: string) => ({
  id,
  tanggal: `${bln}-02`,
  jenis: 'pengeluaran',
  kategori,
  nominal,
});

describe('KartuBudgetKritis', () => {
  it('budget seluruh kategori ikut dihitung dan tampil dengan label, bukan sentinel', async () => {
    mockBudgets = {
      data: [
        { id: 'a', kategori: 'makan', batas_bulanan: 1000000 },
        { id: 's', kategori: '__semua__', batas_bulanan: 500000 },
      ],
    };
    mockTxs = { data: [X('1', 300000, 'makan'), X('2', 250000, 'hobi')] };
    await render(<KartuBudgetKritis />);
    expect(screen.getByText('Seluruh kategori')).toBeTruthy();
    expect(screen.queryByText(/__semua__/)).toBeNull();
    expect(screen.getByText('Lewat budget Rp50.000')).toBeTruthy();
  });
});
