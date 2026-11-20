import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import type { Hutang } from '@/domain/types';
import {
  toHutang,
  toTagihan,
  useDebt,
  useDebts,
  useDebtSchedule,
  useDeleteDebt,
  useTambahJadwal,
  useUpdateDebt,
} from '../debts';

const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: (...a: unknown[]) => mockFrom(...a) },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000000' }));

type Panggilan = [string, unknown[]];

/** Query builder palsu: setiap metode dicatat dan mengembalikan dirinya; await -> `hasil`. */
function builder(hasil: { data: unknown; error: unknown }) {
  const calls: Panggilan[] = [];
  const q: any = {};
  for (const m of ['select', 'eq', 'order', 'update', 'delete', 'single']) {
    q[m] = (...a: unknown[]) => {
      calls.push([m, a]);
      return q;
    };
  }
  q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(hasil).then(res, rej);
  return { q, calls };
}

const baris = {
  id: 'd1',
  pemberi: 'Kredivo',
  tipe: 'cicilan_tetap',
  tanggal_mulai: '2026-11-05',
  pokok_awal: '1200000',
  nominal_cicilan: '100000',
  tenor_bulan: 12,
  bunga_persen_bulanan: null,
  metode: null,
  diarsip: false,
  sisa_pokok: '1100000',
  total_bunga: '0',
  total_bayar: '100000',
  jumlah_tagihan: 12,
  tagihan_lunas: 1,
  jatuh_tempo_berikutnya: '2027-01-05',
  nominal_berikutnya: '100000',
  jatuh_tempo_terakhir: '2027-11-05',
  bayar_terakhir: '2026-12-04',
  created_at: '2026-11-20T00:00:00Z',
};

const klien: QueryClient[] = [];
afterEach(() => {
  klien.splice(0).forEach((c) => c.clear());
  mockRpc.mockReset();
  mockFrom.mockReset();
});

function siapkan() {
  const qc = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { retry: false, gcTime: Infinity } },
  });
  klien.push(qc);
  const W = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, W };
}

describe('toHutang', () => {
  it('mengubah bigint/numeric string menjadi number, null tetap null', () => {
    const h = toHutang({ ...baris, tipe: 'berbunga', bunga_persen_bulanan: '2.00', metode: 'flat', nominal_cicilan: null, tenor_bulan: null });
    expect(h.sisa_pokok).toBe(1100000);
    expect(h.pokok_awal).toBe(1200000);
    expect(h.bunga_persen_bulanan).toBe(2);
    expect(h.nominal_cicilan).toBeNull();
    expect(h.tenor_bulan).toBeNull();
    expect(h.metode).toBe('flat');
    expect(h.total_bayar).toBe(100000);
    expect(h.nominal_berikutnya).toBe(100000);
    expect(h.diarsip).toBe(false);
  });

  it('hutang tanpa tagihan: tanggal dan nominal berikutnya null', () => {
    const h = toHutang({
      ...baris,
      jatuh_tempo_berikutnya: null,
      nominal_berikutnya: null,
      jatuh_tempo_terakhir: null,
      bayar_terakhir: null,
      jumlah_tagihan: '0',
      tagihan_lunas: '0',
    });
    expect(h.jatuh_tempo_berikutnya).toBeNull();
    expect(h.nominal_berikutnya).toBeNull();
    expect(h.jatuh_tempo_terakhir).toBeNull();
    expect(h.bayar_terakhir).toBeNull();
    expect(h.jumlah_tagihan).toBe(0);
    expect(h.tagihan_lunas).toBe(0);
  });

  it('tidak membawa kolom di luar tipe Hutang', () => {
    expect(toHutang(baris)).not.toHaveProperty('created_at');
  });
});

describe('toTagihan', () => {
  it('nominal string -> number', () => {
    expect(
      toTagihan({ id: 's1', debt_id: 'd1', jatuh_tempo: '2026-12-05', nominal: '100000', status: 'lunas', transaction_id: 't1' }),
    ).toEqual({ id: 's1', debt_id: 'd1', jatuh_tempo: '2026-12-05', nominal: 100000, status: 'lunas', transaction_id: 't1' });
    expect(
      toTagihan({ id: 's2', debt_id: 'd1', jatuh_tempo: '2027-01-05', nominal: 5, status: 'belum', transaction_id: null })
        .transaction_id,
    ).toBeNull();
  });
});

describe('useDebts', () => {
  it('membaca v_hutang dengan filter diarsip, urutan jatuh tempo (null di akhir) lalu created_at', async () => {
    const { q, calls } = builder({ data: [{ ...baris, sisa_pokok: '1100000', bunga_persen_bulanan: '2.00' }], error: null });
    mockFrom.mockReturnValue(q);
    const { W, qc } = siapkan();
    const { result } = await renderHook(() => useDebts({ arsip: false }), { wrapper: W });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFrom).toHaveBeenCalledWith('v_hutang');
    expect(calls).toContainEqual(['eq', ['diarsip', false]]);
    const urutan = calls.filter(([m]) => m === 'order').map(([, a]) => a);
    expect(urutan[0][0]).toBe('jatuh_tempo_berikutnya');
    expect(urutan[0][1]).toMatchObject({ ascending: true, nullsFirst: false });
    expect(urutan[1][0]).toBe('created_at');
    expect(result.current.data?.[0].sisa_pokok).toBe(1100000);
    expect(result.current.data?.[0].bunga_persen_bulanan).toBe(2);
    expect(qc.getQueryData(['debts', 'list', false])).toBeDefined();
  });

  it('arsip: true memfilter hutang diarsip', async () => {
    const { q, calls } = builder({ data: [], error: null });
    mockFrom.mockReturnValue(q);
    const { W } = siapkan();
    const { result } = await renderHook(() => useDebts({ arsip: true }), { wrapper: W });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls).toContainEqual(['eq', ['diarsip', true]]);
  });

  it('tanpa arsip: tidak memfilter diarsip', async () => {
    const { q, calls } = builder({ data: [], error: null });
    mockFrom.mockReturnValue(q);
    const { W } = siapkan();
    const { result } = await renderHook(() => useDebts(), { wrapper: W });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls.some(([m]) => m === 'eq')).toBe(false);
  });

  it('galat baca offline -> AppError offline dengan pesan umum', async () => {
    const { q } = builder({ data: null, error: new TypeError('Network request failed') });
    mockFrom.mockReturnValue(q);
    const { W } = siapkan();
    const { result } = await renderHook(() => useDebts({ arsip: false }), { wrapper: W });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: 'offline', pesan: 'Tidak ada koneksi. Coba lagi.' });
  });
});

describe('useDebt', () => {
  it('memakai cache daftar sebagai data awal, lalu membaca v_hutang per id', async () => {
    const { q, calls } = builder({ data: { ...baris, sisa_pokok: '900000' }, error: null });
    mockFrom.mockReturnValue(q);
    const { W, qc } = siapkan();
    const dariDaftar: Hutang = toHutang(baris);
    qc.setQueryData(['debts', 'list', false], [dariDaftar]);

    const { result } = await renderHook(() => useDebt('d1'), { wrapper: W });
    expect(result.current.data?.sisa_pokok).toBe(1100000);
    await waitFor(() => expect(result.current.data?.sisa_pokok).toBe(900000));
    expect(mockFrom).toHaveBeenCalledWith('v_hutang');
    expect(calls).toContainEqual(['eq', ['id', 'd1']]);
    expect(qc.getQueryData(['debts', 'one', 'd1'])).toBeDefined();
  });
});

describe('useDebtSchedule', () => {
  it('membaca debt_schedule milik hutang, urut jatuh_tempo', async () => {
    const { q, calls } = builder({
      data: [{ id: 's1', debt_id: 'd1', jatuh_tempo: '2026-12-05', nominal: '100000', status: 'belum', transaction_id: null }],
      error: null,
    });
    mockFrom.mockReturnValue(q);
    const { W, qc } = siapkan();
    const { result } = await renderHook(() => useDebtSchedule('d1'), { wrapper: W });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFrom).toHaveBeenCalledWith('debt_schedule');
    expect(calls).toContainEqual(['eq', ['debt_id', 'd1']]);
    expect(calls).toContainEqual(['order', ['jatuh_tempo', { ascending: true }]]);
    expect(result.current.data?.[0].nominal).toBe(100000);
    expect(qc.getQueryData(['debts', 'jadwal', 'd1'])).toBeDefined();
  });
});

describe('useUpdateDebt', () => {
  it('update tabel debts lalu invalidasi debts dan transactions', async () => {
    const { q, calls } = builder({ data: { id: 'd1' }, error: null });
    mockFrom.mockReturnValue(q);
    const { W, qc } = siapkan();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = await renderHook(() => useUpdateDebt(), { wrapper: W });
    await act(async () => {
      await result.current.mutateAsync({ id: 'd1', patch: { diarsip: true } });
    });
    expect(mockFrom).toHaveBeenCalledWith('debts');
    expect(calls).toContainEqual(['update', [{ diarsip: true }]]);
    expect(calls).toContainEqual(['eq', ['id', 'd1']]);
    const kunci = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(kunci).toEqual(expect.arrayContaining([['debts'], ['transactions']]));
  });

  it('galat P0001 dari trigger -> validasi dengan pesan apa adanya', async () => {
    const { q } = builder({ data: null, error: { code: 'P0001', message: 'Pembayaran melebihi sisa hutang' } });
    mockFrom.mockReturnValue(q);
    const { W } = siapkan();
    const { result } = await renderHook(() => useUpdateDebt(), { wrapper: W });
    await act(async () => {
      await result.current.mutateAsync({ id: 'd1', patch: { pokok_awal: 1 } }).catch(() => {});
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: 'validasi', pesan: 'Pembayaran melebihi sisa hutang' });
  });
});

describe('useDeleteDebt', () => {
  it('hapus dari debts lalu invalidasi debts, transactions, wallets', async () => {
    const { q, calls } = builder({ data: null, error: null });
    mockFrom.mockReturnValue(q);
    const { W, qc } = siapkan();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = await renderHook(() => useDeleteDebt(), { wrapper: W });
    await act(async () => {
      await result.current.mutateAsync('d1');
    });
    expect(mockFrom).toHaveBeenCalledWith('debts');
    expect(calls).toContainEqual(['delete', []]);
    expect(calls).toContainEqual(['eq', ['id', 'd1']]);
    const kunci = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(kunci).toEqual(expect.arrayContaining([['debts'], ['transactions'], ['wallets']]));
  });

  it('galat offline -> AppError offline', async () => {
    const { q } = builder({ data: null, error: new TypeError('Network request failed') });
    mockFrom.mockReturnValue(q);
    const { W } = siapkan();
    const { result } = await renderHook(() => useDeleteDebt(), { wrapper: W });
    await act(async () => {
      await result.current.mutateAsync('d1').catch(() => {});
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe('offline');
  });
});

describe('useTambahJadwal', () => {
  it('memanggil rpc tambah_jadwal dengan parameter p_* dan mengembalikan Tagihan', async () => {
    mockRpc.mockResolvedValue({
      data: { id: 's9', debt_id: 'd1', jatuh_tempo: '2026-12-10', nominal: '250000', status: 'belum', transaction_id: null },
      error: null,
    });
    const { W, qc } = siapkan();
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = await renderHook(() => useTambahJadwal(), { wrapper: W });
    let hasil: unknown;
    await act(async () => {
      hasil = await result.current.mutateAsync({ debt_id: 'd1', jatuh_tempo: '2026-12-10', nominal: 250000 });
    });
    expect(mockRpc).toHaveBeenCalledWith('tambah_jadwal', {
      p_debt: 'd1',
      p_jatuh_tempo: '2026-12-10',
      p_nominal: 250000,
    });
    expect(hasil).toMatchObject({ id: 's9', nominal: 250000 });
    expect(spy.mock.calls.map((c) => c[0]?.queryKey)).toContainEqual(['debts']);
  });

  it('rpc melempar (jaringan) -> AppError offline', async () => {
    mockRpc.mockRejectedValue(new TypeError('Network request failed'));
    const { W } = siapkan();
    const { result } = await renderHook(() => useTambahJadwal(), { wrapper: W });
    await act(async () => {
      await result.current.mutateAsync({ debt_id: 'd1', jatuh_tempo: '2026-12-10', nominal: 1 }).catch(() => {});
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe('offline');
  });
});
