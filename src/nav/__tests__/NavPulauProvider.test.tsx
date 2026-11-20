import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView, Text } from 'react-native';
import { NavPulauProvider, useNavPulau } from '../NavPulauProvider';
import { useGulirPulau } from '../useGulirPulau';

// useFocusEffect langsung memanggil callback (layar dianggap fokus).
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return { useFocusEffect: (cb: () => void) => useEffect(cb, [cb]) };
});

let api: ReturnType<typeof useNavPulau>;
function Pengamat() {
  api = useNavPulau();
  return <Text className="font-sans" testID="status">{api.status}</Text>;
}

const status = () => screen.getByTestId('status').props.children;

describe('NavPulauProvider', () => {
  it('awal penuh; status mengikuti gulir rute aktif', async () => {
    await render(
      <NavPulauProvider>
        <Pengamat />
      </NavPulauProvider>,
    );
    expect(status()).toBe('penuh');

    await act(async () => api.aktifkan('index'));
    await act(async () => api.laporGulir('index', 300));
    expect(status()).toBe('pulau');
    await act(async () => api.laporGulir('index', 4));
    expect(status()).toBe('penuh');
  });

  it('gulir rute tak aktif hanya disimpan; aktifkan memakai offset tersimpan', async () => {
    await render(
      <NavPulauProvider>
        <Pengamat />
      </NavPulauProvider>,
    );
    await act(async () => api.aktifkan('index'));
    await act(async () => api.laporGulir('index', 4));
    await act(async () => api.laporGulir('akun', 500));
    expect(status()).toBe('penuh');

    await act(async () => api.aktifkan('akun'));
    expect(status()).toBe('pulau');
    await act(async () => api.aktifkan('index'));
    expect(status()).toBe('penuh');

    await act(async () => api.laporGulir('index', 120));
    await act(async () => api.aktifkan('akun'));
    await act(async () => api.aktifkan('index'));
    expect(status()).toBe('pulau');
  });

  it('render ulang hanya saat status benar-benar berubah', async () => {
    let renders = 0;
    function Hitung() {
      useNavPulau();
      renders++;
      return null;
    }
    await render(
      <NavPulauProvider>
        <Pengamat />
        <Hitung />
      </NavPulauProvider>,
    );
    await act(async () => api.aktifkan('index'));
    const awal = renders;
    await act(async () => {
      api.laporGulir('index', 2);
      api.laporGulir('index', 20);
      api.aktifkan('index');
    });
    expect(renders).toBe(awal);
    await act(async () => api.laporGulir('index', 30));
    expect(renders).toBe(awal + 1);
    await act(async () => api.laporGulir('index', 12));
    expect(renders).toBe(awal + 1);
  });
});

describe('useGulirPulau', () => {
  function Layar() {
    return (
      <ScrollView testID="gulir" {...useGulirPulau('index')}>
        <Text className="font-sans">isi</Text>
      </ScrollView>
    );
  }

  it('gulir ScrollView mengubah status jadi pulau', async () => {
    await render(
      <NavPulauProvider>
        <Pengamat />
        <Layar />
      </NavPulauProvider>,
    );
    const scroll = screen.getByTestId('gulir');
    expect(scroll.props.scrollEventThrottle).toBe(16);
    await fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { y: 300 } } });
    expect(status()).toBe('pulau');
  });

  it('layar yang hanya memakai useGulirPulau tidak render ulang saat status berubah', async () => {
    let renders = 0;
    function LayarHitung() {
      renders++;
      return (
        <ScrollView testID="gulir2" {...useGulirPulau('index')}>
          <Text className="font-sans">isi</Text>
        </ScrollView>
      );
    }
    await render(
      <NavPulauProvider>
        <Pengamat />
        <LayarHitung />
      </NavPulauProvider>,
    );
    const awal = renders;
    await fireEvent.scroll(screen.getByTestId('gulir2'), { nativeEvent: { contentOffset: { y: 300 } } });
    expect(status()).toBe('pulau');
    await fireEvent.scroll(screen.getByTestId('gulir2'), { nativeEvent: { contentOffset: { y: 0 } } });
    expect(status()).toBe('penuh');
    expect(renders).toBe(awal);
  });
});
