export type Jenis =
  | 'pemasukan'
  | 'pengeluaran'
  | 'transfer'
  | 'hutang_baru'
  | 'hutang_bayar'
  | 'penyesuaian';

export type TipeDompet = 'harian' | 'darurat' | 'investasi';

export type Sumber = 'ai' | 'manual' | 'import';

export type Wallet = {
  id: string;
  nama: string;
  tipe: TipeDompet;
  saldo_awal: number;
  tanggal_saldo_awal: string; // 'YYYY-MM-DD'
  target: number | null;
  diarsip: boolean;
};

export type TipeHutang = 'cicilan_tetap' | 'berbunga';

export type MetodeBunga = 'flat' | 'efektif';

/** Satu baris view `v_hutang` (angka sudah dikonversi ke number). */
export type Hutang = {
  id: string;
  pemberi: string;
  tipe: TipeHutang;
  tanggal_mulai: string; // 'YYYY-MM-DD'
  pokok_awal: number;
  nominal_cicilan: number | null;
  tenor_bulan: number | null;
  bunga_persen_bulanan: number | null;
  metode: MetodeBunga | null;
  diarsip: boolean;
  sisa_pokok: number;
  total_bunga: number;
  total_bayar: number;
  jumlah_tagihan: number;
  tagihan_lunas: number;
  jatuh_tempo_berikutnya: string | null;
  nominal_berikutnya: number | null;
  jatuh_tempo_terakhir: string | null;
  bayar_terakhir: string | null;
};

export type Tagihan = {
  id: string;
  debt_id: string;
  jatuh_tempo: string; // 'YYYY-MM-DD'
  nominal: number;
  status: 'belum' | 'lunas';
  transaction_id: string | null;
};

export type Tx = {
  id: string;
  tanggal: string; // 'YYYY-MM-DD'
  jenis: Jenis;
  kategori: string | null;
  nominal: number;
  wallet_id: string | null;
  wallet_tujuan_id: string | null;
  debt_id: string | null;
  porsi_bunga: number | null;
  porsi_pokok: number | null;
  catatan: string | null;
  transkrip: string | null;
  sumber: Sumber;
};
