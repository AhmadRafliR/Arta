import { fireEvent, render, screen } from '@testing-library/react-native';
import { AmountInput } from '../AmountInput';

jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ t: { heroFg: '#fff', amSub: '#ddd' } }),
}));

describe('AmountInput', () => {
  it('menampilkan pratinjau rupiah dan memanggil onChange dengan angka', async () => {
    const onChange = jest.fn();
    await render(<AmountInput value={null} onChange={onChange} testID="n" />);
    await fireEvent.changeText(screen.getByTestId('n'), '153.267');
    expect(screen.getByText('Rp153.267')).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith(153267);
  });

  it('teks tidak valid menampilkan error dan onChange(null)', async () => {
    const onChange = jest.fn();
    await render(<AmountInput value={null} onChange={onChange} testID="n" />);
    await fireEvent.changeText(screen.getByTestId('n'), 'abc');
    expect(screen.getByText('Nominal tidak valid')).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('kosong: tanpa error dan tanpa pratinjau, onChange(null)', async () => {
    const onChange = jest.fn();
    await render(<AmountInput value={null} onChange={onChange} testID="n" />);
    await fireEvent.changeText(screen.getByTestId('n'), '12');
    await fireEvent.changeText(screen.getByTestId('n'), '');
    expect(screen.queryByText('Nominal tidak valid')).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('"0" tidak valid secara default', async () => {
    await render(<AmountInput value={null} onChange={jest.fn()} testID="n" />);
    await fireEvent.changeText(screen.getByTestId('n'), '0');
    expect(screen.getByText('Nominal tidak valid')).toBeTruthy();
  });

  it('allowZero: "0" valid (Rp0) dan kosong dihitung 0', async () => {
    const onChange = jest.fn();
    await render(<AmountInput value={0} onChange={onChange} allowZero testID="n" />);
    await fireEvent.changeText(screen.getByTestId('n'), '0');
    expect(screen.queryByText('Nominal tidak valid')).toBeNull();
    expect(screen.getByText('Rp0')).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith(0);
    await fireEvent.changeText(screen.getByTestId('n'), '');
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(screen.queryByText('Nominal tidak valid')).toBeNull();
  });
  it('varian hero: awalan Rp, label aksesibilitas Nominal, perilaku parse sama', async () => {
    const onChange = jest.fn();
    await render(<AmountInput value={null} onChange={onChange} testID="n" varian="hero" />);
    expect(screen.getByText('Rp', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('Nominal')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('n'), '50rb');
    expect(onChange).toHaveBeenLastCalledWith(50000);
    expect(screen.getByText('Rp50.000')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('n'), 'abc');
    expect(screen.getByText('Nominal tidak valid')).toBeTruthy();
  });
});
