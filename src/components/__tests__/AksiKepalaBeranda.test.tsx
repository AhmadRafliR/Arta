import { fireEvent, render, screen } from '@testing-library/react-native';
import { AksiKepalaBeranda } from '../AksiKepalaBeranda';

const mockPush = jest.fn();
const mockSetPref = jest.fn();
let mockMode = 'terang';
let mockTersedia = true;
let mockJumlah = 0;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: mockMode, t: { fg: '#0B424F' }, pref: 'sistem', setPref: mockSetPref }),
}));
jest.mock('@/notifikasi-dompet/useNotifikasiDompet', () => ({
  useNotifikasiDompet: () => ({ jumlah: mockJumlah, draf: [], bukaUntukCek: jest.fn() }),
}));
jest.mock('../../../modules/notifikasi-dompet', () => ({ tersedia: () => mockTersedia }));

beforeEach(() => {
  mockPush.mockClear();
  mockSetPref.mockClear();
  mockMode = 'terang';
  mockTersedia = true;
  mockJumlah = 0;
});

describe('AksiKepalaBeranda', () => {
  it('mode terang: ikon bulan, ketuk -> setPref gelap', async () => {
    await render(<AksiKepalaBeranda />);
    expect(screen.getByTestId('ikon-ui-moon')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ganti ke mode gelap'));
    expect(mockSetPref).toHaveBeenCalledWith('gelap');
  });

  it('mode gelap: ikon matahari, ketuk -> setPref terang', async () => {
    mockMode = 'gelap';
    await render(<AksiKepalaBeranda />);
    expect(screen.getByTestId('ikon-ui-sun')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ganti ke mode terang'));
    expect(mockSetPref).toHaveBeenCalledWith('terang');
  });

  it('tombol notifikasi tampil saat tersedia dan membuka layar pengaturan', async () => {
    await render(<AksiKepalaBeranda />);
    await fireEvent.press(screen.getByLabelText('Catat otomatis dari notifikasi'));
    expect(mockPush).toHaveBeenCalledWith('/notifikasi-dompet');
  });

  it('tombol notifikasi disembunyikan saat fitur tidak tersedia', async () => {
    mockTersedia = false;
    await render(<AksiKepalaBeranda />);
    expect(screen.queryByLabelText('Catat otomatis dari notifikasi')).toBeNull();
    expect(screen.getByLabelText('Ganti ke mode gelap')).toBeTruthy();
  });

  it('titik muncul hanya bila ada draf menunggu', async () => {
    const { rerender } = await render(<AksiKepalaBeranda />);
    expect(screen.queryByTestId('titik-notif')).toBeNull();
    mockJumlah = 2;
    await rerender(<AksiKepalaBeranda />);
    expect(screen.getByTestId('titik-notif')).toBeTruthy();
  });
});
