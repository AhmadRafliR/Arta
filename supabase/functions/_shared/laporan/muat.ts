// Pemuat data laporan + helper bersama untuk ketiga index.ts (report-send, report-verify,
// report-monthly). Tanpa API Deno/Node: klien Supabase disuntikkan lewat tipe struktural SbLike,
// WebCrypto lewat parameter `subtle`. Dites di Jest.
import type { DataLaporan, TipeDompet } from './isi.ts';

export type GalatSb = { code?: string; message?: string } | null;
export type HasilSb = { data: unknown; error: GalatSb; status?: number; count?: number | null };

/** Bagian kecil query builder supabase-js yang dipakai di sini. */
export interface KueriSb extends PromiseLike<HasilSb> {
  select(kolom: string): KueriSb;
  eq(kolom: string, nilai: unknown): KueriSb;
  in(kolom: string, nilai: readonly unknown[]): KueriSb;
  order(kolom: string, opsi?: { ascending?: boolean }): KueriSb;
  range(dari: number, sampai: number): KueriSb;
  single(): PromiseLike<HasilSb>;
  maybeSingle(): PromiseLike<HasilSb>;
}

export type SbLike = {
  from(tabel: string): {
    select(kolom: string): KueriSb;
    insert(baris: Record<string, unknown>): KueriSb;
    update(baris: Record<string, unknown>): KueriSb;
  };
};

/** Galat basis data. Pesan Postgres dibawa (mis. "Batas kirim laporan …") tetapi tidak pernah dicatat. */
export class GalatDb extends Error {
  kode: string;
  constructor(kode: string | undefined, pesan: string | undefined, tabel: string) {
    super(pesan || `db ${tabel}`);
    this.name = 'GalatDb';
    this.kode = kode ?? '';
  }
}

function periksa(h: HasilSb, tabel: string): void {
  if (h.error) throw new GalatDb(h.error.code, h.error.message, tabel);
}

export const UKURAN_HALAMAN = 1000;
const ZONA_BAWAAN = 'Asia/Jakarta';

type Baris = Record<string, unknown>;

const angka = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const angkaAtauNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const teksAtauNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** Ambil semua baris berhalaman `UKURAN_HALAMAN` (batas max_rows PostgREST) sampai habis. */
async function semuaHalaman(buat: () => KueriSb, tabel: string): Promise<Baris[]> {
  const hasil: Baris[] = [];
  for (let dari = 0; ; dari += UKURAN_HALAMAN) {
    const h = await buat().range(dari, dari + UKURAN_HALAMAN - 1);
    periksa(h, tabel);
    const baris = (h.data as Baris[] | null) ?? [];
    hasil.push(...baris);
    if (baris.length < UKURAN_HALAMAN) return hasil;
  }
}

export async function muatProfil(sb: SbLike, userId: string): Promise<{ nama: string | null; zona: string }> {
  const h = await sb.from('profiles').select('nama, zona_waktu').eq('id', userId).maybeSingle();
  periksa(h, 'profiles');
  const p = (h.data as Baris | null) ?? {};
  const nama = teksAtauNull(p.nama);
  return {
    nama: nama && nama.trim() ? nama.trim() : null,
    zona: teksAtauNull(p.zona_waktu) || ZONA_BAWAAN,
  };
}

async function muatHutang(sb: SbLike, userId: string): Promise<DataLaporan['hutang']> {
  // View v_hutang milik Rencana 3; bila belum ada (atau galat apa pun) bagian hutang dilewati.
  try {
    const h = await sb
      .from('v_hutang')
      .select('pemberi, sisa_pokok, jatuh_tempo_berikutnya, nominal_berikutnya, diarsip')
      .eq('user_id', userId);
    if (h.error) return null;
    return ((h.data as Baris[] | null) ?? []).map((r) => ({
      pemberi: teksAtauNull(r.pemberi) ?? '',
      sisa_pokok: angka(r.sisa_pokok),
      jatuh_tempo_berikutnya: teksAtauNull(r.jatuh_tempo_berikutnya),
      nominal_berikutnya: angkaAtauNull(r.nominal_berikutnya),
      diarsip: r.diarsip === true,
    }));
  } catch {
    return null;
  }
}

/**
 * Semua data untuk buatIsiLaporan. Selalu menyaring `user_id` (juga untuk klien token pengguna,
 * yang sudah dibatasi RLS) agar aman dipakai dengan service role.
 */
export async function muatDataLaporan(sb: SbLike, userId: string): Promise<DataLaporan> {
  const [profil, dompet, txs, budget, hutang] = await Promise.all([
    muatProfil(sb, userId),
    (async () => {
      const h = await sb
        .from('wallets')
        .select('id, nama, tipe, saldo_awal, target, diarsip')
        .eq('user_id', userId);
      periksa(h, 'wallets');
      return (h.data as Baris[] | null) ?? [];
    })(),
    semuaHalaman(
      () =>
        sb
          .from('transactions')
          .select('id, tanggal, jenis, kategori, nominal, wallet_id, wallet_tujuan_id, catatan')
          .eq('user_id', userId)
          .order('tanggal', { ascending: true })
          .order('id', { ascending: true }),
      'transactions',
    ),
    (async () => {
      const h = await sb.from('budgets').select('kategori, batas_bulanan').eq('user_id', userId);
      periksa(h, 'budgets');
      return (h.data as Baris[] | null) ?? [];
    })(),
    muatHutang(sb, userId),
  ]);

  return {
    nama: profil.nama,
    zona: profil.zona,
    wallets: dompet.map((w) => ({
      id: String(w.id),
      nama: teksAtauNull(w.nama) ?? '',
      tipe: (w.tipe === 'darurat' || w.tipe === 'investasi' ? w.tipe : 'harian') as TipeDompet,
      saldo_awal: angka(w.saldo_awal),
      target: angkaAtauNull(w.target),
      diarsip: w.diarsip === true,
    })),
    txs: txs.map((t) => ({
      id: String(t.id),
      tanggal: String(t.tanggal),
      jenis: String(t.jenis),
      kategori: teksAtauNull(t.kategori),
      nominal: angka(t.nominal),
      wallet_id: teksAtauNull(t.wallet_id),
      wallet_tujuan_id: teksAtauNull(t.wallet_tujuan_id),
      catatan: teksAtauNull(t.catatan),
    })),
    budgets: budget.map((b) => ({
      kategori: teksAtauNull(b.kategori) ?? '',
      batas_bulanan: angka(b.batas_bulanan),
    })),
    hutang,
  };
}

export type Penerima = { id: string; email: string; terverifikasi: boolean };

export async function muatPenerima(sb: SbLike, userId: string): Promise<Penerima[]> {
  const h = await sb
    .from('report_recipients')
    .select('id, email, terverifikasi')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  periksa(h, 'report_recipients');
  return ((h.data as Baris[] | null) ?? []).map((r) => ({
    id: String(r.id),
    email: String(r.email),
    terverifikasi: r.terverifikasi === true,
  }));
}

const proBerlaku = (r: Baris, sekarang: Date): boolean => {
  if (r.pro_aktif !== true) return false;
  const s = teksAtauNull(r.berlaku_sampai);
  if (!s) return true;
  const t = Date.parse(s);
  return Number.isFinite(t) && t > sekarang.getTime();
};

/** Pro aktif dan (berlaku_sampai null atau di masa depan). */
export async function muatPro(sb: SbLike, userId: string, sekarang: Date): Promise<boolean> {
  const h = await sb
    .from('entitlements')
    .select('pro_aktif, berlaku_sampai')
    .eq('user_id', userId)
    .maybeSingle();
  periksa(h, 'entitlements');
  return h.data ? proBerlaku(h.data as Baris, sekarang) : false;
}

/** Akses sementara dari iklan reward untuk satu fitur (tabel akses_iklan, RLS milik sendiri). */
export async function muatAksesIklan(
  sb: SbLike,
  userId: string,
  fitur: 'ekspor' | 'laporan',
  sekarang: Date,
): Promise<boolean> {
  const h = await sb
    .from('akses_iklan')
    .select('berlaku_sampai')
    .eq('user_id', userId)
    .eq('fitur', fitur)
    .maybeSingle();
  periksa(h, 'akses_iklan');
  const s = h.data ? teksAtauNull((h.data as Baris).berlaku_sampai) : null;
  const t = s ? Date.parse(s) : NaN;
  return Number.isFinite(t) && t > sekarang.getTime();
}

const POTONGAN_IN = 100;

/** Kandidat laporan bulanan (service role): Pro aktif + ≥1 penerima terverifikasi, dengan zona profil. */
export async function muatKandidat(sb: SbLike, sekarang: Date): Promise<{ userId: string; zona: string }[]> {
  const ent = await semuaHalaman(
    () =>
      sb
        .from('entitlements')
        .select('user_id, pro_aktif, berlaku_sampai')
        .eq('pro_aktif', true)
        .order('user_id', { ascending: true }),
    'entitlements',
  );
  const pro = new Set(ent.filter((r) => proBerlaku(r, sekarang)).map((r) => String(r.user_id)));
  if (pro.size === 0) return [];

  const pen = await semuaHalaman(
    () =>
      sb
        .from('report_recipients')
        .select('user_id')
        .eq('terverifikasi', true)
        .order('id', { ascending: true }),
    'report_recipients',
  );
  const ids = [...new Set(pen.map((r) => String(r.user_id)))].filter((id) => pro.has(id)).sort();

  const zona = new Map<string, string>();
  for (let i = 0; i < ids.length; i += POTONGAN_IN) {
    const h = await sb.from('profiles').select('id, zona_waktu').in('id', ids.slice(i, i + POTONGAN_IN));
    periksa(h, 'profiles');
    for (const p of (h.data as Baris[] | null) ?? []) {
      const z = teksAtauNull(p.zona_waktu);
      if (z) zona.set(String(p.id), z);
    }
  }
  return ids.map((userId) => ({ userId, zona: zona.get(userId) ?? ZONA_BAWAAN }));
}

/** Klaim laporan bulanan (service role). null bila bulan itu sudah diklaim (indeks unik, 23505). */
export async function klaimBulanan(sb: SbLike, userId: string, bulan: string): Promise<string | null> {
  const h = await sb
    .from('report_log')
    .insert({ user_id: userId, bulan, jenis: 'bulanan' })
    .select('id')
    .single();
  if (h.error?.code === '23505') return null;
  periksa(h, 'report_log');
  return String((h.data as Baris).id);
}

/** Tandai hasil laporan bulanan (service role). */
export async function selesaiBulanan(
  sb: SbLike,
  id: string,
  status: 'terkirim' | 'gagal',
  jumlah: number,
): Promise<void> {
  const h = await sb.from('report_log').update({ status, jumlah_penerima: jumlah }).eq('id', id);
  periksa(h, 'report_log');
}

// ---------------------------------------------------------------- HMAC (WebCrypto)

type SubtleLike = {
  importKey(
    format: 'raw',
    keyData: Uint8Array<ArrayBuffer>,
    algorithm: { name: 'HMAC'; hash: 'SHA-256' },
    extractable: boolean,
    keyUsages: ['sign'],
  ): Promise<unknown>;
  sign(algorithm: 'HMAC', key: never, data: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer>;
};

export function base64url(bytes: Uint8Array): string {
  let biner = '';
  for (let i = 0; i < bytes.length; i++) biner += String.fromCharCode(bytes[i]);
  return btoa(biner).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Tanda tangan HMAC-SHA256 (base64url tanpa padding). Rahasia kosong → galat konfigurasi saat
 * dipakai (bukan saat fungsi dimuat), sehingga handler bisa membalas 500 yang rapi.
 */
export function buatTandatanganHmac(rahasia: string, subtle: SubtleLike): (pesan: string) => Promise<string> {
  let kunci: Promise<unknown> | null = null;
  const enc = new TextEncoder();
  return async (pesan) => {
    if (!rahasia) throw new Error('LAPORAN_SECRET belum diset');
    kunci ??= subtle.importKey('raw', enc.encode(rahasia), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await subtle.sign('HMAC', (await kunci) as never, enc.encode(pesan));
    return base64url(new Uint8Array(sig));
  };
}
