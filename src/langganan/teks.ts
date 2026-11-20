import type { StatusLangganan } from '@/data/langganan';

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
