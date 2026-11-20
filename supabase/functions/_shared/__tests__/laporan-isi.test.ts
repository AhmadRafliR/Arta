import { buatIsiLaporan, formatRupiah, labelBulanPanjang, type DataLaporan } from '../laporan/isi';
import { formatRupiah as formatAsli } from '../../../../src/domain/money';

const tx = (
  id: string,
  tanggal: string,
  jenis: string,
  nominal: number,
  o: Partial<DataLaporan['txs'][number]> = {},
): DataLaporan['txs'][number] => ({
  id,
  tanggal,
  jenis,
  kategori: null,
  nominal,
  wallet_id: null,
  wallet_tujuan_id: null,
  catatan: null,
  ...o,
});

const DATA: DataLaporan = {
  nama: 'Rafli',
  zona: 'Asia/Jakarta',
  wallets: [
    { id: 'gopay', nama: 'GoPay', tipe: 'harian', saldo_awal: 152000, target: null, diarsip: false },
    { id: 'cash', nama: 'Cash', tipe: 'harian', saldo_awal: 106000, target: null, diarsip: false },
    { id: 'dar', nama: 'Dana darurat', tipe: 'darurat', saldo_awal: 1000000, target: 3000000, diarsip: false },
    { id: 'saham', nama: 'Saham', tipe: 'investasi', saldo_awal: 500000, target: null, diarsip: false },
  ],
  txs: [
    tx('1', '2026-11-02', 'pemasukan', 1500000, { wallet_id: 'gopay', kategori: 'ortu' }),
    tx('2', '2026-11-03', 'pengeluaran', 320000, { wallet_id: 'gopay', kategori: 'Makan', catatan: 'makan bareng' }),
    tx('3', '2026-11-04', 'pengeluaran', 390000, { wallet_id: 'cash', kategori: 'rokok' }),
    tx('4', '2026-11-05', 'pengeluaran', 2000, { wallet_id: 'cash', kategori: 'parkir' }),
    tx('5', '2026-11-06', 'pengeluaran', 2000, { wallet_id: 'cash', kategori: 'parkir' }),
    tx('6', '2026-11-07', 'pengeluaran', 2000, { wallet_id: 'cash', kategori: 'parkir' }),
    tx('7', '2026-11-08', 'pengeluaran', 50000, { wallet_id: 'gopay', kategori: 'transport' }),
    tx('8', '2026-11-09', 'transfer', 100000, { wallet_id: 'gopay', wallet_tujuan_id: 'dar' }),
    tx('9', '2026-11-10', 'transfer', 200000, { wallet_id: 'cash', wallet_tujuan_id: 'saham' }),
    tx('10', '2026-11-15', 'penyesuaian', 30000, { wallet_id: 'saham' }),
    tx('11', '2026-12-01', 'pengeluaran', 999000, { wallet_id: 'gopay', kategori: 'makan' }),
  ],
  budgets: [
    { kategori: 'makan', batas_bulanan: 800000 },
    { kategori: 'Rokok', batas_bulanan: 300000 },
    { kategori: 'kuliah', batas_bulanan: 500000 },
  ],
  hutang: [
    { pemberi: 'Kredivo', sisa_pokok: 1200000, jatuh_tempo_berikutnya: '2026-12-05', nominal_berikutnya: 400000, diarsip: false },
    { pemberi: 'Teman', sisa_pokok: 0, jatuh_tempo_berikutnya: null, nominal_berikutnya: null, diarsip: false },
  ],
};

describe('formatRupiah lokal', () => {
  it('sama persis dengan src/domain/money', () => {
    for (const n of [0, 5, 999, 1000, 49000, -49000, 1200000, -1200000, 1234567890, 12.6]) {
      expect(formatRupiah(n)).toBe(formatAsli(n));
    }
  });
  it('labelBulanPanjang', () => {
    expect(labelBulanPanjang('2026-11')).toBe('November 2026');
    expect(labelBulanPanjang('2027-01')).toBe('Januari 2027');
  });
});

describe('buatIsiLaporan', () => {
  const isi = buatIsiLaporan(DATA, '2026-11');

  it('ringkasan', () => {
    expect(isi.labelBulan).toBe('November 2026');
    expect(isi.sampai).toBe('2026-11-30');
    expect(isi.ringkasan).toEqual({
      pemasukan: 1500000,
      pengeluaran: 766000,
      setorDarurat: 100000,
      tarikDarurat: 0,
      bayarHutang: 0,
      selisih: 734000,
      totalSaldo: 2522000,
    });
  });

  it('kategori urut total menurun dengan status budget', () => {
    expect(isi.kategori.map((k) => k.kategori)).toEqual(['rokok', 'Makan', 'transport', 'parkir', 'kuliah']);
    expect(isi.kategori[0]).toMatchObject({ total: 390000, batas: 300000, persen: 130, status: 'lewat' });
    expect(isi.kategori[1]).toMatchObject({ total: 320000, batas: 800000, persen: 40, status: 'aman' });
    expect(isi.kategori[2]).toMatchObject({ batas: null, persen: null, status: null });
    expect(isi.kategori[4]).toMatchObject({ total: 0, batas: 500000, persen: 0, status: 'aman' });
  });

  it('ambang waspada tepat 80% dan 100%', () => {
    const d: DataLaporan = {
      ...DATA,
      txs: [
        tx('a', '2026-11-01', 'pengeluaran', 80, { wallet_id: 'gopay', kategori: 'a' }),
        tx('b', '2026-11-01', 'pengeluaran', 100, { wallet_id: 'gopay', kategori: 'b' }),
        tx('c', '2026-11-01', 'pengeluaran', 79, { wallet_id: 'gopay', kategori: 'c' }),
      ],
      budgets: [
        { kategori: 'a', batas_bulanan: 100 },
        { kategori: 'b', batas_bulanan: 100 },
        { kategori: 'c', batas_bulanan: 100 },
      ],
    };
    const s = Object.fromEntries(buatIsiLaporan(d, '2026-11').kategori.map((k) => [k.kategori, k.status]));
    expect(s).toEqual({ a: 'waspada', b: 'waspada', c: 'aman' });
  });

  it('5 pengeluaran terbesar', () => {
    expect(isi.terbesar).toHaveLength(5);
    expect(isi.terbesar[0]).toEqual({
      tanggal: '2026-11-04',
      kategori: 'rokok',
      nominal: 390000,
      catatan: '',
      dompet: 'Cash',
    });
    expect(isi.terbesar[1].catatan).toBe('makan bareng');
    expect(isi.terbesar.map((t) => t.nominal)).toEqual([390000, 320000, 50000, 2000, 2000]);
  });

  it('dana darurat, investasi, hutang, kekayaan bersih', () => {
    expect(isi.danaDarurat).toEqual({ saldo: 1100000, target: 3000000, persen: 36 });
    expect(isi.investasi).toEqual([{ nama: 'Saham', nilai: 730000, untung: 30000 }]);
    expect(isi.hutang).toEqual([
      { pemberi: 'Kredivo', sisa: 1200000, jatuhTempo: '2026-12-05', nominal: 400000 },
    ]);
    expect(isi.totalHutang).toBe(1200000);
    expect(isi.kekayaanBersih).toBe(1322000);
  });

  it('hutang null: bagian null dan total 0', () => {
    const i = buatIsiLaporan({ ...DATA, hutang: null }, '2026-11');
    expect(i.hutang).toBeNull();
    expect(i.totalHutang).toBe(0);
    expect(i.kekayaanBersih).toBe(2522000);
  });

  it('tanpa dompet darurat: danaDarurat null', () => {
    const i = buatIsiLaporan({ ...DATA, wallets: DATA.wallets.filter((w) => w.tipe !== 'darurat') }, '2026-11');
    expect(i.danaDarurat).toBeNull();
    expect(i.ringkasan.setorDarurat).toBe(0);
  });

  it('tarik dana darurat', () => {
    const d: DataLaporan = {
      ...DATA,
      txs: [tx('t', '2026-11-03', 'transfer', 70000, { wallet_id: 'dar', wallet_tujuan_id: 'gopay' })],
    };
    const i = buatIsiLaporan(d, '2026-11');
    expect(i.ringkasan.tarikDarurat).toBe(70000);
    expect(i.ringkasan.setorDarurat).toBe(0);
  });

  it('sampai di tengah bulan memotong transaksi', () => {
    const i = buatIsiLaporan(DATA, '2026-11', '2026-11-04');
    expect(i.sampai).toBe('2026-11-04');
    expect(i.ringkasan.pemasukan).toBe(1500000);
    expect(i.ringkasan.pengeluaran).toBe(710000);
    expect(i.ringkasan.setorDarurat).toBe(0);
    expect(i.danaDarurat?.saldo).toBe(1000000);
    expect(i.investasi[0]).toMatchObject({ nilai: 500000, untung: 0 });
  });
});
