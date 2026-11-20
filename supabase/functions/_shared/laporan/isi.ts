// Isi laporan bulanan: fungsi murni tanpa import selain file relatif (Deno + Jest).

export type TipeDompet = 'harian' | 'darurat' | 'investasi';

export type DataLaporan = {
  nama: string | null;
  zona: string;
  wallets: {
    id: string;
    nama: string;
    tipe: TipeDompet;
    saldo_awal: number;
    target: number | null;
    diarsip: boolean;
  }[];
  txs: {
    id: string;
    tanggal: string;
    jenis: string;
    kategori: string | null;
    nominal: number;
    wallet_id: string | null;
    wallet_tujuan_id: string | null;
    catatan: string | null;
  }[];
  budgets: { kategori: string; batas_bulanan: number }[];
  hutang:
    | {
        pemberi: string;
        sisa_pokok: number;
        jatuh_tempo_berikutnya: string | null;
        nominal_berikutnya: number | null;
        diarsip: boolean;
      }[]
    | null;
};

export type StatusBudget = 'aman' | 'waspada' | 'lewat';

export type IsiLaporan = {
  bulan: string;
  labelBulan: string;
  sampai: string;
  nama: string | null;
  ringkasan: {
    pemasukan: number;
    pengeluaran: number;
    setorDarurat: number;
    tarikDarurat: number;
    bayarHutang: number;
    selisih: number;
    totalSaldo: number;
  };
  kategori: {
    kategori: string;
    total: number;
    batas: number | null;
    persen: number | null;
    status: StatusBudget | null;
  }[];
  terbesar: { tanggal: string; kategori: string; nominal: number; catatan: string; dompet: string }[];
  danaDarurat: { saldo: number; target: number | null; persen: number | null } | null;
  investasi: { nama: string; nilai: number; untung: number }[];
  hutang: { pemberi: string; sisa: number; jatuhTempo: string | null; nominal: number | null }[] | null;
  totalHutang: number;
  kekayaanBersih: number;
};

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function titikRibuan(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatRupiah(n: number): string {
  const abs = Math.abs(Math.round(n));
  return `${n < 0 ? '-' : ''}Rp${titikRibuan(abs)}`;
}

export function labelBulanPanjang(bulan: string): string {
  const [t, b] = bulan.split('-');
  const nama = NAMA_BULAN[Number(b) - 1] ?? bulan;
  return `${nama} ${t}`;
}

function akhirBulan(bulan: string): string {
  const [t, b] = bulan.split('-').map(Number);
  const hari = new Date(Date.UTC(t, b, 0)).getUTCDate();
  return `${bulan}-${String(hari).padStart(2, '0')}`;
}

type Tx = DataLaporan['txs'][number];

// Salinan logika src/domain/balances.ts (saldo awal + efek transaksi).
function hitungSaldo(wallets: DataLaporan['wallets'], txs: Tx[]): Record<string, number> {
  const bal: Record<string, number> = {};
  for (const w of wallets) bal[w.id] = w.saldo_awal;
  const tambah = (id: string | null, delta: number) => {
    if (id !== null && id in bal) bal[id] += delta;
  };
  for (const t of txs) {
    switch (t.jenis) {
      case 'pemasukan':
      case 'hutang_baru':
      case 'penyesuaian':
        tambah(t.wallet_id, t.nominal);
        break;
      case 'pengeluaran':
      case 'hutang_bayar':
        tambah(t.wallet_id, -t.nominal);
        break;
      case 'transfer':
        tambah(t.wallet_id, -t.nominal);
        tambah(t.wallet_tujuan_id, t.nominal);
        break;
    }
  }
  return bal;
}

const kunci = (s: string) => s.trim().toLowerCase();

export function buatIsiLaporan(d: DataLaporan, bulan: string, sampai?: string): IsiLaporan {
  const akhir = sampai ?? akhirBulan(bulan);
  const awal = `${bulan}-01`;
  const sdSampai = d.txs.filter((t) => t.tanggal <= akhir);
  const bulanIni = sdSampai.filter((t) => t.tanggal >= awal);

  const saldo = hitungSaldo(d.wallets, sdSampai);
  const tipeDompet = new Map(d.wallets.map((w) => [w.id, w.tipe]));
  const namaDompet = new Map(d.wallets.map((w) => [w.id, w.nama]));

  let pemasukan = 0;
  let pengeluaran = 0;
  let setorDarurat = 0;
  let tarikDarurat = 0;
  let bayarHutang = 0;
  for (const t of bulanIni) {
    if (t.jenis === 'pemasukan') pemasukan += t.nominal;
    else if (t.jenis === 'pengeluaran') pengeluaran += t.nominal;
    else if (t.jenis === 'hutang_bayar') bayarHutang += t.nominal;
    else if (t.jenis === 'transfer') {
      const dari = t.wallet_id ? tipeDompet.get(t.wallet_id) : undefined;
      const ke = t.wallet_tujuan_id ? tipeDompet.get(t.wallet_tujuan_id) : undefined;
      if (ke === 'darurat' && dari !== undefined && dari !== 'darurat') setorDarurat += t.nominal;
      if (dari === 'darurat' && ke !== undefined && ke !== 'darurat') tarikDarurat += t.nominal;
    }
  }
  const totalSaldo = Object.values(saldo).reduce((s, v) => s + v, 0);

  // Kategori: pengeluaran bulan ini ∪ kategori ber-budget.
  const peta = new Map<string, { kategori: string; total: number; batas: number | null }>();
  for (const t of bulanIni) {
    if (t.jenis !== 'pengeluaran') continue;
    const nama = (t.kategori ?? '').trim() || 'Lainnya';
    const k = kunci(nama);
    const e = peta.get(k) ?? { kategori: nama, total: 0, batas: null };
    e.total += t.nominal;
    peta.set(k, e);
  }
  for (const b of d.budgets) {
    const k = kunci(b.kategori);
    const e = peta.get(k) ?? { kategori: b.kategori.trim(), total: 0, batas: null };
    e.batas = b.batas_bulanan;
    peta.set(k, e);
  }
  const kategori = [...peta.values()]
    .map((e) => {
      const ada = e.batas !== null && e.batas > 0;
      let status: StatusBudget | null = null;
      if (ada) {
        const batas = e.batas as number;
        status = e.total > batas ? 'lewat' : e.total * 100 >= batas * 80 ? 'waspada' : 'aman';
      }
      return {
        kategori: e.kategori,
        total: e.total,
        batas: ada ? e.batas : null,
        persen: ada ? Math.floor((e.total / (e.batas as number)) * 100) : null,
        status,
      };
    })
    .sort((a, b) => b.total - a.total || a.kategori.localeCompare(b.kategori));

  const terbesar = bulanIni
    .filter((t) => t.jenis === 'pengeluaran')
    .sort((a, b) => b.nominal - a.nominal || (a.tanggal < b.tanggal ? 1 : -1))
    .slice(0, 5)
    .map((t) => ({
      tanggal: t.tanggal,
      kategori: (t.kategori ?? '').trim() || 'Lainnya',
      nominal: t.nominal,
      catatan: t.catatan ?? '',
      dompet: (t.wallet_id && namaDompet.get(t.wallet_id)) || '',
    }));

  const darurat = d.wallets.filter((w) => w.tipe === 'darurat' && !w.diarsip);
  let danaDarurat: IsiLaporan['danaDarurat'] = null;
  if (darurat.length > 0) {
    const s = darurat.reduce((a, w) => a + (saldo[w.id] ?? 0), 0);
    const adaTarget = darurat.some((w) => w.target !== null);
    const target = adaTarget ? darurat.reduce((a, w) => a + (w.target ?? 0), 0) : null;
    danaDarurat = {
      saldo: s,
      target,
      persen: target !== null && target > 0 ? Math.floor((s / target) * 100) : null,
    };
  }

  const investasi = d.wallets
    .filter((w) => w.tipe === 'investasi' && !w.diarsip)
    .map((w) => {
      let modal = w.saldo_awal;
      for (const t of sdSampai) {
        if (t.jenis === 'transfer') {
          if (t.wallet_tujuan_id === w.id) modal += t.nominal;
          if (t.wallet_id === w.id) modal -= t.nominal;
        } else if (t.wallet_id === w.id) {
          if (t.jenis === 'hutang_baru') modal += t.nominal;
          else if (t.jenis === 'hutang_bayar') modal -= t.nominal;
        }
      }
      const nilai = saldo[w.id] ?? 0;
      return { nama: w.nama, nilai, untung: nilai - modal };
    });

  const hutang =
    d.hutang === null
      ? null
      : d.hutang
          .filter((h) => !h.diarsip && h.sisa_pokok > 0)
          .map((h) => ({
            pemberi: h.pemberi,
            sisa: h.sisa_pokok,
            jatuhTempo: h.jatuh_tempo_berikutnya,
            nominal: h.nominal_berikutnya,
          }));
  const totalHutang = hutang ? hutang.reduce((s, h) => s + h.sisa, 0) : 0;

  return {
    bulan,
    labelBulan: labelBulanPanjang(bulan),
    sampai: akhir,
    nama: d.nama,
    ringkasan: {
      pemasukan,
      pengeluaran,
      setorDarurat,
      tarikDarurat,
      bayarHutang,
      selisih: pemasukan - pengeluaran,
      totalSaldo,
    },
    kategori,
    terbesar,
    danaDarurat,
    investasi,
    hutang,
    totalHutang,
    kekayaanBersih: totalSaldo - totalHutang,
  };
}
