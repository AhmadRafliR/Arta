// Handler Edge Function `report-verify` (publik, tautan dari email). GET hanya menampilkan
// halaman dengan tombol (pemindai tautan email tidak mengubah apa pun); POST yang bertindak.
// Hanya API web standar; dependensi disuntikkan. Penyambung Deno ada di ../../report-verify/index.ts.
import { esc } from './html.ts';
import { bacaToken, type Tandatangan, type Tujuan } from './token.ts';

export type DepsVerifikasi = {
  ambilEmail(recipientId: string): Promise<string | null>;
  tandaiTerverifikasi(recipientId: string): Promise<void>;
  hapus(recipientId: string): Promise<void>;
  tandatangan: Tandatangan;
  sekarang(): Date;
  /** Hanya menerima kode status; bawaan console.log. */
  log?: (baris: string) => void;
  /**
   * Alamat halaman statis (mis. GitHub Pages) tempat konfirmasi ditampilkan. Edge Function di domain
   * bawaan supabase.co dipaksa `text/plain` + sandbox, jadi HTML dari sini tidak tampil di browser.
   * Bila diisi, GET/POST mengalihkan (303) ke halaman itu; bila kosong, memakai halaman HTML bawaan.
   */
  halamanUrl?: string;
  /** Alamat publik function ini; diteruskan ke halaman statis sebagai target form konfirmasi. */
  fungsiUrl?: string;
};

export const PESAN_VERIFIKASI = {
  tidakValid: 'Tautan tidak valid atau sudah kedaluwarsa.',
  terverifikasi: 'Terima kasih, email kamu sudah terkonfirmasi.',
  berhenti: 'Kamu tidak akan menerima laporan ini lagi.',
  server: 'Terjadi kesalahan, coba lagi.',
} as const;

const JUDUL: Record<Tujuan, { judul: string; teks: string; tombol: string }> = {
  verif: {
    judul: 'Konfirmasi penerima laporan',
    teks: 'Tekan tombol di bawah untuk mulai menerima laporan keuangan bulanan dari arta di email ini.',
    tombol: 'Ya, konfirmasi',
  },
  henti: {
    judul: 'Berhenti menerima laporan',
    teks: 'Tekan tombol di bawah untuk berhenti menerima laporan keuangan dari arta di email ini.',
    tombol: 'Ya, berhenti menerima',
  },
};

function halaman(status: number, judul: string, isi: string): Response {
  const html =
    `<!doctype html><html lang="id"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex">` +
    `<title>${esc(judul)} · arta</title></head>` +
    `<body style="margin:0;padding:24px 16px;background:#EEF3F5;font-family:Arial,Helvetica,sans-serif;color:#0B424F;">` +
    `<main style="max-width:480px;margin:40px auto;background:#FFFFFF;border-radius:12px;padding:24px;">` +
    `<div style="font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#52C3BF;padding-bottom:8px;">arta</div>` +
    `<h1 style="font-size:20px;margin:0 0 12px 0;">${esc(judul)}</h1>` +
    isi +
    `</main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
    },
  });
}

const teks = (status: number, isi: string) =>
  new Response(isi, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

function alihkan(basis: string, berkas: string, param: Record<string, string>): Response {
  const u = new URL(`${basis.replace(/\/+$/, '')}/${berkas}`);
  for (const [k, v] of Object.entries(param)) u.searchParams.set(k, v);
  return new Response(null, {
    status: 303,
    headers: { Location: u.toString(), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}

const paragraf = (s: string) => `<p style="font-size:15px;line-height:22px;margin:0;">${esc(s)}</p>`;

const halamanTidakValid = () => halaman(400, 'Tautan tidak berlaku', paragraf(PESAN_VERIFIKASI.tidakValid));

export function buatHandlerVerifikasi(deps: DepsVerifikasi): (req: Request) => Promise<Response> {
  const log = deps.log ?? ((b: string) => console.log(b));

  const hasilHalaman = (status: 'invalid' | 'verif' | 'henti' | 'galat', cadangan: () => Response) =>
    deps.halamanUrl ? alihkan(deps.halamanUrl, 'hasil.html', { s: status }) : cadangan();

  const baca = (t: string) =>
    bacaToken(t, deps.ambilEmail, deps.tandatangan, Math.floor(deps.sekarang().getTime() / 1000));

  return async (req) => {
    try {
      const url = new URL(req.url);

      if (req.method === 'GET') {
        const t = url.searchParams.get('t') ?? '';
        const hasil = t ? await baca(t) : null;
        if (!hasil || !hasil.ok) {
          log('report-verify: GET 400');
          return hasilHalaman('invalid', halamanTidakValid);
        }
        const j = JUDUL[hasil.tujuan];
        log(`report-verify: GET 200 ${hasil.tujuan}`);
        if (deps.halamanUrl) {
          return alihkan(deps.halamanUrl, 'konfirmasi.html', {
            t,
            a: hasil.tujuan,
            ...(deps.fungsiUrl ? { f: deps.fungsiUrl } : {}),
          });
        }
        return halaman(
          200,
          j.judul,
          paragraf(j.teks) +
            `<form method="post" style="margin:20px 0 0 0;">` +
            `<input type="hidden" name="t" value="${esc(t)}">` +
            `<button type="submit" style="background:#52C3BF;color:#0B424F;border:0;border-radius:8px;padding:12px 20px;font-size:15px;font-weight:bold;cursor:pointer;">${esc(j.tombol)}</button>` +
            `</form>`,
        );
      }

      if (req.method === 'POST') {
        // Field `t` dari form; bila tidak ada (mis. List-Unsubscribe-Post one-click), dari query.
        let t = '';
        try {
          t = new URLSearchParams(await req.text()).get('t') ?? '';
        } catch {
          t = '';
        }
        // Token dari query = one-click unsubscribe (RFC 8058): balas teks biasa, jangan dialihkan.
        const satuKlik = !t;
        if (!t) t = url.searchParams.get('t') ?? '';
        const hasil = t ? await baca(t) : null;
        if (!hasil || !hasil.ok) {
          log('report-verify: POST 400');
          if (deps.halamanUrl && satuKlik) return teks(400, PESAN_VERIFIKASI.tidakValid);
          return hasilHalaman('invalid', halamanTidakValid);
        }
        if (hasil.tujuan === 'verif') {
          await deps.tandaiTerverifikasi(hasil.recipientId);
          log('report-verify: POST 200 verif');
          return hasilHalaman('verif', () =>
            halaman(200, 'Email terkonfirmasi', paragraf(PESAN_VERIFIKASI.terverifikasi)),
          );
        }
        await deps.hapus(hasil.recipientId);
        log('report-verify: POST 200 henti');
        if (deps.halamanUrl && satuKlik) return teks(200, PESAN_VERIFIKASI.berhenti);
        return hasilHalaman('henti', () => halaman(200, 'Berhenti berlangganan', paragraf(PESAN_VERIFIKASI.berhenti)));
      }

      return halaman(405, 'Tidak didukung', paragraf(PESAN_VERIFIKASI.tidakValid));
    } catch {
      log(`report-verify: ${req.method} 500`);
      return hasilHalaman('galat', () => halaman(500, 'Terjadi kesalahan', paragraf(PESAN_VERIFIKASI.server)));
    }
  };
}
