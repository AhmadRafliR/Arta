import { render, screen } from '@testing-library/react-native';
import { PeringatanBudget } from '../PeringatanBudget';

let mockBudgets: { data: unknown[] | undefined };
let mockTxs: { data: unknown[] | undefined };
const mockUseTransactions = jest.fn((_bulan: string) => mockTxs);

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ t: { fg: '#000', warnInk: '#850', dangerInk: '#a22' } }),
}));
jest.mock('@/data/budgets', () => ({ useBudgets: () => mockBudgets }));
jest.mock('@/data/transactions', () => ({ useTransactions: (b: string) => mockUseTransactions(b) }));

const B = (kategori: string, batas: number) => ({ id: `b-${kategori}`, kategori, batas_bulanan: batas });
const X = (id: string, nominal: number, kategori = 'transport') => ({
  id,
  tanggal: '2026-11-05',
  jenis: 'pengeluaran',
  kategori,
  nominal,
});

beforeEach(() => {
  mockBudgets = { data: [B('transport', 100000)] };
  mockTxs = { data: [X('t1', 90000)] };
  mockUseTransactions.mockClear();
});

describe('PeringatanBudget', () => {
  it('lewat: pesan dan ikon lewat', async () => {
    await render(<PeringatanBudget kategori="transport" nominal={24000} tanggal="2026-11-10" />);
    expect(screen.getByText('Lewat budget transport Rp14.000')).toBeTruthy();
    expect(screen.getByTestId('ikon-status-budget-lewat')).toBeTruthy();
    expect(mockUseTransactions).toHaveBeenCalledWith('2026-11');
  });

  it('waspada: pesan persen dan ikon waspada', async () => {
    mockTxs = { data: [X('t1', 50000)] };
    await render(<PeringatanBudget kategori="Transport" nominal={35000} tanggal="2026-11-10" />);
    expect(screen.getByText('Budget transport jadi 85% (Rp85.000 dari Rp100.000)')).toBeTruthy();
    expect(screen.getByTestId('ikon-status-budget-waspada')).toBeTruthy();
  });

  it('abaikanTxId: pengeluaran lama tidak dihitung dua kali', async () => {
    await render(<PeringatanBudget kategori="transport" nominal={24000} tanggal="2026-11-10" abaikanTxId="t1" />);
    expect(screen.queryByText(/Lewat budget/)).toBeNull();
    expect(screen.queryByText(/Budget transport jadi/)).toBeNull();
  });

  it('aman, tanpa budget kategori itu, belum dimuat, atau tanpa kategori: tidak tampil', async () => {
    mockTxs = { data: [X('t1', 10000)] };
    const { toJSON, rerender } = await render(<PeringatanBudget kategori="transport" nominal={1000} tanggal="2026-11-10" />);
    expect(toJSON()).toBeNull();
    await rerender(<PeringatanBudget kategori="makan" nominal={999999} tanggal="2026-11-10" />);
    expect(toJSON()).toBeNull();
    await rerender(<PeringatanBudget kategori={null} nominal={999999} tanggal="2026-11-10" />);
    expect(toJSON()).toBeNull();
    mockBudgets = { data: undefined };
    await rerender(<PeringatanBudget kategori="transport" nominal={999999} tanggal="2026-11-10" />);
    expect(toJSON()).toBeNull();
  });

  it('seluruh kategori: kategori apa pun menambah pemakaian, label Seluruh kategori', async () => {
    mockBudgets = { data: [B('__semua__', 100000)] };
    await render(<PeringatanBudget kategori="hobi" nominal={24000} tanggal="2026-11-10" />);
    expect(screen.getByText('Lewat budget Seluruh kategori Rp14.000')).toBeTruthy();
  });
});
