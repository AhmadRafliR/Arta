// Inti parsing murni (tanpa import, tanpa API Deno/Node): dipakai Edge Function dan Jest.
// Bentuk tipe di sini dicerminkan di app (src/ai).

export type Konteks = {
  hariIni: string;
  dompet: { id: string; nama: string; tipe: 'harian' | 'darurat' | 'investasi' }[];
  kategori: { jenis: 'pemasukan' | 'pengeluaran'; nama: string }[];
};

export type DrafTx = {
  id: string;
  tanggal: string;
  jenis: 'pemasukan' | 'pengeluaran' | 'transfer';
  kategori: string;
  nominal: number;
  wallet_id: string | null;
  wallet_tujuan_id: string | null;
  catatan: string | null;
  peringatan: string[];
};

export type DrafKoreksi = { id: string; wallet_id: string; saldo_baru: number };

export type HasilParse = {
  draf: DrafTx[];
  koreksi: DrafKoreksi[];
  tidakDidukung: string[];
  butuh_klarifikasi: boolean;
  pertanyaan: string | null;
};

const PERTANYAAN_BAWAAN = 'Maaf, aku belum paham. Coba sebutkan nominal dan untuk apa.';

const JENIS = [
  'pemasukan',
  'pengeluaran',
  'transfer',
  'tabungan_setor',
  'tabungan_tarik',
  'hutang_baru',
  'hutang_bayar',
  'koreksi_saldo',
] as const;

export const SKEMA_PARSE = {
  type: 'object',
  additionalProperties: false,
  required: ['transaksi', 'butuh_klarifikasi', 'pertanyaan'],
  properties: {
    transaksi: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'tanggal',
          'jenis',
          'kategori',
          'nominal',
          'catatan',
          'dompet',
          'dompet_tujuan',
        ],
        properties: {
          tanggal: { type: 'string' },
          jenis: { type: 'string', enum: [...JENIS] },
          kategori: { type: 'string' },
          nominal: { type: 'integer' },
          catatan: { type: 'string' },
          dompet: { type: 'string' },
          dompet_tujuan: { type: 'string' },
        },
      },
    },
    butuh_klarifikasi: { type: 'boolean' },
    pertanyaan: { type: 'string' },
  },
} as const;

export function buatPrompt(k: Konteks): string {
  const dompet = k.dompet.map((d) => `${d.nama} (${d.tipe})`).join(', ') || '(belum ada)';
  const daftar = (j: 'pemasukan' | 'pengeluaran') =>
    k.kategori
      .filter((c) => c.jenis === j)
      .map((c) => c.nama)
      .join(', ') || 'lainnya';
  return `Kamu asisten pencatat keuangan pribadi untuk mahasiswa Indonesia. Ubah kalimat pengguna (hasil suara atau ketikan) menjadi daftar transaksi. Satu kalimat bisa berisi beberapa transaksi.

Hari ini: ${k.hariIni} (format tanggal YYYY-MM-DD).

Dompet pengguna: ${dompet}
Kategori pengeluaran pengguna: ${daftar('pengeluaran')}
Kategori pemasukan pengguna: ${daftar('pemasukan')}

Aturan:
- Nominal selalu integer rupiah: "15 rb"=15000, "1,5 jt"=1500000, "sejuta setengah"=1500000, "goceng"=5000, "ceban"=10000, "gocap"=50000, "cepek"=100000 (konteks ribuan), "seratus rebu"=100000.
- jenis: pemasukan, pengeluaran, transfer, tabungan_setor, tabungan_tarik, hutang_baru, hutang_bayar, atau koreksi_saldo.
- Kategori pengeluaran: pakai kategori milik pengguna di atas. kopi/jajan/minum -> makan; bensin/ojol/angkot -> transport; UKT/SPP/buku/fotokopi/print -> kuliah. Bila tidak ada yang cocok -> lainnya.
- Kategori pemasukan: pakai kategori milik pengguna di atas. Kiriman orang tua/mama/papa/ayah/ibu -> ortu. Bila tidak ada yang cocok -> lainnya.
- Dana darurat: nabung/setor -> tabungan_setor; ambil/tarik dari tabungan -> tabungan_tarik. Untuk keduanya, dompet = dompet harian yang disebut.
- Hutang: pinjam/minjem/ngutang -> hutang_baru; bayar hutang/nyicil/cicilan/angsuran -> hutang_bayar (kategori = nama pemberi). Tidak perlu bertanya soal nama.
- Dompet: dompet = yang disebut pengguna; pakai nama persis dari daftar dompet bila jelas. Untuk pemasukan, dompet = yang menerima. Bila tidak disebut, isi string kosong.
- Transfer: perpindahan antar dompet sendiri (top up, isi saldo, tarik tunai, pindah saldo) -> jenis transfer, kategori "transfer", dompet = asal, dompet_tujuan = tujuan. Ini bukan pengeluaran.
- koreksi_saldo: "saldo X sekarang N" / "update saldo X jadi N" -> jenis koreksi_saldo, dompet = X, nominal = N (saldo barunya, bukan selisih), kategori kosong.
- Tanggal: "kemarin" = hari ini dikurangi 1 hari; tanpa keterangan = hari ini.
- Catatan: detail singkat, boleh kosong.
- Klarifikasi: bila nominal tidak disebut atau ambigu, atau pesan bukan soal keuangan, isi butuh_klarifikasi=true, transaksi=[], dan pertanyaan singkat yang santai. Selain itu butuh_klarifikasi=false dan pertanyaan kosong.
- Isi semua field; yang tidak relevan diisi string kosong.`;
}

// Huruf kecil, buang semua selain huruf/angka.
const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const ALIAS: Record<string, string> = {
  gojek: 'gopay',
  tunai: 'cash',
  uangtunai: 'cash',
  uangcash: 'cash',
  spay: 'shopeepay',
  shopee: 'shopeepay',
};

export function cocokkanDompet(nama: string, dompet: Konteks['dompet']): string | null {
  const n = normal(nama);
  if (!n) return null;
  // Nama persis dulu, baru alias (dompet bernama "Tunai" harus cocok dengan dirinya).
  const persis = dompet.find((d) => normal(d.nama) === n);
  if (persis) return persis.id;
  const alias = ALIAS[n];
  return alias ? (dompet.find((d) => normal(d.nama) === alias)?.id ?? null) : null;
}

const adaObjek = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

const teks = (x: unknown): string => (typeof x === 'string' ? x.trim() : '');

function tanggalValid(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function nominalValid(x: unknown): number | null {
  const v = typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN;
  if (!Number.isFinite(v)) return null;
  const r = Math.round(v);
  return r > 0 ? r : null;
}

export function validasiHasil(
  mentah: unknown,
  k: Konteks,
  buatId: () => string,
): HasilParse {
  const rusak: HasilParse = {
    draf: [],
    koreksi: [],
    tidakDidukung: [],
    butuh_klarifikasi: true,
    pertanyaan: PERTANYAAN_BAWAAN,
  };
  if (!adaObjek(mentah)) return rusak;

  if (mentah.butuh_klarifikasi === true) {
    return {
      ...rusak,
      pertanyaan: teks(mentah.pertanyaan) || PERTANYAAN_BAWAAN,
    };
  }

  const items = Array.isArray(mentah.transaksi) ? mentah.transaksi : [];
  const draf: DrafTx[] = [];
  const koreksi: DrafKoreksi[] = [];
  const tidakDidukung: string[] = [];
  const darurat = k.dompet.find((d) => d.tipe === 'darurat')?.id ?? null;

  // Cari dompet; tambahkan peringatan bila kosong/tidak cocok.
  const cari = (nama: string, peringatan: string[]): string | null => {
    const id = cocokkanDompet(nama, k.dompet);
    if (id) return id;
    const w = nama ? `Dompet "${nama}" belum ada, pilih dompet` : 'Pilih dompet';
    if (!peringatan.includes(w)) peringatan.push(w);
    return null;
  };

  const kategoriUser = (jenis: 'pemasukan' | 'pengeluaran', nama: string): string => {
    const n = nama.toLowerCase();
    return k.kategori.find((c) => c.jenis === jenis && c.nama.toLowerCase() === n)?.nama ?? 'lainnya';
  };

  for (const mentahItem of items) {
    if (!adaObjek(mentahItem)) continue;
    const nominal = nominalValid(mentahItem.nominal);
    if (nominal === null) continue;
    const jenis = teks(mentahItem.jenis);
    const kategori = teks(mentahItem.kategori);
    const catatan = teks(mentahItem.catatan);
    const namaDompet = teks(mentahItem.dompet);
    const namaTujuan = teks(mentahItem.dompet_tujuan);
    const tgl = teks(mentahItem.tanggal);
    const tanggal = tanggalValid(tgl) ? tgl : k.hariIni;
    const peringatan: string[] = [];
    const dasar = { tanggal, nominal, catatan: catatan || null };

    if (jenis === 'pemasukan' || jenis === 'pengeluaran') {
      const wallet_id = cari(namaDompet, peringatan);
      draf.push({
        id: buatId(),
        ...dasar,
        jenis,
        kategori: kategoriUser(jenis, kategori),
        wallet_id,
        wallet_tujuan_id: null,
        peringatan,
      });
    } else if (jenis === 'transfer') {
      const asal = cari(namaDompet, peringatan);
      const tujuan = cari(namaTujuan, peringatan);
      if (asal && tujuan && asal === tujuan) {
        tidakDidukung.push('Transfer ke dompet yang sama dilewati');
        continue;
      }
      draf.push({
        id: buatId(),
        ...dasar,
        jenis: 'transfer',
        kategori: 'transfer',
        wallet_id: asal,
        wallet_tujuan_id: tujuan,
        peringatan,
      });
    } else if (jenis === 'tabungan_setor' || jenis === 'tabungan_tarik') {
      const harian = cari(namaDompet, peringatan);
      if (!darurat) peringatan.push('Belum punya dompet dana darurat');
      const setor = jenis === 'tabungan_setor';
      if (harian && darurat && harian === darurat) {
        tidakDidukung.push('Transfer ke dompet yang sama dilewati');
        continue;
      }
      draf.push({
        id: buatId(),
        ...dasar,
        jenis: 'transfer',
        kategori: 'transfer',
        wallet_id: setor ? harian : darurat,
        wallet_tujuan_id: setor ? darurat : harian,
        peringatan,
      });
    } else if (jenis === 'hutang_baru' || jenis === 'hutang_bayar') {
      tidakDidukung.push(
        `Pencatatan hutang belum didukung (menyusul): ${catatan || kategori || 'tanpa keterangan'}`,
      );
    } else if (jenis === 'koreksi_saldo') {
      const id = cocokkanDompet(namaDompet, k.dompet);
      if (id) {
        koreksi.push({ id: buatId(), wallet_id: id, saldo_baru: nominal });
      } else {
        tidakDidukung.push(
          namaDompet
            ? `Koreksi saldo dilewati: dompet "${namaDompet}" belum ada`
            : 'Koreksi saldo dilewati: dompet tidak disebut',
        );
      }
    }
    // jenis lain: diabaikan
  }

  // Tidak ada hasil yang bisa dipakai sama sekali: minta klarifikasi (tidak memakai kuota).
  if (!draf.length && !koreksi.length && !tidakDidukung.length) return rusak;

  return { draf, koreksi, tidakDidukung, butuh_klarifikasi: false, pertanyaan: null };
}
