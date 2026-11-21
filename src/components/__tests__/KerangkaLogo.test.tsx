import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { adaLogoDi, KerangkaLogo } from '../KerangkaLogo';

let mockSegmen: string[] = ['(tabs)'];
jest.mock('expo-router', () => ({ useSegments: () => mockSegmen }));
jest.mock('@/theme/ThemeProvider', () => ({ useTheme: () => ({ mode: 'terang' }) }));
jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  const dasar = { top: 30, bottom: 10, left: 0, right: 0 };
  const Konteks = React.createContext(null);
  return {
    SafeAreaInsetsContext: Konteks,
    useSafeAreaInsets: () => React.useContext(Konteks) ?? dasar,
  };
});

function Anak() {
  const { top } = useSafeAreaInsets();
  return <Text>{`inset-atas:${top}`}</Text>;
}

describe('adaLogoDi', () => {
  it('logo di semua grup kecuali login dan onboarding', () => {
    expect(adaLogoDi(['(tabs)'])).toBe(true);
    expect(adaLogoDi(['budget', 'index'])).toBe(true);
    expect(adaLogoDi([])).toBe(true);
    expect(adaLogoDi(['(auth)', 'masuk'])).toBe(false);
    expect(adaLogoDi(['(onboarding)', 'dompet-awal'])).toBe(false);
  });
});

describe('KerangkaLogo', () => {
  it('halaman biasa: logo arta tampil dan anak melihat inset atas 0 (tanpa jarak ganda)', async () => {
    mockSegmen = ['(tabs)'];
    await render(
      <KerangkaLogo>
        <Anak />
      </KerangkaLogo>,
    );
    expect(screen.getByTestId('bar-logo')).toBeTruthy();
    expect(screen.getByText('arta')).toBeTruthy();
    expect(screen.getByText('inset-atas:0')).toBeTruthy();
  });

  it('halaman login: tanpa logo dan inset atas asli diteruskan', async () => {
    mockSegmen = ['(auth)', 'masuk'];
    await render(
      <KerangkaLogo>
        <Anak />
      </KerangkaLogo>,
    );
    expect(screen.queryByTestId('bar-logo')).toBeNull();
    expect(screen.getByText('inset-atas:30')).toBeTruthy();
  });
});
