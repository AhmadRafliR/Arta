import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { QueryCacheGuard } from '../QueryCacheGuard';

let mockUserId: string | null = null;
jest.mock('../AuthProvider', () => ({
  useAuth: () => ({ session: mockUserId ? { user: { id: mockUserId } } : null }),
}));

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  // elemen baru tiap panggilan agar rerender benar-benar mengevaluasi ulang useAuth tiruan
  const ui = () => (
    <QueryClientProvider client={qc}>
      <QueryCacheGuard />
    </QueryClientProvider>
  );
  return { qc, ui };
}

afterEach(() => {
  mockUserId = null;
});

describe('QueryCacheGuard', () => {
  it('mengosongkan cache saat user id berganti (A -> B)', async () => {
    mockUserId = 'A';
    const { qc, ui } = setup();
    const r = await render(ui());
    qc.setQueryData(['wallets'], [{ id: 'w-A' }]);
    mockUserId = 'B';
    await r.rerender(ui());
    expect(qc.getQueryData(['wallets'])).toBeUndefined();
    qc.clear();
  });

  it('mengosongkan cache saat keluar (A -> null)', async () => {
    mockUserId = 'A';
    const { qc, ui } = setup();
    const r = await render(ui());
    qc.setQueryData(['transactions', 'all'], [1]);
    mockUserId = null;
    await r.rerender(ui());
    expect(qc.getQueryData(['transactions', 'all'])).toBeUndefined();
    qc.clear();
  });

  it('tidak menghapus cache bila user id tetap', async () => {
    mockUserId = 'A';
    const { qc, ui } = setup();
    const r = await render(ui());
    qc.setQueryData(['wallets'], [1]);
    await r.rerender(ui());
    expect(qc.getQueryData(['wallets'])).toEqual([1]);
    qc.clear();
  });
});
