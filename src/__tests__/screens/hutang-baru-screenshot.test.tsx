import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { launchImageLibraryAsync } from 'expo-image-picker';
import HutangBaru from '../../../app/hutang/baru';

const mockInvoke = jest.fn();
const mockPush = jest.fn();
let mockId = 0;

jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: (...a: unknown[]) => mockPush(...a) }),
}));
jest.mock('@/data/transactions', () => ({
  useSaveTransactions: () => ({ mutateAsync: jest.fn() }),
  newTxId: () => `id-${++mockId}`,
}));
jest.mock('@/data/wallets', () => ({ useWallets: () => ({ data: [] }) }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ profile: { zona_waktu: 'Asia/Jakarta' } }) }));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: { accFg: '#000', mid: '#888', acc: '#0f0', fg: '#000' } }),
}));

const picker = launchImageLibraryAsync as jest.Mock;
const kuota = { bulan: '2026-11', terpakai: 1, batas: 30, pro: false };
const galatHttp = (body: unknown) => ({ name: 'FunctionsHttpError', message: 'x', context: { json: async () => body } });
const aset = { uri: 'file:///a.png', base64: 'QUJD', mimeType: 'image/png', fileSize: 3 };

async function tampil() {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <HutangBaru />
    </QueryClientProvider>,
  );
}
const tekan = () => fireEvent.press(screen.getByRole('button', { name: 'Isi dari screenshot' }));

beforeEach(() => {
  jest.clearAllMocks();
  mockId = 0;
});

describe('Hutang baru: isi dari screenshot', () => {
  it('draf mengisi form cicilan tetap dan memberi catatan cek ulang', async () => {
    picker.mockResolvedValueOnce({ canceled: false, assets: [aset] });
    mockInvoke.mockResolvedValue({
      data: {
        draf: { pemberi: 'Kredivo', tipe: 'cicilan_tetap', nominal_cicilan: 250000, tenor_bulan: 6, jatuh_tempo: '2026-12-05',
          pokok_awal: null, bunga_persen_bulanan: null, sisa_pokok: null, catatan: 'Tagihan Des' },
        pesan: null, kuota,
      },
      error: null,
    });
    await tampil();
    await tekan();
    expect(await screen.findByDisplayValue('Kredivo')).toBeTruthy();
    expect(screen.getByDisplayValue('250000')).toBeTruthy();
    expect(screen.getByDisplayValue('6')).toBeTruthy();
    expect(screen.getByDisplayValue('2026-12-05')).toBeTruthy();
    expect(screen.getByText('Terisi dari screenshot. Cek lagi angkanya sebelum menyimpan.')).toBeTruthy();
    expect(mockInvoke).toHaveBeenCalledWith('parse-hutang', { body: { gambar_base64: 'QUJD', mime: 'image/png' } });
  });

  it('draf berbunga dengan sisa pokok menyalakan "sudah berjalan"', async () => {
    picker.mockResolvedValueOnce({ canceled: false, assets: [aset] });
    mockInvoke.mockResolvedValue({
      data: {
        draf: { pemberi: 'Koperasi', tipe: 'berbunga', nominal_cicilan: null, tenor_bulan: null, jatuh_tempo: null,
          pokok_awal: 1000000, bunga_persen_bulanan: 2.5, sisa_pokok: 800000, catatan: null },
        pesan: null, kuota,
      },
      error: null,
    });
    await tampil();
    await tekan();
    expect(await screen.findByDisplayValue('Koperasi')).toBeTruthy();
    expect(screen.getByDisplayValue('1000000')).toBeTruthy();
    expect(screen.getByDisplayValue('2,5')).toBeTruthy();
    expect(screen.getByDisplayValue('800000')).toBeTruthy();
  });

  it('draf null: tampilkan pesan server, form tetap kosong', async () => {
    picker.mockResolvedValueOnce({ canceled: false, assets: [aset] });
    mockInvoke.mockResolvedValue({ data: { draf: null, pesan: 'Bukan tagihan', kuota }, error: null });
    await tampil();
    await tekan();
    expect(await screen.findByText('Bukan tagihan')).toBeTruthy();
    expect(screen.getByTestId('pemberi').props.value).toBe('');
  });

  it('batal memilih gambar: server tidak dipanggil', async () => {
    picker.mockResolvedValueOnce({ canceled: true, assets: null });
    await tampil();
    await tekan();
    await waitFor(() => expect(picker).toHaveBeenCalledTimes(1));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('galat server: tampilkan pesan; kuota habis menambah ajakan Pro', async () => {
    picker.mockResolvedValueOnce({ canceled: false, assets: [aset] });
    mockInvoke.mockResolvedValue({ data: null, error: galatHttp({ galat: 'quota_exceeded', pesan: 'Kuota AI bulan ini habis' }) });
    await tampil();
    await tekan();
    expect(await screen.findByText('Kuota AI bulan ini habis')).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'Lihat Pro' }));
    expect(mockPush).toHaveBeenCalledWith('/premium?dari=kuota');
  });

  it('galat ai_gagal: pesan server tampil', async () => {
    picker.mockResolvedValueOnce({ canceled: false, assets: [aset] });
    mockInvoke.mockResolvedValue({ data: null, error: galatHttp({ galat: 'ai_gagal', pesan: 'AI sibuk, coba lagi' }) });
    await tampil();
    await tekan();
    expect(await screen.findByText('AI sibuk, coba lagi')).toBeTruthy();
  });

  it('gambar terlalu besar ditolak di klien', async () => {
    picker.mockResolvedValueOnce({ canceled: false, assets: [{ ...aset, fileSize: 7 * 1024 * 1024 }] });
    await tampil();
    await tekan();
    expect(await screen.findByText(/terlalu besar/)).toBeTruthy();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
