import { mutasiDarurat, rataPengeluaran } from '../danaDarurat';
import type { Jenis } from '../types';

const peng = (nominal: number, tanggal: string, jenis: Jenis = 'pengeluaran') => ({ jenis, nominal, tanggal });

describe('rataPengeluaran', () => {
  it('rata-rata 3 bulan sebelumnya, bulan kosong tidak ikut; null bila tak ada', () => {
    const txs = [peng(1000000, '2026-08-10'), peng(2000000, '2026-10-10'), peng(9000000, '2026-11-02')];
    expect(rataPengeluaran(txs, '2026-11')).toBe(1500000);
    expect(rataPengeluaran([], '2026-11')).toBeNull();
  });
});

describe('mutasiDarurat', () => {
  const t = (
    id: string,
    tanggal: string,
    jenis: Jenis,
    nominal: number,
    wallet_id: string | null,
    wallet_tujuan_id: string | null = null,
  ) => ({ id, tanggal, jenis, nominal, wallet_id, wallet_tujuan_id, catatan: null });
  const nama = { h1: 'GoPay', d1: 'Darurat' };

  it('transfer masuk/keluar, penyesuaian bertanda, terbaru dulu, dompet lain diabaikan', () => {
    const r = mutasiDarurat(
      [
        t('a', '2026-10-01', 'transfer', 500000, 'h1', 'd1'),
        t('b', '2026-11-02', 'transfer', 200000, 'd1', 'h1'),
        t('c', '2026-11-03', 'penyesuaian', -50000, 'd1'),
        t('x', '2026-11-04', 'pengeluaran', 10000, 'h1'),
      ],
      'd1',
      nama,
    );
    expect(r.map((m) => [m.id, m.arah, m.nominal, m.lawan])).toEqual([
      ['c', 'keluar', 50000, null],
      ['b', 'keluar', 200000, 'GoPay'],
      ['a', 'masuk', 500000, 'GoPay'],
    ]);
  });
});
