import { fireEvent, render, screen } from '@testing-library/react-native';
import { Tombol } from '../Tombol';

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: { accFg: '#FFFFFF', fg: '#111111' } }),
}));

describe('Tombol', () => {
  it('primary merender label dan bisa ditekan', async () => {
    const onPress = jest.fn();
    await render(<Tombol primary label="Simpan" onPress={onPress} />);
    expect(screen.getByText('Simpan')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Simpan' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('busy tidak menampilkan label', async () => {
    await render(<Tombol primary busy label="Simpan" onPress={jest.fn()} />);
    expect(screen.queryByText('Simpan')).toBeNull();
  });
});
