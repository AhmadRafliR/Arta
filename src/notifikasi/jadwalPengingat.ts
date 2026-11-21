// Penyusun jadwal pengingat jatuh tempo (notifikasi lokal). Fungsi murni: tanpa native/jaringan.
// Teks meniru supabase/functions/_shared/pengingat.ts (susunPesan).

const ZONA_BAWAAN = 'Asia/Jakarta';
export const MAKS_BAWAAN = 40; // iOS membatasi 64 notifikasi terjadwal
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export type TagihanPengingat = {
  id: string;
  debtId: string;
  pemberi: string;
  jatuhTempo: string; // YYYY-MM-DD
  nominal: number;
};

export type ItemJadwal = { id: string; waktu: Date; judul: string; isi: string };

export type MasukanJadwal = {
  tagihan: TagihanPengingat[];
  hariSebelum: 0 | 1 | 3;
  jam: number;
  zona: string | null;
  sekarang: Date;
  maks?: number;
};

const rupiah = (n: number) => `Rp${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const p2 = (n: number) => String(n).padStart(2, '0');

function zonaValid(zona: string | null | undefined): string {
  if (!zona) return ZONA_BAWAAN;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zona });
    return zona;
  } catch {
    return ZONA_BAWAAN;
  }
}

/** Selisih (ms) waktu dinding zona terhadap UTC pada instan tertentu. */
function offsetZona(zona: string, instan: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instan));
  const o: Record<string, number> = {};
  for (const x of parts) if (x.type !== 'literal') o[x.type] = Number(x.value);
  const dinding = Date.UTC(o.year, o.month - 1, o.day, o.hour % 24, o.minute, o.second);
  return dinding - Math.floor(instan / 1000) * 1000;
}

/** Instan UTC untuk tanggal 'YYYY-MM-DD' pukul `jam`:00 waktu dinding di zona. */
export function waktuDiZona(tanggal: string, jam: number, zona: string): Date {
  const [y, m, d] = tanggal.split('-').map(Number);
  const tebakan = Date.UTC(y, m - 1, d, jam, 0, 0);
  let hasil = tebakan - offsetZona(zona, tebakan);
  hasil = tebakan - offsetZona(zona, hasil); // koreksi di sekitar perpindahan DST
  return new Date(hasil);
}

function geserHari(tanggal: string, n: number): string {
  const [y, m, d] = tanggal.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function selisihHari(dari: string, ke: string): number {
  const [y1, m1, d1] = dari.split('-').map(Number);
  const [y2, m2, d2] = ke.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function kapan(jatuhTempo: string, hariKirim: string): string {
  const n = selisihHari(hariKirim, jatuhTempo);
  if (n === 0) return 'hari ini';
  if (n === 1) return 'besok';
  return `${n} hari lagi`;
}

function tanggalPanjang(tanggal: string): string {
  const [y, m, d] = tanggal.split('-').map(Number);
  return `${HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} ${BULAN[m - 1]}`;
}

function susunTeks(daftar: TagihanPengingat[], hariKirim: string): { judul: string; isi: string } {
  if (daftar.length === 1) {
    const t = daftar[0];
    return {
      judul: `Tagihan ${t.pemberi} ${kapan(t.jatuhTempo, hariKirim)}`,
      isi: `${rupiah(t.nominal)} jatuh tempo ${tanggalPanjang(t.jatuhTempo)}.`,
    };
  }
  const terdekat = daftar.reduce((a, b) => (b.jatuhTempo < a.jatuhTempo ? b : a));
  const total = daftar.reduce((s, t) => s + t.nominal, 0);
  return {
    judul: `${daftar.length} tagihan jatuh tempo`,
    isi: `Total ${rupiah(total)}. Terdekat: ${terdekat.pemberi} ${kapan(terdekat.jatuhTempo, hariKirim)}.`,
  };
}

/** Label "Senin, 24 Nov 08.00" untuk waktu di zona (info di layar pengaturan). */
export function labelWaktu(waktu: Date, zona: string | null): string {
  const z = zonaValid(zona);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: z,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(waktu);
  const o: Record<string, string> = {};
  for (const x of parts) o[x.type] = x.value;
  return `${tanggalPanjang(`${o.year}-${o.month}-${o.day}`)} ${p2(Number(o.hour) % 24)}.${o.minute}`;
}

export function susunJadwalPengingat(m: MasukanJadwal): ItemJadwal[] {
  const zona = zonaValid(m.zona);
  const maks = m.maks ?? MAKS_BAWAAN;
  const jam = Math.min(23, Math.max(0, Math.trunc(m.jam)));
  const sekarang = m.sekarang.getTime();

  // kunci: tanggal kirim (YYYY-MM-DD, tanggal dinding di zona)
  const kelompok = new Map<string, TagihanPengingat[]>();
  const tambah = (hariKirim: string, t: TagihanPengingat) => {
    const arr = kelompok.get(hariKirim);
    if (arr) arr.push(t);
    else kelompok.set(hariKirim, [t]);
  };
  for (const t of m.tagihan) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.jatuhTempo)) continue;
    tambah(geserHari(t.jatuhTempo, -m.hariSebelum), t);
    if (m.hariSebelum > 0) tambah(t.jatuhTempo, t);
  }

  const hasil: ItemJadwal[] = [];
  for (const [hariKirim, daftar] of kelompok) {
    const waktu = waktuDiZona(hariKirim, jam, zona);
    if (waktu.getTime() <= sekarang) continue;
    const urut = [...daftar].sort((a, b) => a.jatuhTempo.localeCompare(b.jatuhTempo) || a.id.localeCompare(b.id));
    const { judul, isi } = susunTeks(urut, hariKirim);
    hasil.push({ id: `pengingat-hutang:${hariKirim}T${p2(jam)}`, waktu, judul, isi });
  }
  hasil.sort((a, b) => a.waktu.getTime() - b.waktu.getTime());
  return hasil.slice(0, Math.max(0, maks));
}
