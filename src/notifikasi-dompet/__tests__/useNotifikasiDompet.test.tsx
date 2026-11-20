import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { beritahuSimpan, kosongkan, setDraf } from '@/ai/drafStore';
import * as drafStore from '@/ai/drafStore';
import type { HasilNotif } from '../parser';
import { idDariKunci } from '../draf';
import { resetStatusNotifikasi, sinkronAntrean, useNotifikasiDompet, useNotifikasiTerakhir } from '../useNotifikasiDompet';

const mockPush = jest.fn();
let mockAntrean: { kunci: string; paket: string; judul: string; teks: string; waktu: number }[] = [];
let mockTersedia = true;
let mockAktif = true;
let mockListener: ((n: unknown) => void) | null = null;
let mockAppState: ((s: string) => void) | null = null;
const mockHapus = jest.fn((kunci: string[]) => {
  mockAntrean = mockAntrean.filter((n) => !kunci.includes(n.kunci));
});

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ profile: { zona_waktu: 'Asia/Jakarta' } }) }));
jest.mock('@/data/wallets', () => ({
  useWallets: () => ({
    data: [
      { id: 'w-gp', nama: 'GoPay', tipe: 'harian', saldo_awal: 0, tanggal_saldo_awal: '2026-01-01', target: null, diarsip: false },
    ],
  }),
}));
jest.mock('../../../modules/notifikasi-dompet', () => ({
  tersedia: () => mockTersedia,
  aktif: () => mockAktif,
  ambilAntrean: () => mockAntrean,
  hapusDariAntrean: (k: string[]) => mockHapus(k),
  tambahPendengar: (cb: (n: unknown) => void) => {
    mockListener = cb;
    return { remove: jest.fn() };
  },
}));
// Parser disimulasikan: judul 'TX' = transaksi, selain itu null.
jest.mock('../parser', () => ({
  parseNotifikasi: (n: { kunci: string; judul: string; waktu: number }): HasilNotif | null =>
    n.judul === 'TX'
      ? { kunci: n.kunci, sumber: 'gopay', jenis: 'pengeluaran', nominal: 10000, keterangan: 'Warung', waktu: n.waktu }
      : null,
}));

const N = (kunci: string, judul = 'TX', waktu = 1_700_000_000_000) => ({ kunci, paket: 'com.gojek.gopay', judul, teks: 'teks', waktu });

beforeEach(() => {
  jest.clearAllMocks();
  mockAntrean = [];
  mockTersedia = true;
  mockAktif = true;
  mockListener = null;
  mockAppState = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_e: string, cb: (s: string) => void) => {
    mockAppState = cb;
    return { remove: jest.fn() };
  }) as never);
  kosongkan();
  resetStatusNotifikasi();
});

describe('useNotifikasiDompet', () => {
  it('membaca antrean saat dipasang: jumlah dan draf; yang bukan transaksi dibuang dari antrean', async () => {
    mockAntrean = [N('a'), N('b', 'PROMO'), N('c')];
    const { result } = await renderHook(() => useNotifikasiDompet());
    expect(result.current.jumlah).toBe(2);
    expect(result.current.draf.map((d) => d.id)).toEqual([idDariKunci('a'), idDariKunci('c')]);
    expect(result.current.draf[0].wallet_id).toBe('w-gp');
    expect(mockHapus).toHaveBeenCalledWith(['b']);
    expect(mockAntrean.map((n) => n.kunci)).toEqual(['a', 'c']);
  });

  it('tidak membaca bila modul tidak tersedia atau fitur nonaktif', async () => {
    mockAntrean = [N('a')];
    mockTersedia = false;
    expect((await renderHook(() => useNotifikasiDompet())).result.current.jumlah).toBe(0);
    mockTersedia = true;
    mockAktif = false;
    expect((await renderHook(() => useNotifikasiDompet())).result.current.jumlah).toBe(0);
    expect(mockHapus).not.toHaveBeenCalled();
  });

  it('event onNotifikasi dan app kembali aktif memicu baca ulang', async () => {
    const { result } = await renderHook(() => useNotifikasiDompet());
    expect(result.current.jumlah).toBe(0);
    mockAntrean = [N('a')];
    await act(() => mockListener?.(N('a')));
    expect(result.current.jumlah).toBe(1);
    mockAntrean = [N('a'), N('b')];
    await act(() => mockAppState?.('active'));
    expect(result.current.jumlah).toBe(2);
  });

  it('bukaUntukCek mengisi draf store dan membuka /cek', async () => {
    mockAntrean = [N('a')];
    const { result } = await renderHook(() => useNotifikasiDompet());
    const lihat = jest.spyOn(drafStore, 'setDraf');
    await act(() => result.current.bukaUntukCek());
    expect(lihat).toHaveBeenCalledTimes(1);
    const h = lihat.mock.calls[0][0];
    expect(h.transkrip).toBe('Dari notifikasi GoPay');
    expect(h.draf).toHaveLength(1);
    expect(h.koreksi).toEqual([]);
    expect(h.kuota.terpakai).toBe(0);
    expect(mockPush).toHaveBeenCalledWith('/cek');
    lihat.mockRestore();
  });

  it('antrean dibersihkan hanya setelah simpan berhasil, tidak dobel', async () => {
    mockAntrean = [N('a'), N('c')];
    const { result } = await renderHook(() => useNotifikasiDompet());
    await act(() => result.current.bukaUntukCek());
    mockHapus.mockClear();
    // Dibuang/ditutup tanpa simpan: antrean utuh dan penanda hilang.
    kosongkan();
    beritahuSimpan();
    expect(mockHapus).not.toHaveBeenCalled();
    expect(result.current.jumlah).toBe(2);

    await act(() => result.current.bukaUntukCek());
    await act(() => beritahuSimpan());
    expect(mockHapus).toHaveBeenCalledTimes(1);
    expect(mockHapus).toHaveBeenCalledWith(['a', 'c']);
    expect(result.current.jumlah).toBe(0);
    // Penanda sekali pakai.
    await act(() => beritahuSimpan());
    expect(mockHapus).toHaveBeenCalledTimes(1);
  });

  it('setDraf lain (mis. hasil AI suara) membatalkan penanda sehingga antrean tidak terhapus keliru', async () => {
    mockAntrean = [N('a')];
    const { result } = await renderHook(() => useNotifikasiDompet());
    await act(() => result.current.bukaUntukCek());
    mockHapus.mockClear();
    setDraf({
      draf: [],
      koreksi: [],
      tidakDidukung: [],
      butuh_klarifikasi: false,
      pertanyaan: null,
      transkrip: 'x',
      kuota: { bulan: '2026-11', terpakai: 1, batas: 30, pro: false },
    });
    beritahuSimpan();
    expect(mockHapus).not.toHaveBeenCalled();
  });
});

describe('useNotifikasiTerakhir', () => {
  it('menyimpan maksimal 20 notifikasi terbaru, terbaru dulu, dengan penanda terbaca', async () => {
    mockAntrean = Array.from({ length: 25 }, (_, i) => N(`k${i}`, i % 2 === 0 ? 'TX' : 'PROMO', 1_700_000_000_000 + i));
    const { result } = await renderHook(() => useNotifikasiTerakhir());
    expect(result.current).toHaveLength(20);
    expect(result.current[0].kunci).toBe('k24');
    expect(result.current[0].terbaca).toBe(true);
    expect(result.current[1].terbaca).toBe(false);
    // Baca ulang tidak menggandakan.
    await act(() => sinkronAntrean());
    expect(result.current).toHaveLength(20);
    expect(new Set(result.current.map((x) => x.kunci)).size).toBe(20);
  });
});
