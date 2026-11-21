import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import Ekspor from '../../../app/ekspor';

const mockBack = jest.fn();
const mockPush = jest.fn();
let mockPro = { pro: false, memuat: false };
const mockFrom = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, canGoBack: () => true, replace: jest.fn() }),
}));
jest.mock('@/data/langganan', () => ({ usePro: () => mockPro }));
let mockAkses: Date | null = null;
jest.mock('@/data/aksesIklan', () => ({
  ...jest.requireActual('@/data/aksesIklan'),
  useAksesIklan: () => ({ isPending: false, data: mockAkses }),
  useKlaimAksesIklan: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('@/iklan/reward', () => ({ tontonIklanReward: jest.fn() }));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ profile: { nama: 'Rafli', zona_waktu: 'Asia/Jakarta' } }),
}));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ t: { accFg: '#000', mid: '#888', acc: '#0f0', fg: '#000' } }),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabel: string) => {
      mockFrom(tabel);
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.order = () => b;
      b.gte = () => b;
      b.lte = () => b;
      b.range = async () =>
        tabel === 'wallets'
          ? { data: [{ id: 'w1', nama: 'GoPay', tipe: 'harian', saldo_awal: 0, diarsip: false }], error: null }
          : tabel === 'transactions'
            ? { data: [{ id: 't1', tanggal: '2026-11-02', jenis: 'pengeluaran', nominal: 288000, wallet_id: 'w1' }], error: null }
            : { data: [], error: null };
      return b;
    },
  },
}));
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  File: class {
    uri: string;
    constructor(dir: { uri: string }, nama: string) {
      this.uri = `${dir.uri}${nama}`;
    }
    create() {}
    async write() {}
  },
}));

const btn = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  jest.clearAllMocks();
  mockPro = { pro: false, memuat: false };
  mockAkses = null;
});

describe('Layar ekspor', () => {
  it('non-Pro tanpa akses: gerbang iklan, "Lihat Pro" ke /premium?dari=ekspor, tidak membaca data', async () => {
    await render(<Ekspor />);
    expect(screen.getByText('Buka ekspor data gratis')).toBeTruthy();
    expect(btn('Tonton iklan untuk membuka')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ekspor' })).toBeNull();
    await fireEvent.press(btn('Lihat Pro'));
    expect(mockPush).toHaveBeenCalledWith('/premium?dari=ekspor');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('non-Pro dengan akses iklan aktif: form ekspor terbuka', async () => {
    mockAkses = new Date(Date.now() + 10 * 60 * 1000);
    await render(<Ekspor />);
    expect(screen.getByText(/Akses terbuka sampai/)).toBeTruthy();
    expect(btn('Ekspor')).toBeTruthy();
  });

  it('memuat status: tidak menampilkan form maupun gerbang', async () => {
    mockPro = { pro: false, memuat: true };
    await render(<Ekspor />);
    expect(screen.queryByRole('button', { name: 'Lihat Pro' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ekspor' })).toBeNull();
  });

  it('Pro: Ekspor (default xlsx) -> shareAsync dengan mime xlsx', async () => {
    mockPro = { pro: true, memuat: false };
    await render(<Ekspor />);
    await fireEvent.press(btn('Ekspor'));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringMatching(/arta-ekspor-\d{4}-\d{2}-\d{2}\.xlsx$/),
      expect.objectContaining({ mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    );
    expect(mockFrom).toHaveBeenCalledWith('categories');
  });

  it('Pro: pilih CSV -> shareAsync dengan text/csv, hanya transaksi + nama dompet', async () => {
    mockPro = { pro: true, memuat: false };
    await render(<Ekspor />);
    await fireEvent.press(btn('CSV, transaksi'));
    await fireEvent.press(btn('Bulan ini'));
    await fireEvent.press(btn('Ekspor'));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringMatching(/\.csv$/),
      expect.objectContaining({ mimeType: 'text/csv' }),
    );
    expect(mockFrom).not.toHaveBeenCalledWith('categories');
  });

  it('berbagi tidak tersedia -> pesan galat', async () => {
    mockPro = { pro: true, memuat: false };
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    await render(<Ekspor />);
    await fireEvent.press(btn('Ekspor'));
    expect(await screen.findByText('Perangkat ini tidak mendukung berbagi berkas.')).toBeTruthy();
  });

  it('Tutup -> router.back()', async () => {
    await render(<Ekspor />);
    await fireEvent.press(btn('Tutup'));
    expect(mockBack).toHaveBeenCalled();
  });
});
