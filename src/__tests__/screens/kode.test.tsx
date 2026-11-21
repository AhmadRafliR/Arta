import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Kode from '../../../app/(auth)/kode';
import { ambilBaruMasuk, batalkanBaruMasuk } from '@/auth/baruMasuk';

const mockVerifyOtp = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { verifyOtp: (a: unknown) => mockVerifyOtp(a) } },
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: jest.requireActual('@/theme/tokens').tokens.terang }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ email: 'a@b.co' }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  batalkanBaruMasuk();
});

describe('Kode OTP: penanda baru masuk', () => {
  it('menandai baru masuk SEBELUM verifyOtp dipanggil (sesi bisa muncul sebelum await selesai)', async () => {
    let ditandaiSaatPanggil = false;
    mockVerifyOtp.mockImplementation(async () => {
      ditandaiSaatPanggil = ambilBaruMasuk();
      return { error: null };
    });
    await render(<Kode />);
    await fireEvent.changeText(screen.getByPlaceholderText('000000'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Verifikasi' }));
    await waitFor(() => expect(mockVerifyOtp).toHaveBeenCalledTimes(1));
    expect(ditandaiSaatPanggil).toBe(true);
  });

  it('kode salah: penanda dibatalkan', async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
    await render(<Kode />);
    await fireEvent.changeText(screen.getByPlaceholderText('000000'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Verifikasi' }));
    await waitFor(() => expect(mockVerifyOtp).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(ambilBaruMasuk()).toBe(false));
  });
});
