import { fireEvent, render, screen } from '@testing-library/react-native';
import { SheetBudget } from '../SheetBudget';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/theme/ThemeProvider', () => {
  const { tokens } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ mode: 'terang', t: tokens.terang }) };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ profile: { zona_waktu: 'Asia/Jakarta' } }) }));
jest.mock('@/data/budgets', () => ({
  useBudgets: () => ({ data: [{ id: 'b1', kategori: 'makan', batas_bulanan: 1000000 }] }),
}));
jest.mock('@/data/transactions', () => ({ useTransactions: () => ({ data: [] }) }));

beforeEach(() => jest.clearAllMocks());

describe('SheetBudget', () => {
  it('menampilkan daftar budget dan tombol Tambah membuka form lalu menutup sheet', async () => {
    const tutup = jest.fn();
    await render(<SheetBudget terbuka onTutup={tutup} />);
    expect(screen.getByText('Makan')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tambah budget'));
    expect(tutup).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/budget/ubah');
  });

  it('mengetuk baris kategori membuka form ubah', async () => {
    await render(<SheetBudget terbuka onTutup={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: /Makan/ }));
    expect(mockPush).toHaveBeenCalledWith('/budget/ubah?id=b1');
  });
});
