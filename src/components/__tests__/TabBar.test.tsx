import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { TabBar } from '../TabBar';
import { NavPulauProvider, useNavPulau } from '@/nav/NavPulauProvider';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({
    mode: 'terang',
    t: {
      card: '#fff',
      line: '#ddd',
      fg: '#111',
      mid: '#888',
      acc: '#52C3BF',
      accFg: '#0B424F',
      accInk: '#1F6A76',
      heroFrom: '#0B424F',
    },
  }),
}));

type Props = ComponentProps<typeof TabBar>;

const routes = ['index', 'riwayat', 'hutang', 'akun'].map((name) => ({ key: `${name}-key`, name }));
const navigateToTab = jest.fn();
const emit = jest.fn(() => ({ defaultPrevented: false }));
const props = {
  state: { index: 0, routes },
  emitter: { emit },
  navigateToTab,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
} as unknown as Props;

let api: ReturnType<typeof useNavPulau>;
function Pengendali() {
  api = useNavPulau();
  return null;
}

async function tampilkan() {
  await render(
    <NavPulauProvider>
      <Pengendali />
      <TabBar {...props} />
    </NavPulauProvider>,
  );
}

const LABEL = ['Beranda', 'Riwayat', 'Hutang', 'Akun'];

describe('TabBar', () => {
  beforeEach(() => jest.clearAllMocks());

  it('4 tab berlabel, Beranda terpilih, ikon nav', async () => {
    await tampilkan();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    LABEL.forEach((l) => expect(screen.getByLabelText(l)).toBeTruthy());
    expect(screen.getByLabelText('Beranda').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByLabelText('Riwayat').props.accessibilityState).toEqual({ selected: false });
    expect(screen.getByTestId('ikon-nav-riwayat')).toBeTruthy();
    expect(screen.getByTestId('ikon-nav-mic')).toBeTruthy();
  });

  it('tekan tab pindah rute; tekan mic membuka /catat', async () => {
    await tampilkan();
    await fireEvent.press(screen.getByLabelText('Riwayat'));
    expect(emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'riwayat-key', canPreventDefault: true });
    expect(navigateToTab).toHaveBeenCalledWith('riwayat-key');
    await fireEvent.press(screen.getByLabelText('Catat transaksi'));
    expect(mockPush).toHaveBeenCalledWith('/catat');
  });

  it('menekan tab aktif tidak berpindah rute', async () => {
    await tampilkan();
    await fireEvent.press(screen.getByLabelText('Beranda'));
    expect(navigateToTab).not.toHaveBeenCalled();
  });

  it('berubah penuh -> pulau; label aksesibilitas tetap ada', async () => {
    await tampilkan();
    expect(screen.getByTestId('tab-bar-penuh')).toBeTruthy();
    expect(screen.getByTestId('tab-bar-penuh').props.pointerEvents).toBe('box-none');

    await act(async () => {
      api.aktifkan('index');
      api.laporGulir('index', 300);
    });
    expect(screen.getByTestId('tab-bar-pulau')).toBeTruthy();
    expect(screen.queryByTestId('tab-bar-penuh')).toBeNull();
    LABEL.forEach((l) => expect(screen.getByLabelText(l)).toBeTruthy());
    expect(screen.getByLabelText('Catat transaksi')).toBeTruthy();

    await act(async () => api.laporGulir('index', 0));
    expect(screen.getByTestId('tab-bar-penuh')).toBeTruthy();
  });
});
