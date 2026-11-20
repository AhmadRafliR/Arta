import { act, renderHook } from '@testing-library/react-native';
import { setDraf, useDraf, ubahDraf, hapusDraf, hapusKoreksi, kosongkan } from '../drafStore';
import type { HasilAi } from '../tipe';

const hasil = (): HasilAi => ({
  transkrip: 'makan 15rb',
  kuota: { bulan: '2026-11', terpakai: 1, batas: 30, pro: false },
  draf: [
    { id: 'a', tanggal: '2026-11-20', jenis: 'pengeluaran', kategori: 'Makan', nominal: 15000, wallet_id: null, wallet_tujuan_id: null, catatan: null, peringatan: ['Pilih dompet', 'Nominal diperkirakan'] },
    { id: 'b', tanggal: '2026-11-20', jenis: 'pemasukan', kategori: 'Gaji', nominal: 1000, wallet_id: 'w1', wallet_tujuan_id: null, catatan: null, peringatan: [] },
  ],
  koreksi: [{ id: 'k1', wallet_id: 'w1', saldo_baru: 150000 }],
  tidakDidukung: [],
  butuh_klarifikasi: false,
  pertanyaan: null,
});

afterEach(() => act(() => kosongkan()));

it('set lalu useDraf mengembalikan data; kosongkan -> null', async () => {
  const { result } = await renderHook(() => useDraf());
  expect(result.current).toBeNull();
  await act(async () => setDraf(hasil()));
  expect(result.current?.transkrip).toBe('makan 15rb');
  await act(async () => kosongkan());
  expect(result.current).toBeNull();
});

it('ubahDraf mengganti nominal', async () => {
  const { result } = await renderHook(() => useDraf());
  await act(async () => setDraf(hasil()));
  await act(async () => ubahDraf('a', { nominal: 20000 }));
  expect(result.current?.draf[0].nominal).toBe(20000);
  expect(result.current?.draf[1].nominal).toBe(1000);
});

it('ubahDraf wallet_id non-null menghapus peringatan dompet saja', async () => {
  const { result } = await renderHook(() => useDraf());
  await act(async () => setDraf(hasil()));
  await act(async () => ubahDraf('a', { wallet_id: 'w2' }));
  expect(result.current?.draf[0].peringatan).toEqual(['Nominal diperkirakan']);
});

it('hapusDraf dan hapusKoreksi menghapus baris', async () => {
  const { result } = await renderHook(() => useDraf());
  await act(async () => setDraf(hasil()));
  await act(async () => hapusDraf('a'));
  expect(result.current?.draf.map((d) => d.id)).toEqual(['b']);
  await act(async () => hapusKoreksi('k1'));
  expect(result.current?.koreksi).toEqual([]);
});

it('operasi saat kosong tidak error', () => {
  expect(() => {
    ubahDraf('x', { nominal: 1 });
    hapusDraf('x');
    hapusKoreksi('x');
  }).not.toThrow();
});
