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
