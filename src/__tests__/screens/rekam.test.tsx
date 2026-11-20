import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import Rekam from '../../../app/rekam';
import type { HasilAi, KuotaAi } from '@/ai/tipe';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockKirim = jest.fn();
const mockSetDraf = jest.fn();
let mockKuota: KuotaAi | undefined;

// Perekam palsu: durasi dan uri dikendalikan per tes.
const mockRecorder = {
  prepareToRecordAsync: jest.fn(async () => {}),
  record: jest.fn(),
  stop: jest.fn(async () => {}),
  getStatus: jest.fn(() => ({ durationMillis: 2000 })),
  uri: 'file:///cache/rekaman.m4a' as string | null,
};
const mockGetIzin = jest.fn();
const mockMintaIzin = jest.fn();
const mockSetMode = jest.fn((_mode: unknown) => Promise.resolve());

jest.mock('expo-audio', () => ({
  useAudioRecorder: () => mockRecorder,
  RecordingPresets: { HIGH_QUALITY: { extension: '.m4a' } },
  getRecordingPermissionsAsync: () => mockGetIzin(),
  requestRecordingPermissionsAsync: () => mockMintaIzin(),
  setAudioModeAsync: (m: unknown) => mockSetMode(m),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, canGoBack: () => true }),
}));
jest.mock('@/data/ai', () => ({
  useKuotaAi: () => ({ data: mockKuota }),
  sisaKuota: (k: { terpakai: number; batas: number }) => Math.max(0, k.batas - k.terpakai),
  useKirimKeAi: () => mockKirim,
}));
jest.mock('@/ai/drafStore', () => ({ setDraf: (h: unknown) => mockSetDraf(h) }));
jest.mock('@/theme/ThemeProvider', () => ({
  useTheme: () => ({ mode: 'terang', t: { acc: '#52C3BF', accFg: '#0B424F', accInk: '#1F6A76', fg: '#111', mid: '#888' } }),
}));

const KUOTA: KuotaAi = { bulan: '2026-11', terpakai: 12, batas: 30, pro: false };

function hasil(p: Partial<HasilAi> = {}): HasilAi {
  return {
    transkrip: 'parkir 2rb cash',
    draf: [
      {
        id: 'd1',
        tanggal: '2026-11-20',
        jenis: 'pengeluaran',
        kategori: 'transportasi',
        nominal: 2000,
        wallet_id: 'w1',
        wallet_tujuan_id: null,
        catatan: 'parkir',
        peringatan: [],
      },
    ],
    koreksi: [],
    tidakDidukung: [],
    butuh_klarifikasi: false,
    pertanyaan: null,
    kuota: { ...KUOTA, terpakai: 13 },
    ...p,
  };
}

const tombolRekam = () => screen.getByTestId('tombol-rekam');

async function tahanLalu() {
  await fireEvent(tombolRekam(), 'pressIn');
  await fireEvent(tombolRekam(), 'pressOut');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockKuota = KUOTA;
  mockRecorder.uri = 'file:///cache/rekaman.m4a';
  mockRecorder.getStatus.mockReturnValue({ durationMillis: 2000 });
  mockGetIzin.mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true });
  mockMintaIzin.mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true });
  mockKirim.mockResolvedValue(hasil());
});

describe('Layar rekam', () => {
  it('menampilkan sisa kuota', async () => {
    await render(<Rekam />);
    expect(screen.getByText('Catat pakai suara')).toBeTruthy();
    expect(screen.getByText('Sisa 18 catat AI bulan ini')).toBeTruthy();
    expect(screen.getByText('Tahan, ngomong, lepas.')).toBeTruthy();
  });

  it('pro: pil kuota disembunyikan', async () => {
    mockKuota = { ...KUOTA, batas: 600, pro: true };
    await render(<Rekam />);
    expect(screen.queryByText(/catat AI bulan ini$/)).toBeNull();
  });

  it('kuota habis: kartu habis tampil dan tombol rekam nonaktif', async () => {
    mockKuota = { ...KUOTA, terpakai: 30 };
    await render(<Rekam />);
    expect(
      screen.getByText('Kuota catat AI bulan ini sudah habis. Kamu masih bisa catat manual tanpa batas.'),
    ).toBeTruthy();
    expect(screen.getByText('Pro dengan catat AI tanpa batas segera hadir.')).toBeTruthy();
    expect(tombolRekam().props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Catat manual' }));
    expect(mockReplace).toHaveBeenCalledWith('/catat');
  });

  it('tahan 2 detik lalu lepas: kirim audio sekali, setDraf, lalu ke /cek', async () => {
    await render(<Rekam />);
    await tahanLalu();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/cek'));
    expect(mockSetMode).toHaveBeenCalledWith(expect.objectContaining({ allowsRecording: true }));
    expect(mockRecorder.prepareToRecordAsync).toHaveBeenCalledTimes(1);
    expect(mockRecorder.record).toHaveBeenCalledTimes(1);
    expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
    expect(mockKirim).toHaveBeenCalledTimes(1);
    expect(mockKirim).toHaveBeenCalledWith({ audioUri: 'file:///cache/rekaman.m4a', mime: 'audio/m4a' });
    expect(mockSetDraf).toHaveBeenCalledWith(hasil());
  });

  it('rekaman 0,3 detik ditolak tanpa mengirim', async () => {
    mockRecorder.getStatus.mockReturnValue({ durationMillis: 300 });
    await render(<Rekam />);
    await tahanLalu();
    expect(await screen.findByText('Tahan lebih lama untuk merekam')).toBeTruthy();
    expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
    expect(mockKirim).not.toHaveBeenCalled();
  });

  it('butuh klarifikasi: pertanyaan tampil, tetap di layar rekam', async () => {
    mockKirim.mockResolvedValue(
      hasil({ draf: [], butuh_klarifikasi: true, pertanyaan: 'Maaf, aku belum paham. Coba sebutkan nominal dan untuk apa.' }),
    );
    await render(<Rekam />);
    await tahanLalu();
    expect(await screen.findByText('Maaf, aku belum paham. Coba sebutkan nominal dan untuk apa.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockSetDraf).not.toHaveBeenCalled();
  });

  it('Ketik saja: kirim teks', async () => {
    await render(<Rekam />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ketik saja' }));
    const kirim = () => screen.getByRole('button', { name: 'Kirim' });
    expect(kirim().props.accessibilityState?.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('input-ketik'), 'parkir 2rb cash');
    await fireEvent.press(kirim());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/cek'));
    expect(mockKirim).toHaveBeenCalledWith({ teks: 'parkir 2rb cash' });
    expect(screen.getByTestId('input-ketik').props.maxLength).toBe(500);
  });

  it('Isi formulir manual membuka /catat', async () => {
    await render(<Rekam />);
    await fireEvent.press(screen.getByRole('button', { name: 'Isi formulir manual' }));
    expect(mockReplace).toHaveBeenCalledWith('/catat');
  });

  it('izin mikrofon ditolak: pesan izin dan tombol Buka Pengaturan', async () => {
    mockGetIzin.mockResolvedValue({ granted: false, status: 'denied', canAskAgain: false });
    mockMintaIzin.mockResolvedValue({ granted: false, status: 'denied', canAskAgain: false });
    const buka = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await render(<Rekam />);
    await tahanLalu();
    expect(
      await screen.findByText('Izin mikrofon ditolak. Buka Pengaturan untuk mengizinkan, atau pakai "Ketik saja".'),
    ).toBeTruthy();
    expect(mockRecorder.record).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Buka Pengaturan' }));
    expect(buka).toHaveBeenCalled();
    buka.mockRestore();
  });

  it('galat kuota dari kirimKeAi: kartu habis', async () => {
    mockKirim.mockRejectedValue({ kind: 'kuota', pesan: 'Kuota catat AI bulan ini habis.' });
    await render(<Rekam />);
    await tahanLalu();
    expect(
      await screen.findByText('Kuota catat AI bulan ini sudah habis. Kamu masih bisa catat manual tanpa batas.'),
    ).toBeTruthy();
    expect(tombolRekam().props.accessibilityState?.disabled).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('galat lain: pesan tampil, Coba lagi mengirim ulang input yang sama', async () => {
    mockKirim.mockRejectedValueOnce({ kind: 'lain', pesan: 'AI sedang sibuk, coba lagi sebentar.' });
    await render(<Rekam />);
    await tahanLalu();
    expect(await screen.findByText('AI sedang sibuk, coba lagi sebentar.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Coba lagi' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/cek'));
    expect(mockKirim).toHaveBeenCalledTimes(2);
    expect(mockKirim.mock.calls[1][0]).toEqual(mockKirim.mock.calls[0][0]);
  });
});
