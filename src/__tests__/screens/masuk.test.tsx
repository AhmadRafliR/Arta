import { render, screen } from '@testing-library/react-native';
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
});
