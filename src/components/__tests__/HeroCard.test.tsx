import { fireEvent, render, screen } from '@testing-library/react-native';
import { HeroCard } from '../HeroCard';

const mockNavigate = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate, push: mockPush }) }));

let mockKartuFg = '#0B424F';
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'terang',
    t: {
      fg: '#0B424F',
      kartuFrom: '#FFFFFF',
      kartuTo: '#E3F1F5',
      get kartuFg() {
        return mockKartuFg;
      },
      kartuSub: '#52727A',
      kartuLine: '#DDE7EA',
      aksiBg: '#178F8B',
      aksiFg: '#FFFFFF',
    },
  }),
}));

describe('HeroCard', () => {
  beforeEach(() => {
    mockKartuFg = '#0B424F';
    mockNavigate.mockClear();
    mockPush.mockClear();
  });

  it('data Rafli: sisa uang dan kekayaan bersih', async () => {
    await render(<HeroCard sisa={288000} kekayaan={7922717} />);
    expect(screen.getByText('SISA UANG · SEMUA DOMPET')).toBeTruthy();
    expect(screen.getByText('Rp288.000')).toBeTruthy();
    expect(screen.getByText('Kekayaan bersih Rp7.922.717')).toBeTruthy();
  });

  it('mode gelap: nominal memakai token kartuFg', async () => {
    mockKartuFg = '#FFFFFF';
    await render(<HeroCard sisa={288000} kekayaan={7922717} />);
    expect(screen.getByText('Rp288.000')).toHaveStyle({ color: '#FFFFFF' });
  });

  it('menampilkan tiga tombol aksi berlabel', async () => {
    await render(<HeroCard sisa={288000} kekayaan={7922717} />);
    expect(screen.getByText('Catat')).toBeTruthy();
    expect(screen.getByText('Hutang')).toBeTruthy();
    expect(screen.getByText('Riwayat')).toBeTruthy();
    expect(screen.getByText('Riwayat')).toHaveStyle({ color: '#0B424F' });
  });

  it('Catat membuka layar /catat', async () => {
    await render(<HeroCard sisa={288000} kekayaan={7922717} />);
    fireEvent.press(screen.getByRole('button', { name: 'Catat transaksi' }));
    expect(mockPush).toHaveBeenCalledWith('/catat');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('Hutang pindah ke tab /hutang', async () => {
    await render(<HeroCard sisa={288000} kekayaan={7922717} />);
    fireEvent.press(screen.getByRole('button', { name: 'Buka hutang' }));
    expect(mockNavigate).toHaveBeenCalledWith('/hutang');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('Riwayat pindah ke tab /riwayat', async () => {
    await render(<HeroCard sisa={288000} kekayaan={7922717} />);
    fireEvent.press(screen.getByRole('button', { name: 'Buka riwayat' }));
    expect(mockNavigate).toHaveBeenCalledWith('/riwayat');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
