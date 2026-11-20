import { ambilSemua } from '../ambil';

type Panggilan = { tabel: string; ops: [string, ...unknown[]][] };
const mockPanggilan: Panggilan[] = [];
let mockData: Record<string, unknown>[] = [];
let mockGalat: unknown = null;

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (tabel: string) => {
      const p: Panggilan = { tabel, ops: [] };
      mockPanggilan.push(p);
      const b: Record<string, unknown> = {};
      for (const op of ['select', 'gte', 'lte', 'order']) {
        b[op] = (...a: unknown[]) => {
          p.ops.push([op, ...a]);
          return b;
        };
      }
      b.range = async (dari: number, sampai: number) => {
        p.ops.push(['range', dari, sampai]);
        if (mockGalat) return { data: null, error: mockGalat };
        return { data: mockData.slice(dari, sampai + 1), error: null };
      };
      return b;
    },
  },
}));

const baris = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i}` }));

beforeEach(() => {
  mockPanggilan.length = 0;
  mockGalat = null;
});

describe('ambilSemua', () => {
  it('2500 baris -> 3 panggilan .range() per 1000', async () => {
    mockData = baris(2500);
    const hasil = await ambilSemua('transactions', 'id,tanggal', { kolom: 'tanggal', naik: true });
    expect(hasil).toHaveLength(2500);
    expect(hasil[2499]).toEqual({ id: 't2499' });
    expect(mockPanggilan).toHaveLength(3);
    expect(mockPanggilan.map((p) => p.ops.find((o) => o[0] === 'range'))).toEqual([
      ['range', 0, 999],
      ['range', 1000, 1999],
      ['range', 2000, 2999],
    ]);
  });

  it('tepat 1000 baris -> halaman kedua kosong menghentikan loop', async () => {
    mockData = baris(1000);
    expect(await ambilSemua('wallets', 'id', { kolom: 'id', naik: true })).toHaveLength(1000);
    expect(mockPanggilan).toHaveLength(2);
  });

  it('urutan + pemutus seri id, filter tanggal inklusif', async () => {
    mockData = baris(3);
    await ambilSemua('transactions', 'id,tanggal', { kolom: 'tanggal', naik: false }, {
      kolom: 'tanggal',
      dari: '2026-11-01',
      sampai: '2026-11-30',
    });
    expect(mockPanggilan[0]).toEqual({
      tabel: 'transactions',
      ops: [
        ['select', 'id,tanggal'],
        ['gte', 'tanggal', '2026-11-01'],
        ['lte', 'tanggal', '2026-11-30'],
        ['order', 'tanggal', { ascending: false }],
        ['order', 'id', { ascending: true }],
        ['range', 0, 999],
      ],
    });
  });

  it('urut berdasarkan id tidak ditambah pemutus seri ganda', async () => {
    mockData = [];
    await ambilSemua('wallets', 'id,nama', { kolom: 'id', naik: true });
    expect(mockPanggilan[0].ops.filter((o) => o[0] === 'order')).toHaveLength(1);
  });

  it('galat -> AppError', async () => {
    mockGalat = { message: 'Network request failed' };
    await expect(ambilSemua('wallets', 'id', { kolom: 'id', naik: true })).rejects.toMatchObject({ kind: 'offline' });
  });
});
