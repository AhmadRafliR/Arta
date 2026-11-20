export type JenisPaket = 'bulanan' | 'tahunan' | 'lain';

export type Paket = {
  id: string;
  jenis: JenisPaket;
  /** Harga terformat dari toko, mis. "Rp19.000". */
  harga: string;
  hargaPerBulan: string | null;
  ujiCobaHari: number | null;
};

export type HasilBeli = { status: 'sukses' | 'batal' | 'tertunda' | 'galat'; pesan?: string };

export type NamaPenyedia = 'revenuecat' | 'mock' | 'tidak-tersedia';

export interface PenyediaLangganan {
  nama: NamaPenyedia;
  masuk(userId: string): Promise<void>;
  keluar(): Promise<void>;
  paket(): Promise<Paket[]>;
  beli(paketId: string): Promise<HasilBeli>;
  pulihkan(): Promise<HasilBeli>;
  urlKelola(): Promise<string | null>;
}

export const URL_LANGGANAN_PLAY = 'https://play.google.com/store/account/subscriptions';
