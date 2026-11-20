import type { DrafTx } from '@/ai/tipe';
import type { Wallet } from '@/domain/types';
import { hariIni, ZONA_BAWAAN } from '@/lib/tanggal';
import type { HasilNotif, SumberDompet } from './parser';

export const NAMA_SUMBER: Record<SumberDompet, string> = { gopay: 'GoPay', shopeepay: 'ShopeePay' };

const POLA_DOMPET: Record<SumberDompet, RegExp> = {
  gopay: /go\s?pay/i,
  shopeepay: /shopee/i,
};

function fnv1a(teks: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < teks.length; i++) {
    h ^= teks.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Pengacakan akhir (murmur3 fmix) agar bit tinggi ikut berubah.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

const SEED = [0x811c9dc5, 0x9e3779b1, 0x85ebca77, 0xc2b2ae3d];

/**
 * UUID berformat v4 yang deterministik dari kunci notifikasi (hash FNV-1a 4x32 bit, bukan kriptografis).
 * Notifikasi yang sama selalu menghasilkan id yang sama; RPC simpan transaksi idempoten per id,
 * jadi satu notifikasi tidak bisa tercatat dua kali.
 */
export function idDariKunci(kunci: string): string {
  const hex = SEED.map((s, i) => fnv1a(`${i}|${kunci}`, s).toString(16).padStart(8, '0')).join('');
  const varian = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${varian}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Ubah hasil parser menjadi draf untuk layar cek. Dompet dipetakan lewat nama; tanpa kecocokan: Pilih dompet. */
export function jadikanDraf(hasil: HasilNotif[], wallets: Wallet[], zona: string = ZONA_BAWAAN): DrafTx[] {
  const aktif = wallets.filter((w) => !w.diarsip);
  return hasil.map((h) => {
    const dompet = aktif.find((w) => POLA_DOMPET[h.sumber].test(w.nama)) ?? null;
    const peringatan = dompet ? [] : ['Pilih dompet'];
    peringatan.push(`Dari notifikasi ${NAMA_SUMBER[h.sumber]}`);
    return {
      id: idDariKunci(h.kunci),
      tanggal: hariIni(zona, new Date(h.waktu)),
      jenis: h.jenis,
      kategori: 'lainnya', // ada untuk pemasukan dan pengeluaran (seed init.sql)
      nominal: h.nominal,
      wallet_id: dompet ? dompet.id : null,
      wallet_tujuan_id: null,
      catatan: h.keterangan.trim() ? h.keterangan.trim() : null,
      peringatan,
    };
  });
}

/** Teks "transkrip" draf: sumber unik yang muncul, mis. "Dari notifikasi GoPay dan ShopeePay". */
export function transkripSumber(hasil: HasilNotif[]): string {
  const nama = [...new Set(hasil.map((h) => NAMA_SUMBER[h.sumber]))];
  return `Dari notifikasi ${nama.join(' dan ')}`;
}
