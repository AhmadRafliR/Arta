import { render, screen } from '@testing-library/react-native';
import { MarkArta } from '../MarkArta';

let mockMode: 'terang' | 'gelap' = 'terang';
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: mockMode }),
}));

describe('MarkArta', () => {
  it.each(['terang', 'gelap'] as const)('merender dengan label arta (%s)', async (m) => {
    mockMode = m;
    await render(<MarkArta />);
    expect(screen.getByLabelText('arta')).toBeTruthy();
  });

  it('dekoratif: tanpa label arta', async () => {
    mockMode = 'terang';
    await render(<MarkArta dekoratif />);
    expect(screen.queryByLabelText('arta')).toBeNull();
  });
});
