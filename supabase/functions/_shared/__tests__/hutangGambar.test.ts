import { GalatSesi, type Kuota } from '../handler';
import {
  buatHandlerHutangGambar,
  buatPromptHutang,
  SKEMA,
  validasiDrafHutang,
  type DbHutang,
} from '../hutangGambar';

const KUOTA: Kuota = { bulan: '2026-11', terpakai: 3, batas: 30, pro: false };
const GAMBAR = btoa('gambar-palsu');

const AI_VALID = {
  adalah_tagihan: true,
  pemberi: 'SPayLater',
  tipe: 'cicilan_tetap',
  nominal_cicilan: 450000,
  tenor_bulan: 6,
  jatuh_tempo: '2026-12-05',
  pokok_awal: 3000000,
  bunga_persen_bulanan: 2.5,
  sisa_pokok: 2000000,
  catatan: 'Cicilan ke-4 dari 10',
};

function siapkan(
  opsi: {
    kuota?: Kuota;
    ok?: boolean;
    ai?: (...a: unknown[]) => Promise<unknown>;
    kuotaGalat?: unknown;
    pakaiGalat?: unknown;
  } = {},
) {
  const kuota = opsi.kuota ?? KUOTA;
  const db: { [K in keyof DbHutang]: jest.Mock } = {
    kuota: jest.fn(async () => {
      if (opsi.kuotaGalat) throw opsi.kuotaGalat;
      return kuota;
    }),
    pakaiKuota: jest.fn(async () => {
      if (opsi.pakaiGalat) throw opsi.pakaiGalat;
      return { ...kuota, terpakai: kuota.terpakai + 1, ok: opsi.ok ?? true };
    }),
    hariIni: jest.fn(async () => '2026-11-21'),
  };
  const baca = jest.fn<Promise<unknown>, [Uint8Array, string, string]>(opsi.ai ?? (async () => AI_VALID));
  const handler = buatHandlerHutangGambar({
    db: () => db,
    ai: { baca },
    sekarang: () => new Date('2026-11-21T03:00:00Z'),
  });
  return { handler, db, baca };
}

function req(body: unknown, opsi: { auth?: string | null; method?: string } = {}): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const auth = opsi.auth === undefined ? 'Bearer jwt-pengguna' : opsi.auth;
  if (auth) headers.Authorization = auth;
  const method = opsi.method ?? 'POST';
  return new Request('http://x/parse-hutang', {
    method,
    headers,
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
}

const OK = { gambar_base64: GAMBAR, mime: 'image/png' };

describe('handler parse-hutang', () => {
  it('OPTIONS membalas CORS', async () => {
    const { handler } = siapkan();
    const res = await handler(req(null, { method: 'OPTIONS' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('tanpa token → 401', async () => {
    const { handler, baca } = siapkan();
    const res = await handler(req(OK, { auth: null }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ galat: 'unauthorized', pesan: 'Sesi habis, masuk lagi.' });
    expect(baca).not.toHaveBeenCalled();
  });

  it('JWT ditolak db → 401', async () => {
    const { handler, baca } = siapkan({ kuotaGalat: new GalatSesi() });
    const res = await handler(req(OK));
    expect(res.status).toBe(401);
    expect(baca).not.toHaveBeenCalled();
  });

  it('galat db lain → 500', async () => {
    const { handler } = siapkan({ kuotaGalat: new Error('db') });
    const res = await handler(req(OK));
    expect(res.status).toBe(500);
    expect((await res.json()).galat).toBe('server');
  });

  it('body bukan JSON / kosong / tanpa gambar → 400', async () => {
    const { handler } = siapkan();
    for (const body of ['bukan json', { mime: 'image/png' }, { gambar_base64: '  ', mime: 'image/png' }, [], 'null']) {
      const res = await handler(req(body));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ galat: 'bad_request', pesan: 'Kirim screenshot tagihan.' });
    }
  });

  it('base64 rusak → 400', async () => {
    const { handler } = siapkan();
    const res = await handler(req({ gambar_base64: '###', mime: 'image/png' }));
    expect(res.status).toBe(400);
  });

  it('mime selain jpeg/png/webp → 400', async () => {
    const { handler, baca } = siapkan();
    for (const mime of ['image/gif', 'application/pdf', '', undefined]) {
      const res = await handler(req({ gambar_base64: GAMBAR, mime }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ galat: 'bad_request', pesan: 'Format gambar harus JPG, PNG, atau WEBP.' });
    }
    expect(baca).not.toHaveBeenCalled();
  });

  it('menerima awalan data: dan ketiga mime', async () => {
    for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
      const { handler, baca } = siapkan();
      const res = await handler(req({ gambar_base64: `data:${mime};base64,${GAMBAR}`, mime }));
      expect(res.status).toBe(200);
      expect(baca).toHaveBeenCalledTimes(1);
      expect(baca.mock.calls[0][1]).toBe(mime);
      expect(Array.from(baca.mock.calls[0][0] as Uint8Array)).toEqual(
        Array.from(new TextEncoder().encode('gambar-palsu')),
      );
    }
  });

  it('gambar > 6 MB → 400 tanpa memanggil AI', async () => {
    const { handler, db, baca } = siapkan();
    const raksasa = 'A'.repeat(9 * 1024 * 1024);
    const res = await handler(req({ gambar_base64: raksasa, mime: 'image/jpeg' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ galat: 'bad_request', pesan: 'Gambar terlalu besar (maks 6 MB).' });
    expect(db.kuota).not.toHaveBeenCalled();
    expect(baca).not.toHaveBeenCalled();
  });

  it('kuota habis → 402 tanpa memanggil AI', async () => {
    const habis = { ...KUOTA, terpakai: 30 };
    const { handler, baca, db } = siapkan({ kuota: habis });
    const res = await handler(req(OK));
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({
      galat: 'quota_exceeded',
      pesan: 'Kuota catat AI bulan ini habis.',
      kuota: habis,
    });
    expect(baca).not.toHaveBeenCalled();
    expect(db.pakaiKuota).not.toHaveBeenCalled();
  });

  it('AI gagal → 502 dan kuota tidak terpakai', async () => {
    const { handler, db } = siapkan({
      ai: async () => {
        throw new Error('timeout');
      },
    });
    const res = await handler(req(OK));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ galat: 'ai_gagal', pesan: 'AI sedang sibuk, coba lagi sebentar.' });
    expect(db.pakaiKuota).not.toHaveBeenCalled();
  });

  it('bukan tagihan → draf null, pesan, kuota tidak terpakai', async () => {
    const { handler, db } = siapkan({ ai: async () => ({ adalah_tagihan: false }) });
    const res = await handler(req(OK));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.draf).toBeNull();
    expect(body.pesan).toBe(
      'Screenshot ini tidak terlihat seperti tagihan atau cicilan. Coba screenshot halaman detail tagihan.',
    );
    expect(body.kuota).toEqual(KUOTA);
    expect(db.pakaiKuota).not.toHaveBeenCalled();
  });

  it('draf valid → 200, kuota dipakai tepat sekali, prompt memuat hari ini', async () => {
    const { handler, db, baca } = siapkan();
    const res = await handler(req(OK));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.draf).toEqual({
      pemberi: 'SPayLater',
      tipe: 'cicilan_tetap',
      nominal_cicilan: 450000,
      tenor_bulan: 6,
      jatuh_tempo: '2026-12-05',
      pokok_awal: 3000000,
      bunga_persen_bulanan: 2.5,
      sisa_pokok: 2000000,
      catatan: 'Cicilan ke-4 dari 10',
    });
    expect(body.pesan).toBeNull();
    expect(body.kuota).toEqual({ ...KUOTA, terpakai: 4 });
    expect(db.pakaiKuota).toHaveBeenCalledTimes(1);
    expect(db.hariIni).toHaveBeenCalledTimes(1);
    expect(baca.mock.calls[0][2]).toContain('2026-11-21');
  });

  it('pakaiKuota ok=false → 402', async () => {
    const { handler } = siapkan({ ok: false });
    const res = await handler(req(OK));
    expect(res.status).toBe(402);
    expect((await res.json()).galat).toBe('quota_exceeded');
  });

  it('pakaiKuota galat sesi → 401, galat lain → 500', async () => {
    expect((await siapkan({ pakaiGalat: new GalatSesi() }).handler(req(OK))).status).toBe(401);
    expect((await siapkan({ pakaiGalat: new Error('x') }).handler(req(OK))).status).toBe(500);
  });

  it('GET → 400', async () => {
    const { handler } = siapkan();
    const res = await handler(req(null, { method: 'GET' }));
    expect(res.status).toBe(400);
  });
});

describe('validasiDrafHutang', () => {
  const v = (o: Record<string, unknown>) => validasiDrafHutang({ ...AI_VALID, ...o });

  it('menolak input bukan objek', () => {
    for (const x of [null, undefined, 'x', 5, []]) expect(validasiDrafHutang(x)).toBeNull();
  });

  it('adalah_tagihan false → null', () => {
    expect(v({ adalah_tagihan: false })).toBeNull();
  });

  it('pemberi dipangkas, dipotong 40 huruf, kosong → null', () => {
    expect(v({ pemberi: '  Kredivo  ' })?.pemberi).toBe('Kredivo');
    expect(v({ pemberi: 'A'.repeat(60) })?.pemberi).toHaveLength(40);
    expect(v({ pemberi: '   ' })).toBeNull();
    expect(v({ pemberi: null })).toBeNull();
    expect(v({ pemberi: 123 })).toBeNull();
  });

  it('tipe tidak valid disimpulkan dari data', () => {
    expect(v({ tipe: 'lain' })?.tipe).toBe('cicilan_tetap');
    expect(v({ tipe: null, tenor_bulan: null, nominal_cicilan: null })?.tipe).toBe('berbunga');
    expect(v({ tipe: 'berbunga' })?.tipe).toBe('berbunga');
    expect(v({ tipe: 'lain', tenor_bulan: null })?.tipe).toBe('berbunga');
  });

  it('nominal dibulatkan; NaN, negatif, nol, > 1e12 → null', () => {
    expect(v({ nominal_cicilan: 450000.6 })?.nominal_cicilan).toBe(450001);
    expect(v({ nominal_cicilan: NaN })?.nominal_cicilan).toBeNull();
    expect(v({ nominal_cicilan: -5 })?.nominal_cicilan).toBeNull();
    expect(v({ nominal_cicilan: 0 })?.nominal_cicilan).toBeNull();
    expect(v({ nominal_cicilan: 0.3 })?.nominal_cicilan).toBeNull();
    expect(v({ nominal_cicilan: '450000' })?.nominal_cicilan).toBeNull();
    expect(v({ nominal_cicilan: 1e12 })?.nominal_cicilan).toBe(1e12);
    expect(v({ nominal_cicilan: 1e12 + 1 })?.nominal_cicilan).toBeNull();
    expect(v({ pokok_awal: Infinity })?.pokok_awal).toBeNull();
  });

  it('tanpa nominal_cicilan dan pokok_awal → null', () => {
    expect(v({ nominal_cicilan: null, pokok_awal: null })).toBeNull();
    expect(v({ nominal_cicilan: -1, pokok_awal: NaN })).toBeNull();
    expect(v({ nominal_cicilan: null })?.pokok_awal).toBe(3000000);
    expect(v({ pokok_awal: null })?.nominal_cicilan).toBe(450000);
  });

  it('tenor 1-60 bulat, selain itu null', () => {
    expect(v({ tenor_bulan: 1 })?.tenor_bulan).toBe(1);
    expect(v({ tenor_bulan: 60 })?.tenor_bulan).toBe(60);
    expect(v({ tenor_bulan: 5.6 })?.tenor_bulan).toBe(6);
    expect(v({ tenor_bulan: 0 })?.tenor_bulan).toBeNull();
    expect(v({ tenor_bulan: 61 })?.tenor_bulan).toBeNull();
    expect(v({ tenor_bulan: -3 })?.tenor_bulan).toBeNull();
    expect(v({ tenor_bulan: null })?.tenor_bulan).toBeNull();
  });

  it('jatuh_tempo harus tanggal YYYY-MM-DD yang valid', () => {
    expect(v({ jatuh_tempo: '2026-02-30' })?.jatuh_tempo).toBeNull();
    expect(v({ jatuh_tempo: '2026-13-01' })?.jatuh_tempo).toBeNull();
    expect(v({ jatuh_tempo: '5 Des 2026' })?.jatuh_tempo).toBeNull();
    expect(v({ jatuh_tempo: '2026-12-5' })?.jatuh_tempo).toBeNull();
    expect(v({ jatuh_tempo: null })?.jatuh_tempo).toBeNull();
    expect(v({ jatuh_tempo: 20261205 })?.jatuh_tempo).toBeNull();
    expect(v({ jatuh_tempo: '2028-02-29' })?.jatuh_tempo).toBe('2028-02-29');
    expect(v({ jatuh_tempo: '2026-12-05' })?.jatuh_tempo).toBe('2026-12-05');
  });

  it('bunga 0-100 maks 2 desimal', () => {
    expect(v({ bunga_persen_bulanan: 2.567 })?.bunga_persen_bulanan).toBe(2.57);
    expect(v({ bunga_persen_bulanan: 0 })?.bunga_persen_bulanan).toBe(0);
    expect(v({ bunga_persen_bulanan: 100 })?.bunga_persen_bulanan).toBe(100);
    expect(v({ bunga_persen_bulanan: 100.5 })?.bunga_persen_bulanan).toBeNull();
    expect(v({ bunga_persen_bulanan: -1 })?.bunga_persen_bulanan).toBeNull();
    expect(v({ bunga_persen_bulanan: NaN })?.bunga_persen_bulanan).toBeNull();
    expect(v({ bunga_persen_bulanan: null })?.bunga_persen_bulanan).toBeNull();
  });

  it('sisa_pokok > pokok_awal → sisa_pokok null; sama atau kurang dipertahankan', () => {
    expect(v({ pokok_awal: 1000000, sisa_pokok: 1500000 })?.sisa_pokok).toBeNull();
    expect(v({ pokok_awal: 1000000, sisa_pokok: 1000000 })?.sisa_pokok).toBe(1000000);
    expect(v({ pokok_awal: 1000000, sisa_pokok: 400000 })?.sisa_pokok).toBe(400000);
    expect(v({ pokok_awal: null, sisa_pokok: 400000 })?.sisa_pokok).toBe(400000);
  });

  it('catatan dipotong 120 huruf, kosong → null', () => {
    expect(v({ catatan: 'x'.repeat(200) })?.catatan).toHaveLength(120);
    expect(v({ catatan: '  ' })?.catatan).toBeNull();
    expect(v({ catatan: null })?.catatan).toBeNull();
  });
});

describe('prompt dan skema', () => {
  it('prompt memuat tanggal hari ini dan aturan utama', () => {
    const p = buatPromptHutang('2026-11-21');
    expect(p).toContain('2026-11-21');
    expect(p).toMatch(/LIMIT/);
    expect(p).toMatch(/sisa/i);
    expect(p).toMatch(/denda/i);
  });

  it('skema semua kolom draf nullable dan wajib', () => {
    expect(SKEMA.type).toBe('OBJECT');
    expect(Object.keys(SKEMA.properties)).toEqual(expect.arrayContaining([...SKEMA.required]));
  });
});
