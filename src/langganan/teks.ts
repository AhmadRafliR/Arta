import type { StatusLangganan } from '@/data/langganan';
import type { JenisPaket, Paket } from './tipe';

const SATUAN: Record<JenisPaket, string> = { bulanan: 'bulan', tahunan: 'tahun', lain: 'periode' };

/** "bulan" / "tahun" untuk teks harga per periode. */
export function satuanPeriode(jenis: JenisPaket): string {
  return SATUAN[jenis];
}

/**
 * Ketentuan yang wajib terlihat sebelum membeli (kebijakan langganan Google Play): harga, periode tagihan,
 * lama uji coba dan kapan tagihan pertama, perpanjangan otomatis, serta cara agar tidak ditagih.
 */
export function teksKetentuan(p: Paket): string {
  const satuan = SATUAN[p.jenis];
  if (p.ujiCobaHari) {
    return (
      `Gratis ${p.ujiCobaHari} hari, lalu ${p.harga} per ${satuan}. Tagihan pertama otomatis saat uji coba ` +
      `berakhir, lalu diperpanjang otomatis tiap ${satuan} sampai kamu membatalkannya. Batalkan sebelum uji coba ` +
      'berakhir agar tidak ditagih.'
    );
  }
  return (
    `${p.harga} per ${satuan}, ditagih lewat Google Play saat kamu mengonfirmasi, lalu diperpanjang otomatis ` +
    `tiap ${satuan} sampai kamu membatalkannya.`
  );
}

export const TEKS_CARA_BATAL = 'Batalkan kapan saja di Google Play: Profil > Pembayaran & langganan > Langganan.';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "4 Des 2026" dari timestamp ISO (tanggal di Asia/Jakarta). */
export function tanggalSingkat(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3_600_000);
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function teksStatusLangganan(s: StatusLangganan | undefined): string {
  if (!s || !s.pro) return 'Free: catat AI 30× per bulan';
  if (s.periode === 'trial' && s.berlakuSampai) return `Uji coba Pro sampai ${tanggalSingkat(s.berlakuSampai)}`;
  if (s.akanDiperpanjang === false && s.berlakuSampai) return `Pro aktif sampai ${tanggalSingkat(s.berlakuSampai)}`;
  return 'Pro aktif';
}
