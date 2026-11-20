import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthGate } from '../AuthGate';

let mockLoading = true;
jest.mock('../AuthProvider', () => ({
  useAuth: () => ({
    session: null,
    profile: null,
    loading: mockLoading,
    profileError: false,
    refreshProfile: jest.fn(),
    signOut: jest.fn(),
  }),
}));
jest.mock('expo-router', () => ({
  useSegments: () => ['(auth)'],
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang' }),
}));

describe('AuthGate', () => {
  it('memuat: menampilkan mark memuat di atas konten', async () => {
    mockLoading = true;
    await render(
      <AuthGate>
        <Text>konten</Text>
      </AuthGate>,
    );
    expect(screen.getByText('konten')).toBeTruthy();
    expect(screen.getByLabelText('Memuat')).toBeTruthy();
  });

  it('siap: tanpa mark memuat', async () => {
    mockLoading = false;
    await render(
      <AuthGate>
        <Text>konten</Text>
      </AuthGate>,
    );
    expect(screen.queryByLabelText('Memuat')).toBeNull();
  });
});
