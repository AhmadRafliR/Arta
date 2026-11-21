import { fireEvent, render, screen } from '@testing-library/react-native';
import { MenuRencana } from '../MenuRencana';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/theme/ThemeProvider', () => {
  const { tokens } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ mode: 'terang', t: tokens.terang }) };
});

beforeEach(() => jest.clearAllMocks());

describe('MenuRencana', () => {
  it('menampilkan judul bagian dan badge Pro pada laporan', async () => {
    await render(<MenuRencana />);
    expect(screen.getByText('Rencana keuangan')).toBeTruthy();
    expect(screen.getByLabelText('Paket Pro')).toBeTruthy();
  });

  it.each([
    ['Budget', '/budget'],
    ['Dana darurat', '/dana-darurat'],
    ['Investasi', '/investasi'],
    ['Laporan email', '/laporan'],
  ])('menekan %s membuka %s', async (nama, rute) => {
    await render(<MenuRencana />);
    await fireEvent.press(screen.getByRole('button', { name: nama }));
    expect(mockPush).toHaveBeenCalledWith(rute);
  });

  it('Budget memanggil onBukaBudget (sheet) dan tidak pindah halaman', async () => {
    const buka = jest.fn();
    await render(<MenuRencana onBukaBudget={buka} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Budget' }));
    expect(buka).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
