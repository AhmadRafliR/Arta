import type { NotifikasiMentah } from './tipe';

export type SumberDompet = 'gopay' | 'shopeepay';

export type HasilNotif = {
  kunci: string;
  sumber: SumberDompet;
  jenis: 'pemasukan' | 'pengeluaran';
  nominal: number; // rupiah bulat > 0
  keterangan: string; // merchant/lawan transaksi bila terbaca, '' bila tidak
  waktu: number;
};

const PAKET_SUMBER: Record<string, SumberDompet> = {
  'com.gojek.app': 'gopay',
  'com.gojek.gopay': 'gopay',
  'com.shopee.id': 'shopeepay',
};

const MAKS_KETERANGAN = 60;

// Penanda notifikasi yang bukan transaksi selesai (promo, OTP, gagal, pengingat).
const TOLAK = new RegExp(
  [
    String.raw`\b(?:promo|diskon|voucher|kupon|klaim|gratis|flash\s*sale|potongan)\b`,
    String.raw`\bcashback\s+(?:hingga|s\.?d\.?|up\s*to|sampai)\b`,
    String.raw`(?:^|\s)s\.d\.?(?=\s|$)`,
    String.raw`\bhingga\b`,
    String.raw`\b(?:otp|kode\s+verifikasi|kode\s+rahasia|kode\s+keamanan|pin)\b`,
    String.raw`\b(?:gagal|dibatalkan|dibatalin|batal|tertunda|ditolak|kedaluwarsa|expired)\b`,
    String.raw`\b(?:menunggu|belum\s+dibayar|belum\s+lunas|jatuh\s+tempo|selesaikan|segera\s+bayar|segera|pengingat|jangan\s+lupa|batas\s+waktu)\b`,
  ].join('|'),
  'i',
);

// Notifikasi pengiriman/pesanan Shopee yang bukan transaksi ShopeePay.
const SHOPEE_BUKAN_DOMPET =
  /pesanan.*(?:dikirim|diproses|dalam\s+perjalanan|tiba|sampai|dikemas)|\bresi\b|\bkurir\b/i;

function rapikan(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Ambil nominal transaksi pertama (Rp/IDR + angka berpemisah titik) dari teks.
 * Nominal yang didahului kata "saldo"/"sisa" dianggap saldo, bukan transaksi.
 * Mengembalikan rupiah bulat > 0, atau null.
 */
export function parseNominal(teks: string): number | null {
  const t = rapikan(teks);
  const re = /\b(?:rp|idr)\.?\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?(?![\d.]*\d)/gi;
  let akhirSebelumnya = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const sebelum = t.slice(Math.max(akhirSebelumnya, m.index - 30), m.index);
    akhirSebelumnya = m.index + m[0].length;
    // "saldo kamu Rp..." = saldo; tapi "top up ke saldo ShopeePay Rp..." = transaksi.
    if (/(?<!\bke\s)\b(?:saldo|sisa)(?:\s+\w+){0,3}\s*:?\s*$/i.test(sebelum)) continue;
    const nilai = parseInt(m[1].replace(/\./g, ''), 10);
    if (Number.isFinite(nilai) && nilai > 0) return nilai;
    return null; // nominal pertama nol: jangan loncat ke angka lain
  }
  return null;
}

function tentukanJenis(t: string): 'pemasukan' | 'pengeluaran' | null {
  const keluarTegas =
    /\b(?:transfer|kirim|dikirim|mengirim|pengiriman\s+uang)\s+(?:uang\s+)?ke\b/i.test(t);
  const topUpLain = /top\s?up\s+(?:\w+\s+){0,2}?ke\s+(?!saldo\b|gopay\b|shopeepay\b|akun\b)\S/i.test(t);
  const topUp = /top\s?up/i.test(t);

  const masukTegas =
    /\b(?:refund|pengembalian\s+dana|menerima|diterima|terima\s+(?:uang|dana|transfer))\b/i.test(t) ||
    /\b(?:uang|dana|saldo|cashback|transfer|kiriman)\s+(?:sudah\s+|telah\s+)?masuk\b/i.test(t) ||
    /\b(?:sudah|telah)\s+masuk\b|\bmasuk\s+ke\s+(?:saldo|gopay|shopeepay)\b/i.test(t);

  if (topUp) {
    if (topUpLain || keluarTegas) return 'pengeluaran';
    if (/\bberhasil\b/i.test(t)) return 'pemasukan';
    return null;
  }
  if (masukTegas) return keluarTegas ? null : 'pemasukan';
  if (keluarTegas) return 'pengeluaran';
  if (/\b(?:pembayaran|bayar|dibayar|membayar|pembelian)\b/i.test(t)) return 'pengeluaran';
  return null;
}

const AKHIR_KETERANGAN =
  String.raw`(?=\s+(?:rp|idr)(?=\s*\d)|\s+(?:berhasil|sebesar|senilai|pada|dengan|menggunakan|via|lewat|saldo|telah|sudah|karena|tanggal|jam|pukul)\b|\.(?:\s|$)|,\s|[!;:()]|$)`;

function ambilKeterangan(t: string, jenis: 'pemasukan' | 'pengeluaran'): string {
  const kata = jenis === 'pemasukan' ? 'dari' : 'di|ke|kepada';
  const re = new RegExp(String.raw`\b(?:${kata})\s+(.+?)${AKHIR_KETERANGAN}`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const kandidat = m[1].trim().replace(/[\s.,;:!-]+$/, '');
    if (!kandidat) continue;
    if (/^(?:saldo|gopay|shopeepay|akun|rekening\s+kamu|kamu|anda|rp|idr|\d)/i.test(kandidat)) continue;
    return kandidat.length > MAKS_KETERANGAN
      ? kandidat.slice(0, MAKS_KETERANGAN).trim()
      : kandidat;
  }
  return '';
}

export function parseNotifikasi(n: NotifikasiMentah): HasilNotif | null {
  const sumber = PAKET_SUMBER[n.paket];
  if (!sumber) return null;

  const t = rapikan(`${n.judul ?? ''} ${n.teks ?? ''}`);
  if (!t) return null;

  if (sumber === 'shopeepay') {
    if (!/shopee\s?pay/i.test(t)) return null;
    if (SHOPEE_BUKAN_DOMPET.test(t)) return null;
  }
  if (TOLAK.test(t)) return null;

  const nominal = parseNominal(t);
  if (nominal === null) return null;

  const jenis = tentukanJenis(t);
  if (jenis === null) return null;

  return {
    kunci: n.kunci,
    sumber,
    jenis,
    nominal,
    keterangan: ambilKeterangan(t, jenis),
    waktu: n.waktu,
  };
}
