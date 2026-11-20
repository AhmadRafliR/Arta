import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import HutangSesuaikan from '../../../app/hutang/sesuaikan';

const mockSave = jest.fn();
const mockBack = jest.fn();
let mockId = 0;
const mockNewTxId = jest.fn(() => `id-${++mockId}`);

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'h1' }),
}));
jest.mock('@/data/transactions', () => ({
  useSaveTransactions: () => ({ mutateAsync: mockSave }),
  newTxId: () => mockNewTxId(),
}));
jest.mock('@/data/debts', () => ({
  useDebt: () => ({
    data: jest.requireActual('@/domain/testFactories').buatHutang({ sisa_pokok: 600000 }),
    isLoading: false,
    error: null,
  }),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' } }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: { accFg: '#000', mid: '#888', acc: '#0f0', fg: '#000' } }),
}));

const simpan = () => screen.getByRole('button', { name: 'Simpan' });
const nonaktif = () => simpan().props.accessibilityState?.disabled === true;

beforeEach(() => {
  jest.clearAllMocks();
  mockId = 0;
  mockSave.mockImplementation(async (items: unknown[]) => items);
});

describe('Sesuaikan sisa hutang', () => {
  it('600.000 -> 550.000: penyesuaian nominal 50000 tanpa dompet', async () => {
    await render(<HutangSesuaikan />);
    await fireEvent.changeText(screen.getByTestId('sisa-baru'), '550000');
    expect(screen.getByText('Rp600.000 → Rp550.000')).toBeTruthy();
    await fireEvent.press(simpan());
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockSave.mock.calls[0][0][0]).toMatchObject({
      id: 'id-1',
      jenis: 'penyesuaian',
      debt_id: 'h1',
      wallet_id: null,
      wallet_tujuan_id: null,
      nominal: 50000,
      kategori: 'penyesuaian',
      catatan: 'Sesuaikan sisa hutang',
      sumber: 'manual',
    });
  });

  it('600.000 -> 650.000: nominal negatif', async () => {
    await render(<HutangSesuaikan />);
    await fireEvent.changeText(screen.getByTestId('sisa-baru'), '650000');
    await fireEvent.press(simpan());
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockSave.mock.calls[0][0][0].nominal).toBe(-50000);
  });

  it('sama: "Sudah sama" dan Simpan nonaktif', async () => {
    await render(<HutangSesuaikan />);
    await fireEvent.changeText(screen.getByTestId('sisa-baru'), '600000');
    expect(screen.getByText('Sudah sama')).toBeTruthy();
    expect(nonaktif()).toBe(true);
  });
});
