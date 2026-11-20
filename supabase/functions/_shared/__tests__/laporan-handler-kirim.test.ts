import { GalatSesi } from '../handler';
import { buatPengirimMemori, type PesanEmail } from '../laporan/email';
import { buatHandlerKirim, SUBJEK_VERIFIKASI, type DbKirim, type PenerimaLaporan } from '../laporan/handlerKirim';
import type { DataLaporan } from '../laporan/isi';
import { bacaToken } from '../laporan/token';

const ttd = async (pesan: string) => {
  let h = 5381;
  for (let i = 0; i < pesan.length; i++) h = ((h * 33) ^ pesan.charCodeAt(i)) >>> 0;
  return `s${h.toString(36)}`;
};

const SEKARANG = new Date('2026-11-20T05:00:00Z');
const URL_VERIFY = 'https://proj.supabase.co/functions/v1/report-verify';

const DATA: DataLaporan = {
  nama: 'Rafli',
  zona: 'Asia/Jakarta',
  wallets: [{ id: 'w1', nama: 'GoPay', tipe: 'harian', saldo_awal: 100000, target: null, diarsip: false }],
  txs: [
    {
      id: 't1',
      tanggal: '2026-11-10',
      jenis: 'pemasukan',
      kategori: 'ortu',
      nominal: 1500000,
      wallet_id: 'w1',
      wallet_tujuan_id: null,
      catatan: null,
    },
  ],
  budgets: [],
  hutang: null,
};

const PENERIMA: PenerimaLaporan[] = [
  { id: 'r1', email: 'ibu@example.com', terverifikasi: true },
  { id: 'r2', email: 'ayah@example.com', terverifikasi: true },
  { id: 'r3', email: 'kakak@example.com', terverifikasi: false },
];

type Opsi = {
  pro?: boolean;
  penerima?: PenerimaLaporan[];
  sesi?: boolean;
  mulai?: () => Promise<string>;
  tandai?: () => Promise<boolean>;
  gagalKe?: string[];
};

function siapkan(o: Opsi = {}) {
  const db: { [K in keyof DbKirim]: jest.Mock } = {
    userId: jest.fn(async () => {
      if (o.sesi === false) throw new GalatSesi();
      return 'user-a';
    }),
    pro: jest.fn(async () => o.pro ?? true),
    nama: jest.fn(async () => 'Rafli <b>'),
    data: jest.fn(async () => DATA),
    penerima: jest.fn(async () => o.penerima ?? PENERIMA),
    mulaiKirim: jest.fn(o.mulai ?? (async () => 'log-1')),
    selesaiKirim: jest.fn(async () => {}),
    tandaiVerifikasi: jest.fn(o.tandai ?? (async () => true)),
  };
  const memori = buatPengirimMemori();
  const email = {
    terkirim: memori.terkirim,
    kirim: jest.fn(async (p: PesanEmail) => {
      if (o.gagalKe?.includes(p.ke)) throw new Error('resend 500');
      return memori.kirim(p);
    }),
  };
  const log = jest.fn();
  const handler = buatHandlerKirim({
    db: () => db as unknown as DbKirim,
    email,
    tandatangan: ttd,
    urlVerify: URL_VERIFY,
    sekarang: () => SEKARANG,
    log,
  });
  return { handler, db, email, log };
}

function req(body: unknown, opsi: { auth?: string | null; method?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const auth = opsi.auth === undefined ? 'Bearer tok-123' : opsi.auth;
  if (auth !== null) headers.authorization = auth;
  const method = opsi.method ?? 'POST';
  return new Request('http://localhost/report-send', {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

const tautanDari = (p: PesanEmail) => {
  const m = /report-verify\?t=([^"\s<>&]+)/.exec(p.teks);
  return m ? decodeURIComponent(m[1]) : null;
};

describe('report-send', () => {
  it('OPTIONS → 200 dengan CORS', async () => {
    const { handler } = siapkan();
    const res = await handler(req(null, { method: 'OPTIONS' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('GET → 400', async () => {
    const { handler } = siapkan();
    expect((await handler(req(null, { method: 'GET' }))).status).toBe(400);
  });

  it('tanpa token → 401', async () => {
    const { handler, db } = siapkan();
    const res = await handler(req({ aksi: 'kirim' }, { auth: null }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ galat: 'unauthorized', pesan: 'Sesi habis, masuk lagi.' });
    expect(db.userId).not.toHaveBeenCalled();
  });

  it('token ditolak (GalatSesi) → 401', async () => {
    const { handler } = siapkan({ sesi: false });
    expect((await handler(req({ aksi: 'kirim' }))).status).toBe(401);
  });

  it('aksi tidak dikenal → 400', async () => {
    const { handler } = siapkan();
    expect((await handler(req({ aksi: 'hapus' }))).status).toBe(400);
  });

  describe('aksi kirim', () => {
    it('non-Pro → 403 bukan_pro tanpa email', async () => {
      const { handler, email, db } = siapkan({ pro: false });
      const res = await handler(req({ aksi: 'kirim' }));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ galat: 'bukan_pro', pesan: 'Laporan email khusus Pro.' });
      expect(email.kirim).not.toHaveBeenCalled();
      expect(db.mulaiKirim).not.toHaveBeenCalled();
    });

    it('tanpa penerima terverifikasi → 409', async () => {
      const { handler, email, db } = siapkan({ penerima: [PENERIMA[2]] });
      const res = await handler(req({ aksi: 'kirim' }));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ galat: 'tanpa_penerima', pesan: 'Belum ada penerima terverifikasi.' });
      expect(email.kirim).not.toHaveBeenCalled();
      expect(db.mulaiKirim).not.toHaveBeenCalled();
    });

    it('2 terverifikasi + 1 belum → tepat 2 email ke yang terverifikasi', async () => {
      const { handler, email, db } = siapkan();
      const res = await handler(req({ aksi: 'kirim' }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ terkirim: 2, bulan: '2026-11' });
      expect(email.terkirim.map((p) => p.ke)).toEqual(['ibu@example.com', 'ayah@example.com']);
      expect(db.mulaiKirim).toHaveBeenCalledWith('2026-11');
      expect(db.selesaiKirim).toHaveBeenCalledWith('log-1', 'terkirim', 2);
      expect(email.terkirim[0].subjek).toBe('Laporan keuangan November 2026 · Rafli');
      // Bulan berjalan: isi sampai hari ini.
      expect(email.terkirim[0].teks).toContain('2026-11-20');
    });

    it('email memuat tautan report-verify?t= bertujuan henti milik penerima itu + List-Unsubscribe', async () => {
      const { handler, email } = siapkan();
      await handler(req({ aksi: 'kirim' }));
      const pesan = email.terkirim[0];
      expect(pesan.html).toContain(`${URL_VERIFY}?t=`);
      const token = tautanDari(pesan);
      expect(token).not.toBeNull();
      const baca = await bacaToken(
        token!,
        async (id) => PENERIMA.find((p) => p.id === id)?.email ?? null,
        ttd,
        Math.floor(SEKARANG.getTime() / 1000),
      );
      expect(baca).toEqual({ ok: true, tujuan: 'henti', recipientId: 'r1' });
      expect(pesan.header?.['List-Unsubscribe']).toMatch(/^<https:\/\/proj\.supabase\.co\/functions\/v1\/report-verify\?t=.+>$/);
      expect(pesan.header?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    });

    it('bulan lalu diterima dan memakai akhir bulan', async () => {
      const { handler, email, db } = siapkan();
      const res = await handler(req({ aksi: 'kirim', bulan: '2026-10' }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ terkirim: 2, bulan: '2026-10' });
      expect(db.mulaiKirim).toHaveBeenCalledWith('2026-10');
      expect(email.terkirim[0].teks).toContain('2026-10-31');
    });

    it("bulan '2026-09' saat November → 400 tanpa mulaiKirim", async () => {
      const { handler, db, email } = siapkan();
      const res = await handler(req({ aksi: 'kirim', bulan: '2026-09' }));
      expect(res.status).toBe(400);
      expect(db.mulaiKirim).not.toHaveBeenCalled();
      expect(email.kirim).not.toHaveBeenCalled();
    });

    it('bulan format salah → 400', async () => {
      const { handler } = siapkan();
      expect((await handler(req({ aksi: 'kirim', bulan: '2026-13' }))).status).toBe(400);
      expect((await handler(req({ aksi: 'kirim', bulan: 202611 }))).status).toBe(400);
    });

    it('satu email gagal → terkirim 1', async () => {
      const { handler, db } = siapkan({ gagalKe: ['ayah@example.com'] });
      const res = await handler(req({ aksi: 'kirim' }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ terkirim: 1, bulan: '2026-11' });
      expect(db.selesaiKirim).toHaveBeenCalledWith('log-1', 'terkirim', 1);
    });

    it('semua gagal → 502 server + selesaiKirim gagal', async () => {
      const { handler, db } = siapkan({ gagalKe: ['ibu@example.com', 'ayah@example.com'] });
      const res = await handler(req({ aksi: 'kirim' }));
      expect(res.status).toBe(502);
      expect((await res.json()).galat).toBe('server');
      expect(db.selesaiKirim).toHaveBeenCalledWith('log-1', 'gagal', 0);
    });

    it('batas 3 kali per hari → 429 batas tanpa email', async () => {
      const { handler, email, db } = siapkan({
        mulai: async () => {
          throw new Error('Batas kirim laporan 3 kali per hari');
        },
      });
      const res = await handler(req({ aksi: 'kirim' }));
      expect(res.status).toBe(429);
      expect((await res.json()).galat).toBe('batas');
      expect(email.kirim).not.toHaveBeenCalled();
      expect(db.selesaiKirim).not.toHaveBeenCalled();
    });

    it('galat db lain → 500 server', async () => {
      const { handler } = siapkan({
        mulai: async () => {
          throw new Error('db 500');
        },
      });
      const res = await handler(req({ aksi: 'kirim' }));
      expect(res.status).toBe(500);
      expect((await res.json()).galat).toBe('server');
    });

    it('log tidak memuat email maupun isi laporan', async () => {
      const { handler, log } = siapkan({ gagalKe: ['ayah@example.com'] });
      await handler(req({ aksi: 'kirim' }));
      const semua = log.mock.calls.map((c) => String(c[0])).join('\n');
      expect(semua).not.toMatch(/@/);
      expect(semua).not.toContain('Rp');
      expect(semua).not.toContain('Rafli');
    });
  });

  describe('aksi verifikasi', () => {
    it('non-Pro → 403', async () => {
      const { handler, email } = siapkan({ pro: false });
      const res = await handler(req({ aksi: 'verifikasi', recipient_id: 'r3' }));
      expect(res.status).toBe(403);
      expect(email.kirim).not.toHaveBeenCalled();
    });

    it('belum terverifikasi → satu email verifikasi dengan token verif', async () => {
      const { handler, email, db } = siapkan();
      const res = await handler(req({ aksi: 'verifikasi', recipient_id: 'r3' }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ terkirim: true });
      expect(db.tandaiVerifikasi).toHaveBeenCalledWith('r3');
      expect(email.terkirim).toHaveLength(1);
      const p = email.terkirim[0];
      expect(p.ke).toBe('kakak@example.com');
      expect(p.subjek).toBe(SUBJEK_VERIFIKASI);
      expect(p.teks).toContain('Rafli <b>');
      expect(p.html).toContain('Rafli &lt;b&gt;');
      const token = tautanDari(p);
      const baca = await bacaToken(token!, async () => 'kakak@example.com', ttd, Math.floor(SEKARANG.getTime() / 1000));
      expect(baca).toEqual({ ok: true, tujuan: 'verif', recipientId: 'r3' });
    });

    it('tandaiVerifikasi false → 429 tanpa email', async () => {
      const { handler, email } = siapkan({ tandai: async () => false });
      const res = await handler(req({ aksi: 'verifikasi', recipient_id: 'r3' }));
      expect(res.status).toBe(429);
      expect(await res.json()).toEqual({
        galat: 'batas',
        pesan: 'Tunggu 10 menit sebelum mengirim ulang verifikasi.',
      });
      expect(email.kirim).not.toHaveBeenCalled();
    });

    it('sudah terverifikasi → 409 tanpa email', async () => {
      const { handler, email, db } = siapkan();
      const res = await handler(req({ aksi: 'verifikasi', recipient_id: 'r1' }));
      expect(res.status).toBe(409);
      expect(email.kirim).not.toHaveBeenCalled();
      expect(db.tandaiVerifikasi).not.toHaveBeenCalled();
    });

    it('id asing → 404 tidak_ditemukan', async () => {
      const { handler, email } = siapkan();
      const res = await handler(req({ aksi: 'verifikasi', recipient_id: 'milik-orang-lain' }));
      expect(res.status).toBe(404);
      expect((await res.json()).galat).toBe('tidak_ditemukan');
      expect(email.kirim).not.toHaveBeenCalled();
    });

    it('tanpa recipient_id → 400', async () => {
      const { handler } = siapkan();
      expect((await handler(req({ aksi: 'verifikasi' }))).status).toBe(400);
    });

    it('email gagal → 502', async () => {
      const { handler } = siapkan({ gagalKe: ['kakak@example.com'] });
      expect((await handler(req({ aksi: 'verifikasi', recipient_id: 'r3' }))).status).toBe(502);
    });
  });
});
