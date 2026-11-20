import { NAMA_BULAN } from './tanggal';

const MS_HARI = 86_400_000;
const utc = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** 'Hari ini' / 'Kemarin' / '3 Nov' (tanpa tahun). Argumen 'YYYY-MM-DD'. */
export function labelTanggalRelatif(tanggal: string, hariIni: string): string {
  if (tanggal === hariIni) return 'Hari ini';
  if (utc(hariIni) - utc(tanggal) === MS_HARI) return 'Kemarin';
  const [, m, d] = tanggal.split('-').map(Number);
  return `${d} ${NAMA_BULAN[m - 1]}`;
}
