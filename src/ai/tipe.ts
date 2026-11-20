// Cermin bentuk tipe dari supabase/functions/_shared/parsing.ts (app tidak mengimpor dari sana).

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

export type KuotaAi = { bulan: string; terpakai: number; batas: number; pro: boolean };

export type HasilAi = HasilParse & { transkrip: string; kuota: KuotaAi };
