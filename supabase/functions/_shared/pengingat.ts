// Handler Edge Function `debt-reminders`: hanya API web standar (tanpa Deno/Node), dependensi disuntikkan
// agar bisa dites di Jest. Penyambung Deno ada di ../debt-reminders/index.ts.
import { CORS } from './handler.ts';

export type Penerima = {
  userId: string;
  tokens: string[];
  hariSebelum: 0 | 1 | 3;
  jam: number;
  zona: string | null;
};

export type Tagihan = {
  tagihanId: string;
  debtId: string;
  pemberi: string;
  jatuhTempo: string; // YYYY-MM-DD
  nominal: number;
};

export type PesanExpo = {
  to: string;
  title: string;
  body: string;
  data: { url: '/hutang' };
  channelId: 'pengingat';
  priority: 'high';
  sound: 'default';
};

export type TiketExpo =
  | { status: 'ok'; id?: string }
  | { status: 'error'; message?: string; details?: { error?: string } };

export type DepsPengingat = {
  rahasia: string;
  penerima(): Promise<Penerima[]>;
  /** null = kontrak RPC `tagihan_untuk_pengingat` (Rencana 3) belum tersedia. */
  tagihan(userId: string, tanggal: string[]): Promise<Tagihan[] | null>;
  sudahDikirim(userId: string, kunci: string[]): Promise<Set<string>>;
  catatDikirim(userId: string, kunci: string[]): Promise<void>;
  kirim(pesan: PesanExpo[]): Promise<TiketExpo[]>;
  hapusToken(tokens: string[]): Promise<void>;
  sekarang(): Date;
};

const ZONA_BAWAAN = 'Asia/Jakarta';
export const MAKS_PER_KIRIM = 100;
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Jam lokal 0-23 di zona tertentu; zona kosong/tidak valid → Asia/Jakarta. */
export function jamLokal(sekarang: Date, zona: string | null | undefined): number {
  const fmt = (timeZone: string) =>
    Number(
      new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(sekarang),
    );
  try {
    return fmt(zona || ZONA_BAWAAN) % 24;
  } catch {
    return fmt(ZONA_BAWAAN) % 24;
  }
}

function tambahHariStr(tanggal: string, n: number): string {
  const [y, m, d] = tanggal.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Tanggal YYYY-MM-DD di zona tertentu, digeser `tambahHari` hari. */
export function tanggalLokal(sekarang: Date, zona: string | null | undefined, tambahHari = 0): string {
  const fmt = (timeZone: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      sekarang,
    );
  let hariIni: string;
  try {
    hariIni = fmt(zona || ZONA_BAWAAN);
  } catch {
    hariIni = fmt(ZONA_BAWAAN);
  }
  return tambahHari === 0 ? hariIni : tambahHariStr(hariIni, tambahHari);
}

/** Tanggal jatuh tempo yang dicari: hari ini + hariSebelum, dan hari ini (unik). */
export function tanggalTarget(p: Penerima, sekarang: Date): string[] {
  const hariIni = tanggalLokal(sekarang, p.zona, 0);
  const target = tanggalLokal(sekarang, p.zona, p.hariSebelum);
  return target === hariIni ? [hariIni] : [target, hariIni];
}

const rupiah = (n: number) => `Rp${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

function selisihHari(dari: string, ke: string): number {
  const [y1, m1, d1] = dari.split('-').map(Number);
  const [y2, m2, d2] = ke.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function kapan(jatuhTempo: string, hariIni: string): string {
  const n = selisihHari(hariIni, jatuhTempo);
  if (n === 0) return 'hari ini';
  if (n === 1) return 'besok';
  return `${n} hari lagi`;
}

function tanggalPanjang(tanggal: string): string {
  const [y, m, d] = tanggal.split('-').map(Number);
  const hari = HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${hari}, ${d} ${BULAN[m - 1]}`;
}

/** Satu pesan per token; beberapa tagihan digabung jadi satu notifikasi. */
export function susunPesan(p: Penerima, tagihan: Tagihan[], hariIni: string): PesanExpo[] {
  if (tagihan.length === 0) return [];
  let title: string;
  let body: string;
  if (tagihan.length === 1) {
    const t = tagihan[0];
    title = `Tagihan ${t.pemberi} ${kapan(t.jatuhTempo, hariIni)}`;
    body = `${rupiah(t.nominal)} jatuh tempo ${tanggalPanjang(t.jatuhTempo)}.`;
  } else {
    const terdekat = tagihan.reduce((a, b) => (b.jatuhTempo < a.jatuhTempo ? b : a));
    const total = tagihan.reduce((s, t) => s + t.nominal, 0);
    title = `${tagihan.length} tagihan jatuh tempo`;
    body = `Total ${rupiah(total)}. Terdekat: ${terdekat.pemberi} ${kapan(terdekat.jatuhTempo, hariIni)}.`;
  }
  return p.tokens.map((to) => ({
    to,
    title,
    body,
    data: { url: '/hutang' as const },
    channelId: 'pengingat' as const,
    priority: 'high' as const,
    sound: 'default' as const,
  }));
}

export const kunciDedup = (t: Tagihan, hariIni: string): string => `${t.tagihanId}:${t.jatuhTempo}:${hariIni}`;

/** Perbandingan waktu-konstan (terhadap isi); panjang berbeda tetap ditolak. */
function samaWaktuKonstan(a: string, b: string): boolean {
  const n = Math.max(a.length, b.length);
  let beda = a.length ^ b.length;
  for (let i = 0; i < n; i++) beda |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return beda === 0;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });

function tokenDari(req: Request): string {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get('authorization') ?? '');
  return m ? m[1] : '';
}

type Antrean = { userId: string; pesan: PesanExpo; kunci: string[] };

// Log hanya jumlah: jangan pernah mencetak token push atau isi pesan.
export function buatHandlerPengingat(deps: DepsPengingat): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS });
    if (req.method !== 'POST') return json(405, { galat: 'metode' });

    const token = tokenDari(req);
    if (!deps.rahasia || !token || !samaWaktuKonstan(token, deps.rahasia)) {
      return json(401, { galat: 'unauthorized' });
    }

    const sekarang = deps.sekarang();
    let semua: Penerima[];
    try {
      semua = await deps.penerima();
    } catch {
      console.error('debt-reminders: gagal ambil penerima');
      return json(500, { galat: 'server' });
    }

    const antrean: Antrean[] = [];
    let diproses = 0;
    let dilewati = 0;

    for (const p of semua) {
      if (jamLokal(sekarang, p.zona) !== p.jam) continue;
      diproses++;
      try {
        const hariIni = tanggalLokal(sekarang, p.zona, 0);
        const daftar = await deps.tagihan(p.userId, tanggalTarget(p, sekarang));
        if (daftar === null) {
          console.error('debt-reminders: tagihan_untuk_pengingat belum tersedia');
          return json(200, {
            diproses,
            dikirim: 0,
            dilewati: 0,
            tokenDihapus: 0,
            catatan: 'tagihan_untuk_pengingat belum tersedia',
          });
        }
        if (daftar.length === 0) continue;
        const sudah = await deps.sudahDikirim(
          p.userId,
          daftar.map((t) => kunciDedup(t, hariIni)),
        );
        const baru = daftar.filter((t) => !sudah.has(kunciDedup(t, hariIni)));
        if (baru.length === 0) {
          dilewati++;
          continue;
        }
        const kunci = baru.map((t) => kunciDedup(t, hariIni));
        for (const pesan of susunPesan(p, baru, hariIni)) antrean.push({ userId: p.userId, pesan, kunci });
      } catch {
        console.error('debt-reminders: gagal memproses satu penerima');
      }
    }

    let dikirim = 0;
    const tokenMati = new Set<string>();
    const berhasil = new Map<string, string[]>(); // userId -> kunci

    for (let i = 0; i < antrean.length; i += MAKS_PER_KIRIM) {
      const potong = antrean.slice(i, i + MAKS_PER_KIRIM);
      let tiket: TiketExpo[];
      try {
        tiket = await deps.kirim(potong.map((a) => a.pesan));
      } catch {
        console.error('debt-reminders: gagal kirim satu potongan');
        continue; // HTTP gagal: jangan catat terkirim
      }
      potong.forEach((a, j) => {
        const t = tiket[j];
        if (!t) return;
        if (t.status === 'ok') {
          dikirim++;
          berhasil.set(a.userId, a.kunci);
        } else if (t.details?.error === 'DeviceNotRegistered') {
          tokenMati.add(a.pesan.to);
        }
      });
    }

    for (const [userId, kunci] of berhasil) {
      try {
        await deps.catatDikirim(userId, kunci);
      } catch {
        console.error('debt-reminders: gagal catat log');
      }
    }

    let tokenDihapus = 0;
    if (tokenMati.size > 0) {
      try {
        await deps.hapusToken([...tokenMati]);
        tokenDihapus = tokenMati.size;
      } catch {
        console.error('debt-reminders: gagal hapus token');
      }
    }

    console.log(`debt-reminders: diproses ${diproses}, dikirim ${dikirim}, dilewati ${dilewati}`);
    return json(200, { diproses, dikirim, dilewati, tokenDihapus });
  };
}
