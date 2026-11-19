export const ZONA_BAWAAN = 'Asia/Jakarta';

const p2 = (n: number) => String(n).padStart(2, '0');

function bagian(zona: string, now: Date): Record<string, string> | null {
  try {
    // formatToParts dengan 'en-US' tidak bergantung pada format lokal 'en-CA'.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const o: Record<string, string> = {};
    for (const x of parts) o[x.type] = x.value;
    return o.year && o.month && o.day ? o : null;
  } catch {
    return null; // Intl/zona tidak tersedia
  }
}

/** Tanggal hari ini 'YYYY-MM-DD' di zona waktu; jatuh ke tanggal lokal bila Intl gagal. */
export function hariIni(zona: string = ZONA_BAWAAN, now: Date = new Date()): string {
  const o = bagian(zona, now);
  if (o) return `${o.year}-${o.month}-${o.day}`;
  return `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`;
}

/** Jam (0-23) di zona waktu; jatuh ke jam lokal bila Intl gagal. */
export function jamDi(zona: string = ZONA_BAWAAN, now: Date = new Date()): number {
  const o = bagian(zona, now);
  const h = o?.hour ? Number(o.hour) : NaN;
  return Number.isFinite(h) ? h % 24 : now.getHours();
}

/** 'YYYY-MM-DD' yang benar-benar ada di kalender. */
export function tanggalValid(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const hari = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return d <= hari;
}
