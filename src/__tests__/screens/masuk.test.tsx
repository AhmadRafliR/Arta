import { fireEvent, render, screen } from '@testing-library/react-native';
import { supabase } from '@/lib/supabase';
import Masuk from '../../../app/(auth)/masuk';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithOtp: jest.fn(), signInWithIdToken: jest.fn() } },
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: { fg: '#000' } }),
}));

describe('layar masuk', () => {
  it('menampilkan merek arta', async () => {
    await render(<Masuk />);
    expect(screen.getByText('arta')).toBeTruthy();
    expect(screen.getByText('OWN YOUR MONEY')).toBeTruthy();
    expect(screen.getByText('Masuk')).toBeTruthy();
  });

  it('mark tidak diumumkan ganda; submit email mengirim kode', async () => {
    (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({ error: null });
    await render(<Masuk />);
    expect(screen.queryByLabelText('arta')).toBeNull();
    const email = screen.getByPlaceholderText('Email');
    await fireEvent.changeText(email, 'a@b.co');
    await fireEvent(email, 'submitEditing');
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'a@b.co' });
  });

  it('kirim dua kali cepat (keyboard + tombol) hanya mengirim satu kode', async () => {
    const otp = supabase.auth.signInWithOtp as jest.Mock;
    otp.mockReset();
    otp.mockReturnValue(new Promise(() => {})); // permintaan masih berjalan
    await render(<Masuk />);
    const email = screen.getByPlaceholderText('Email');
    await fireEvent.changeText(email, 'a@b.co');
    await fireEvent(email, 'submitEditing');
    await fireEvent(email, 'submitEditing');
    expect(otp).toHaveBeenCalledTimes(1);
  });

  it('tombol Google selalu tampil; tanpa client ID menjelaskan belum dikonfigurasi', async () => {
    await render(<Masuk />);
    await fireEvent.press(screen.getByRole('button', { name: 'Masuk dengan Google' }));
    expect(screen.getByText(/belum dikonfigurasi/)).toBeTruthy();
    expect(supabase.auth.signInWithIdToken).not.toHaveBeenCalled();
  });
});
