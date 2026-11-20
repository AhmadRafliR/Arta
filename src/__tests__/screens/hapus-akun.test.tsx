import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import HapusAkun from '../../../app/hapus-akun';

const mockBack = jest.fn();
const mockHapus = jest.fn();
const mockClear = jest.fn();
let mockPro = false;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: jest.fn() }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ clear: mockClear }),
}));
jest.mock('@/data/akun', () => ({ hapusAkun: () => mockHapus() }));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ t: { mid: '#888', fg: '#000', danger: '#d00', dangerInk: '#a00', warn: '#ea0', warnInk: '#850', accFg: '#000' } }),
}));
jest.mock('@/data/langganan', () => ({ usePro: () => ({ pro: mockPro, memuat: false }) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockPro = false;
  mockHapus.mockResolvedValue(undefined);
});

const tombolHapus = () => screen.getByRole('button', { name: 'Hapus akun permanen' });

describe('layar hapus akun', () => {
  it('tombol nonaktif sampai teks persis HAPUS', async () => {
    await render(<HapusAkun />);
    expect(tombolHapus().props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Ketik HAPUS'), 'hapus');
    expect(tombolHapus().props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Ketik HAPUS'), 'HAPUS');
    expect(tombolHapus().props.accessibilityState.disabled).toBe(false);
  });

  it('menekan tombol nonaktif tidak memanggil hapusAkun', async () => {
    await render(<HapusAkun />);
    await fireEvent.press(tombolHapus());
    expect(mockHapus).not.toHaveBeenCalled();
  });

  it('bukan Pro: tanpa peringatan langganan', async () => {
    await render(<HapusAkun />);
    expect(screen.queryByText(/tidak membatalkan langganan/)).toBeNull();
    expect(screen.queryByText('Kelola langganan')).toBeNull();
  });

  it('Pro: peringatan tampil dan Kelola langganan membuka halaman Play', async () => {
    mockPro = true;
    const buka = jest.spyOn(Linking, 'openURL').mockResolvedValue();
    await render(<HapusAkun />);
    expect(
      screen.getByText(
        'Menghapus akun tidak membatalkan langganan Google Play. Batalkan dulu di Play Store agar tidak ditagih lagi.',
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Kelola langganan' }));
    expect(buka).toHaveBeenCalledWith('https://play.google.com/store/account/subscriptions');
  });

  it('sukses: memanggil hapusAkun lalu membersihkan cache query', async () => {
    await render(<HapusAkun />);
    await fireEvent.changeText(screen.getByLabelText('Ketik HAPUS'), 'HAPUS');
    await fireEvent.press(tombolHapus());
    await waitFor(() => expect(mockClear).toHaveBeenCalled());
    expect(mockHapus).toHaveBeenCalledTimes(1);
  });

  it('galat: pesan tampil, cache tidak dibersihkan, bisa coba lagi', async () => {
    mockHapus.mockRejectedValueOnce({ kind: 'lain', pesan: 'Akun belum terhapus, coba lagi.' });
    await render(<HapusAkun />);
    await fireEvent.changeText(screen.getByLabelText('Ketik HAPUS'), 'HAPUS');
    await fireEvent.press(tombolHapus());
    expect(await screen.findByText('Akun belum terhapus, coba lagi.')).toBeTruthy();
    expect(mockClear).not.toHaveBeenCalled();
    expect(tombolHapus().props.accessibilityState.disabled).toBe(false);
  });

  it('Batal kembali ke layar sebelumnya', async () => {
    await render(<HapusAkun />);
    await fireEvent.press(screen.getByRole('button', { name: 'Batal' }));
    expect(mockBack).toHaveBeenCalled();
  });
});
