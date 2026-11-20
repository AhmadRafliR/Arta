import { buatHandler, GalatSesi, tanggalDiZona, type DbPengguna, type Kuota } from '../handler';
import type { Konteks } from '../parsing';

const K: Konteks = {
  hariIni: '2026-11-20',
  dompet: [{ id: 'w-gopay', nama: 'GoPay', tipe: 'harian' }],
  kategori: [{ jenis: 'pengeluaran', nama: 'rokok' }],
};

const KUOTA: Kuota = { bulan: '2026-11', terpakai: 3, batas: 30, pro: false };

const HASIL_ROKOK = {
  transaksi: [
    {
      tanggal: '2026-11-20',
      jenis: 'pengeluaran',
      kategori: 'rokok',
      nominal: 25000,
      catatan: '',
      dompet: 'gopay',
      dompet_tujuan: '',
    },
  ],
  butuh_klarifikasi: false,
  pertanyaan: '',
};

function siapkan(opsi: { kuota?: Kuota; ok?: boolean; parse?: () => Promise<unknown>; transkrip?: string } = {}) {
  const kuota = opsi.kuota ?? KUOTA;
  const db: { [K in keyof DbPengguna]: jest.Mock } = {
    kuota: jest.fn(async () => kuota),
    pakaiKuota: jest.fn(async () => ({
      ...kuota,
      terpakai: kuota.terpakai + 1,
      ok: opsi.ok ?? true,
    })),
    konteks: jest.fn(async () => K),
  };
  const openai = {
    transkripsi: jest.fn(
      async (_audio: Uint8Array, _mime: string): Promise<string> => opsi.transkrip ?? 'rokok 25rb gopay',
    ),
    parse: jest.fn(
      async (_prompt: string, _teks: string): Promise<unknown> =>
        opsi.parse ? opsi.parse() : HASIL_ROKOK,
    ),
  };
  const dbFactory = jest.fn(() => db as unknown as DbPengguna);
  let n = 0;
  const handler = buatHandler({
    db: dbFactory,
    openai,
    buatId: () => `id-${++n}`,
    sekarang: () => new Date('2026-11-20T05:00:00Z'),
  });
  return { handler, db, openai, dbFactory };
}

function req(body: unknown, opsi: { auth?: string | null; method?: string; mentah?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const auth = opsi.auth === undefined ? 'Bearer tok-123' : opsi.auth;
  if (auth !== null) headers.authorization = auth;
  return new Request('http://localhost/parse', {
    method: opsi.method ?? 'POST',
    headers,
    body: opsi.method === 'OPTIONS' ? undefined : (opsi.mentah ?? JSON.stringify(body)),
  });
}

const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));

describe('handler parse', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('tanpa Authorization → 401', async () => {
    const { handler, db, openai } = siapkan();
    const res = await handler(req({ teks: 'rokok 25rb' }, { auth: null }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ galat: 'unauthorized', pesan: 'Sesi habis, masuk lagi.' });
    expect(db.kuota).not.toHaveBeenCalled();
    expect(openai.parse).not.toHaveBeenCalled();
  });

  it('Authorization bukan Bearer → 401', async () => {
    const { handler } = siapkan();
    const res = await handler(req({ teks: 'x' }, { auth: 'Basic abc' }));
    expect(res.status).toBe(401);
  });

  it('kuota() melempar GalatSesi → 401', async () => {
    const { handler, db, openai } = siapkan();
    db.kuota.mockRejectedValueOnce(new GalatSesi());
    const res = await handler(req({ teks: 'rokok 25rb' }));
    expect(res.status).toBe(401);
    expect(openai.parse).not.toHaveBeenCalled();
  });

  it('token diteruskan ke db()', async () => {
    const { handler, dbFactory } = siapkan();
    await handler(req({ teks: 'rokok 25rb gopay' }));
    expect(dbFactory).toHaveBeenCalledWith('tok-123');
  });

  it('body kosong → 400', async () => {
    const { handler, db } = siapkan();
    const res = await handler(req({}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ galat: 'bad_request', pesan: 'Kirim suara atau teks.' });
    expect(db.kuota).not.toHaveBeenCalled();
  });

  it('body bukan JSON → 400', async () => {
    const { handler } = siapkan();
    const res = await handler(req(null, { mentah: '{rusak' }));
    expect(res.status).toBe(400);
    expect((await res.json()).galat).toBe('bad_request');
  });

  it('teks hanya spasi → 400', async () => {
    const { handler } = siapkan();
    expect((await handler(req({ teks: '   ' }))).status).toBe(400);
  });

  it('teks 501 karakter → 400', async () => {
    const { handler, db, openai } = siapkan();
    const res = await handler(req({ teks: 'a'.repeat(501) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      galat: 'bad_request',
      pesan: 'Teks terlalu panjang (maks 500 huruf).',
    });
    expect(db.kuota).not.toHaveBeenCalled();
    expect(openai.parse).not.toHaveBeenCalled();
  });

  it('teks 500 karakter diterima', async () => {
    const { handler } = siapkan();
    expect((await handler(req({ teks: 'a'.repeat(500) }))).status).toBe(200);
  });

  it('audio > 6 MB setelah decode → 400', async () => {
    const { handler, openai, db } = siapkan();
    const besar = Buffer.alloc(6 * 1024 * 1024 + 1).toString('base64');
    const res = await handler(req({ audio_base64: besar, mime: 'audio/mp4' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ galat: 'bad_request', pesan: 'Rekaman terlalu panjang.' });
    expect(openai.transkripsi).not.toHaveBeenCalled();
    expect(db.pakaiKuota).not.toHaveBeenCalled();
  });

  it('audio tepat 6 MB diterima', async () => {
    const { handler, openai } = siapkan();
    const pas = Buffer.alloc(6 * 1024 * 1024).toString('base64');
    const res = await handler(req({ audio_base64: pas }));
    expect(res.status).toBe(200);
    expect(openai.transkripsi.mock.calls[0][0]).toHaveLength(6 * 1024 * 1024);
  });

  it('audio base64 tidak valid → 400', async () => {
    const { handler, openai } = siapkan();
    const res = await handler(req({ audio_base64: '!!!bukan base64!!!' }));
    expect(res.status).toBe(400);
    expect(openai.transkripsi).not.toHaveBeenCalled();
  });

  it('kuota habis → 402 dan openai tidak dipanggil', async () => {
    const habis = { bulan: '2026-11', terpakai: 30, batas: 30, pro: false };
    const { handler, openai, db } = siapkan({ kuota: habis });
    const res = await handler(req({ teks: 'rokok 25rb gopay' }));
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({
      galat: 'quota_exceeded',
      pesan: 'Kuota catat AI bulan ini habis.',
      kuota: habis,
    });
    expect(openai.parse).not.toHaveBeenCalled();
    expect(openai.transkripsi).not.toHaveBeenCalled();
    expect(db.pakaiKuota).not.toHaveBeenCalled();
  });

  it('teks + parse palsu → 200, draf 1, pakaiKuota 1×, transkrip = teks', async () => {
    const { handler, openai, db } = siapkan();
    const res = await handler(req({ teks: 'rokok 25rb gopay' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transkrip).toBe('rokok 25rb gopay');
    expect(body.draf).toHaveLength(1);
    expect(body.draf[0]).toMatchObject({
      id: 'id-1',
      jenis: 'pengeluaran',
      kategori: 'rokok',
      nominal: 25000,
      wallet_id: 'w-gopay',
    });
    expect(body.koreksi).toEqual([]);
    expect(body.tidakDidukung).toEqual([]);
    expect(body.butuh_klarifikasi).toBe(false);
    expect(body.pertanyaan).toBeNull();
    expect(body.kuota).toEqual({ bulan: '2026-11', terpakai: 4, batas: 30, pro: false });
    expect(db.pakaiKuota).toHaveBeenCalledTimes(1);
    expect(openai.transkripsi).not.toHaveBeenCalled();
    expect(openai.parse).toHaveBeenCalledTimes(1);
    const [prompt, teks] = openai.parse.mock.calls[0];
    expect(prompt).toContain('Hari ini: 2026-11-20');
    expect(teks).toBe('rokok 25rb gopay');
    expect(db.konteks).toHaveBeenCalledWith(new Date('2026-11-20T05:00:00Z'));
  });

  it('respons membawa header CORS', async () => {
    const { handler } = siapkan();
    const res = await handler(req({ teks: 'rokok 25rb gopay' }));
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('OPTIONS → 200 dengan header CORS', async () => {
    const { handler, db } = siapkan();
    const res = await handler(req(null, { method: 'OPTIONS', auth: null }));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-headers')).toBe(
      'authorization, x-client-info, apikey, content-type',
    );
    expect(db.kuota).not.toHaveBeenCalled();
  });

  it('audio base64 → transkripsi dengan bytes hasil decode, lalu parse dengan transkrip', async () => {
    const { handler, openai, db } = siapkan({ transkrip: '  rokok 25rb gopay ' });
    const bytes = [0, 1, 2, 250, 255, 128];
    const res = await handler(req({ audio_base64: b64(bytes), mime: 'audio/mp4' }));
    expect(res.status).toBe(200);
    const [audio, mime] = openai.transkripsi.mock.calls[0];
    expect(audio).toBeInstanceOf(Uint8Array);
    expect(Array.from(audio)).toEqual(bytes);
    expect(mime).toBe('audio/mp4');
    expect(openai.parse.mock.calls[0][1]).toBe('rokok 25rb gopay');
    const body = await res.json();
    expect(body.transkrip).toBe('rokok 25rb gopay');
    expect(db.pakaiKuota).toHaveBeenCalledTimes(1);
  });

  it('transkrip kosong → klarifikasi, pakaiKuota tidak dipanggil', async () => {
    const { handler, openai, db } = siapkan({ transkrip: '  ' });
    const res = await handler(req({ audio_base64: b64([1, 2, 3]) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      transkrip: '',
      draf: [],
      koreksi: [],
      tidakDidukung: [],
      butuh_klarifikasi: true,
      pertanyaan: 'Suaranya belum terdengar jelas. Coba ulangi lebih dekat ke mic.',
      kuota: KUOTA,
    });
    expect(openai.parse).not.toHaveBeenCalled();
    expect(db.pakaiKuota).not.toHaveBeenCalled();
  });

  it('openai.parse melempar → 502 dan pakaiKuota tidak dipanggil', async () => {
    const { handler, db } = siapkan({
      parse: async () => {
        throw new Error('boom');
      },
    });
    const res = await handler(req({ teks: 'rokok 25rb gopay' }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      galat: 'ai_gagal',
      pesan: 'AI sedang sibuk, coba lagi sebentar.',
    });
    expect(db.pakaiKuota).not.toHaveBeenCalled();
  });

  it('openai.transkripsi melempar → 502 dan pakaiKuota tidak dipanggil', async () => {
    const { handler, db, openai } = siapkan();
    openai.transkripsi.mockRejectedValueOnce(new Error('stt'));
    const res = await handler(req({ audio_base64: b64([1, 2]) }));
    expect(res.status).toBe(502);
    expect(db.pakaiKuota).not.toHaveBeenCalled();
  });

  it('hasil butuh_klarifikasi: true → 200 tanpa pakaiKuota', async () => {
    const { handler, db } = siapkan({
      parse: async () => ({ transaksi: [], butuh_klarifikasi: true, pertanyaan: 'Berapa nominalnya?' }),
    });
    const res = await handler(req({ teks: 'beli rokok' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.butuh_klarifikasi).toBe(true);
    expect(body.pertanyaan).toBe('Berapa nominalnya?');
    expect(body.kuota).toEqual(KUOTA);
    expect(db.pakaiKuota).not.toHaveBeenCalled();
  });

  it('hasil hanya tidakDidukung → 200 tanpa pakaiKuota', async () => {
    const { handler, db } = siapkan({
      parse: async () => ({
        transaksi: [
          {
            tanggal: '',
            jenis: 'hutang_baru',
            kategori: 'budi',
            nominal: 50000,
            catatan: 'pinjam budi',
            dompet: '',
            dompet_tujuan: '',
          },
        ],
        butuh_klarifikasi: false,
        pertanyaan: '',
      }),
    });
    const res = await handler(req({ teks: 'pinjam budi 50rb' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.draf).toEqual([]);
    expect(body.tidakDidukung).toHaveLength(1);
    expect(body.butuh_klarifikasi).toBe(false);
    expect(body.kuota).toEqual(KUOTA);
    expect(db.pakaiKuota).not.toHaveBeenCalled();
  });

  it('hasil hanya koreksi → pakaiKuota dipanggil', async () => {
    const { handler, db } = siapkan({
      parse: async () => ({
        transaksi: [
          {
            tanggal: '',
            jenis: 'koreksi_saldo',
            kategori: '',
            nominal: 150000,
            catatan: '',
            dompet: 'gopay',
            dompet_tujuan: '',
          },
        ],
        butuh_klarifikasi: false,
        pertanyaan: '',
      }),
    });
    const res = await handler(req({ teks: 'saldo gopay sekarang 150rb' }));
    expect(res.status).toBe(200);
    expect((await res.json()).koreksi).toHaveLength(1);
    expect(db.pakaiKuota).toHaveBeenCalledTimes(1);
  });

  it('pakaiKuota ok: false (balapan) → 402', async () => {
    const { handler } = siapkan({ ok: false });
    const res = await handler(req({ teks: 'rokok 25rb gopay' }));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.galat).toBe('quota_exceeded');
    expect(body.pesan).toBe('Kuota catat AI bulan ini habis.');
    expect(body.kuota).toEqual({ bulan: '2026-11', terpakai: 4, batas: 30, pro: false });
    expect(body.kuota).not.toHaveProperty('ok');
  });

  it('kuota() gagal (bukan sesi) → 500 tanpa OpenAI', async () => {
    const { handler, db, openai } = siapkan();
    db.kuota.mockRejectedValueOnce(new Error('db down'));
    const res = await handler(req({ teks: 'rokok 25rb gopay' }));
    expect(res.status).toBe(500);
    expect((await res.json()).galat).toBe('server');
    expect(openai.parse).not.toHaveBeenCalled();
  });

  it('konteks() gagal → 500 tanpa OpenAI dan tanpa pakaiKuota', async () => {
    const { handler, db, openai } = siapkan();
    db.konteks.mockRejectedValueOnce(new Error('db down'));
    const res = await handler(req({ teks: 'rokok 25rb gopay' }));
    expect(res.status).toBe(500);
    expect(openai.parse).not.toHaveBeenCalled();
    expect(db.pakaiKuota).not.toHaveBeenCalled();
  });

  it('pakaiKuota() melempar → 500', async () => {
    const { handler, db } = siapkan();
    db.pakaiKuota.mockRejectedValueOnce(new Error('db down'));
    const res = await handler(req({ teks: 'rokok 25rb gopay' }));
    expect(res.status).toBe(500);
    expect((await res.json()).galat).toBe('server');
  });

  it('log galat tidak memuat teks pengguna', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { handler } = siapkan({
      parse: async () => {
        throw new Error('rahasia rokok 25rb gopay');
      },
    });
    await handler(req({ teks: 'rokok 25rb gopay' }));
    expect(spy).toHaveBeenCalled();
    expect(JSON.stringify(spy.mock.calls)).not.toContain('rokok');
  });

  it('metode selain POST → 400', async () => {
    const { handler } = siapkan();
    const res = await handler(new Request('http://localhost/parse', { method: 'GET' }));
    expect(res.status).toBe(400);
  });
});

describe('tanggalDiZona', () => {
  it('memakai zona profil', () => {
    const t = new Date('2026-11-20T18:00:00Z');
    expect(tanggalDiZona(t, 'Asia/Jakarta')).toBe('2026-11-21');
    expect(tanggalDiZona(t, 'America/New_York')).toBe('2026-11-20');
  });

  it('zona tidak valid/kosong → Asia/Jakarta', () => {
    const t = new Date('2026-11-20T18:00:00Z');
    expect(tanggalDiZona(t, 'Bukan/Zona')).toBe('2026-11-21');
    expect(tanggalDiZona(t, null)).toBe('2026-11-21');
  });
});
