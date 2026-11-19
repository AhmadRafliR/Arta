import React from 'react';
import { Text, Pressable } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokens } from '../tokens';
import { resolveMode } from '../resolveMode';
import { ThemeProvider, useTheme } from '../ThemeProvider';

describe('tokens', () => {
  it('memakai nilai persis', () => {
    expect(tokens.terang.bg).toBe('#EEF3F5');
    expect(tokens.terang.acc).toBe('#52C3BF');
    expect(tokens.gelap.bg).toBe('#0B0B0C');
    expect(tokens.gelap.acc).toBe('#C6F432');
    expect(tokens.gelap.heroFrom).toBe('#FFFFFF');
    expect(tokens.gelap.heroTo).toBe('#FFFFFF');
    expect(tokens.terang.heroTo).toBe('#1F6A76');
  });
});

describe('resolveMode', () => {
  it('sistem mengikuti sistem', () => {
    expect(resolveMode('sistem', 'dark')).toBe('gelap');
    expect(resolveMode('sistem', 'light')).toBe('terang');
    expect(resolveMode('sistem', null)).toBe('terang');
  });
  it('pilihan eksplisit menang', () => {
    expect(resolveMode('terang', 'dark')).toBe('terang');
    expect(resolveMode('gelap', 'light')).toBe('gelap');
  });
});

function Probe() {
  const { mode, pref, setPref, t } = useTheme();
  return (
    <>
      <Text testID="out">{`${mode}|${pref}|${t.bg}`}</Text>
      <Pressable testID="btn" onPress={() => setPref('gelap')} />
    </>
  );
}

describe('ThemeProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('default sistem -> terang saat sistem tidak diketahui', async () => {
    await render(<ThemeProvider><Probe /></ThemeProvider>);
    expect((await screen.findByTestId('out')).props.children).toBe('terang|sistem|#EEF3F5');
  });

  it('setPref menyimpan ke AsyncStorage dan memanggil onPrefChange', async () => {
    const onPrefChange = jest.fn();
    await render(<ThemeProvider onPrefChange={onPrefChange}><Probe /></ThemeProvider>);
    await screen.findByTestId('btn');
    fireEvent.press(screen.getByTestId('btn'));
    await waitFor(() =>
      expect(screen.getByTestId('out').props.children).toBe('gelap|gelap|#0B0B0C'),
    );
    expect(onPrefChange).toHaveBeenCalledWith('gelap');
    expect(await AsyncStorage.getItem('tema_pref')).toBe('gelap');
  });

  it('memuat pref tersimpan', async () => {
    await AsyncStorage.setItem('tema_pref', 'gelap');
    await render(<ThemeProvider><Probe /></ThemeProvider>);
    await waitFor(() =>
      expect(screen.getByTestId('out').props.children).toBe('gelap|gelap|#0B0B0C'),
    );
  });

  it('tidak merender anak sebelum pref tersimpan terbaca', async () => {
    await AsyncStorage.setItem('tema_pref', 'gelap');
    let resolve!: (v: string | null) => void;
    const spy = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockImplementationOnce(() => new Promise<string | null>((r) => { resolve = r; }));
    await render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.queryByTestId('out')).toBeNull();
    await act(async () => { resolve('gelap'); });
    expect((await screen.findByTestId('out')).props.children).toBe('gelap|gelap|#0B0B0C');
    spy.mockRestore();
  });
});
