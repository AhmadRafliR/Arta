import {
  buatPrompt,
  cocokkanDompet,
  SKEMA_PARSE,
  validasiHasil,
  type Konteks,
} from '../parsing';

const K: Konteks = {
  hariIni: '2026-11-20',
  dompet: [
    { id: 'w-gopay', nama: 'GoPay', tipe: 'harian' },
    { id: 'w-cash', nama: 'Cash', tipe: 'harian' },
    { id: 'w-spay', nama: 'ShopeePay', tipe: 'harian' },
    { id: 'w-dar', nama: 'Dana darurat', tipe: 'darurat' },
  ],
  kategori: [
    { jenis: 'pengeluaran', nama: 'makan' },
    { jenis: 'pengeluaran', nama: 'transport' },
    { jenis: 'pengeluaran', nama: 'lainnya' },
    { jenis: 'pemasukan', nama: 'ortu' },
    { jenis: 'pemasukan', nama: 'lainnya' },
  ],
};

let n = 0;
const buatId = () => `id-${++n}`;
const item = (o: Record<string, unknown>) => ({
  tanggal: '2026-11-20',
  jenis: 'pengeluaran',
  kategori: 'makan',
  nominal: 10000,
  catatan: '',
  dompet: 'gopay',
  dompet_tujuan: '',
  ...o,
});
const parse = (transaksi: unknown[], extra: Record<string, unknown> = {}) =>
  validasiHasil(
    { transaksi, butuh_klarifikasi: false, pertanyaan: '', ...extra },
    K,
    buatId,
  );

describe('cocokkanDompet', () => {
  it('alias dan nama', () => {
    expect(cocokkanDompet('gojek', K.dompet)).toBe('w-gopay');
    expect(cocokkanDompet('Tunai', K.dompet)).toBe('w-cash');
    expect(cocokkanDompet('shopee pay', K.dompet)).toBe('w-spay');
    expect(cocokkanDompet('Go-Pay', K.dompet)).toBe('w-gopay');
  });
  it('tidak cocok -> null', () => {
    expect(cocokkanDompet('dana', K.dompet)).toBeNull();
    expect(cocokkanDompet('', K.dompet)).toBeNull();
  });
});

describe('validasiHasil', () => {
  it('pengeluaran: kategori tak dikenal jadi lainnya, nominal dibulatkan', () => {
    const r = parse([
      item({ kategori: 'Kopi', nominal: 15000.4 }),
      item({ kategori: 'makan' }),
    ]);
    expect(r.draf[0]).toMatchObject({
      jenis: 'pengeluaran',
      kategori: 'lainnya',
      nominal: 15000,
      wallet_id: 'w-gopay',
      peringatan: [],
    });
    expect(r.draf[1].kategori).toBe('makan');
  });

  it('kategori case-insensitive, keluaran ejaan pengguna', () => {
    expect(parse([item({ kategori: 'MAKAN' })]).draf[0].kategori).toBe('makan');
  });

  it('pemasukan', () => {
    const r = parse([item({ jenis: 'pemasukan', kategori: 'ortu' })]);
    expect(r.draf[0]).toMatchObject({ jenis: 'pemasukan', kategori: 'ortu' });
  });

  it('dompet tidak dikenal / kosong', () => {
    const a = parse([item({ dompet: 'dana' })]).draf[0];
    expect(a.wallet_id).toBeNull();
    expect(a.peringatan).toEqual(['Dompet "dana" belum ada, pilih dompet']);
    const b = parse([item({ dompet: '' })]).draf[0];
    expect(b.wallet_id).toBeNull();
    expect(b.peringatan).toEqual(['Pilih dompet']);
  });

  it('transfer', () => {
    const r = parse([
      item({ jenis: 'transfer', dompet: 'cash', dompet_tujuan: 'shopeepay' }),
    ]);
    expect(r.draf[0]).toMatchObject({
      jenis: 'transfer',
      kategori: 'transfer',
      wallet_id: 'w-cash',
      wallet_tujuan_id: 'w-spay',
    });
  });

  it('transfer ke dompet sama dibuang', () => {
    const r = parse([
      item({ jenis: 'transfer', dompet: 'cash', dompet_tujuan: 'tunai' }),
    ]);
    expect(r.draf).toEqual([]);
    expect(r.tidakDidukung).toContain('Transfer ke dompet yang sama dilewati');
  });

  it('transfer sebagian tak cocok tetap jadi draf dengan peringatan', () => {
    const r = parse([
      item({ jenis: 'transfer', dompet: 'cash', dompet_tujuan: 'dana' }),
      item({ jenis: 'transfer', dompet: 'cash', dompet_tujuan: '' }),
    ]);
    expect(r.draf[0]).toMatchObject({ wallet_id: 'w-cash', wallet_tujuan_id: null });
    expect(r.draf[0].peringatan).toEqual(['Dompet "dana" belum ada, pilih dompet']);
    expect(r.draf[1].peringatan).toEqual(['Pilih dompet']);
  });

  it('dana darurat', () => {
    const s = parse([item({ jenis: 'tabungan_setor', nominal: 50000 })]).draf[0];
    expect(s).toMatchObject({
      jenis: 'transfer',
      kategori: 'transfer',
      wallet_id: 'w-gopay',
      wallet_tujuan_id: 'w-dar',
    });
    const t = parse([item({ jenis: 'tabungan_tarik', dompet: 'cash' })]).draf[0];
    expect(t).toMatchObject({
      jenis: 'transfer',
      wallet_id: 'w-dar',
      wallet_tujuan_id: 'w-cash',
    });
  });

  it('tanpa dompet darurat', () => {
    const k2: Konteks = { ...K, dompet: K.dompet.filter((d) => d.tipe !== 'darurat') };
    const r = validasiHasil(
      { transaksi: [item({ jenis: 'tabungan_setor' })], butuh_klarifikasi: false, pertanyaan: '' },
      k2,
      buatId,
    );
    expect(r.draf[0].wallet_tujuan_id).toBeNull();
    expect(r.draf[0].peringatan).toContain('Belum punya dompet dana darurat');
  });

  it('hutang tidak didukung', () => {
    const r = parse([
      item({ jenis: 'hutang_bayar', catatan: 'cicil ke Budi' }),
      item({ jenis: 'hutang_baru', catatan: '', kategori: 'Andi' }),
    ]);
    expect(r.draf).toEqual([]);
    expect(r.tidakDidukung).toEqual([
      'Pencatatan hutang belum didukung (menyusul): cicil ke Budi',
      'Pencatatan hutang belum didukung (menyusul): Andi',
    ]);
  });

  it('koreksi saldo', () => {
    const r = parse([item({ jenis: 'koreksi_saldo', dompet: 'gopay', nominal: 150000 })]);
    expect(r.koreksi).toEqual([{ id: expect.any(String), wallet_id: 'w-gopay', saldo_baru: 150000 }]);
    expect(r.draf).toEqual([]);
    const x = parse([item({ jenis: 'koreksi_saldo', dompet: 'dana', nominal: 1000 })]);
    expect(x.koreksi).toEqual([]);
    expect(x.tidakDidukung).toHaveLength(1);
  });

  it('data tidak layak dibuang, tanggal buruk diganti', () => {
    const r = parse([
      item({ nominal: 0 }),
      item({ nominal: -5 }),
      item({ nominal: NaN }),
      item({ nominal: 'abc' }),
      item({ nominal: '12000', tanggal: 'kemarin' }),
      item({ tanggal: '' }),
      item({ tanggal: '2026-02-31' }),
    ]);
    expect(r.draf).toHaveLength(3);
    expect(r.draf[0].nominal).toBe(12000);
    expect(r.draf.every((d) => d.tanggal === '2026-11-20')).toBe(true);
  });

  it('klarifikasi', () => {
    const r = parse([item({})], { butuh_klarifikasi: true, pertanyaan: 'Berapa?' });
    expect(r).toMatchObject({ draf: [], butuh_klarifikasi: true, pertanyaan: 'Berapa?' });
  });

  it('input rusak', () => {
    for (const bad of [null, 'x', 5, undefined]) {
      expect(validasiHasil(bad, K, buatId)).toMatchObject({
        draf: [],
        butuh_klarifikasi: true,
        pertanyaan: 'Maaf, aku belum paham. Coba sebutkan nominal dan untuk apa.',
      });
    }
  });

  it('id unik', () => {
    const r = parse([item({}), item({ jenis: 'koreksi_saldo', nominal: 5 })]);
    const ids = [...r.draf.map((d) => d.id), ...r.koreksi.map((d) => d.id)];
    expect(new Set(ids).size).toBe(2);
  });
});

describe('buatPrompt & skema', () => {
  it('prompt memuat konteks', () => {
    const p = buatPrompt(K);
    for (const s of ['2026-11-20', 'GoPay', 'Dana darurat', 'koreksi_saldo', 'ortu']) {
      expect(p).toContain(s);
    }
  });
  it('skema strict', () => {
    const cek = (o: any) => {
      if (o && o.type === 'object') {
        expect(o.additionalProperties).toBe(false);
        expect([...o.required].sort()).toEqual(Object.keys(o.properties).sort());
        Object.values(o.properties).forEach(cek);
      }
      if (o && o.type === 'array') cek(o.items);
    };
    cek(SKEMA_PARSE);
    expect(JSON.stringify(SKEMA_PARSE)).not.toContain('default');
  });
});
