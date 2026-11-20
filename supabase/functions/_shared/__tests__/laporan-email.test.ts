import {
  buatPengirimLog,
  buatPengirimMemori,
  buatPengirimResend,
  pilihPengirim,
  type PesanEmail,
} from '../laporan/email';

const PESAN: PesanEmail = {
  ke: 'ortu@example.com',
  subjek: 'Laporan keuangan November 2026 · Rafli',
  html: '<p>RAHASIA-HTML</p>',
  teks: 'RAHASIA-TEKS',
  header: { 'List-Unsubscribe': '<https://x.test/h>' },
};

const respons = (status: number, badan: unknown) =>
  ({ status, ok: status >= 200 && status < 300, json: async () => badan }) as unknown as Response;

describe('pengirim memori', () => {
  it('mencatat pesan', async () => {
    const p = buatPengirimMemori();
    const r = await p.kirim(PESAN);
    expect(p.terkirim).toEqual([PESAN]);
    expect(r.id).toBeTruthy();
  });
});

describe('pengirim log', () => {
  it('menyamarkan alamat dan tidak memuat isi', async () => {
    const baris: string[] = [];
    const p = buatPengirimLog((b) => baris.push(b));
    const a = await p.kirim(PESAN);
    const b = await p.kirim(PESAN);
    expect([a.id, b.id]).toEqual(['log-1', 'log-2']);
    const log = baris.join('\n');
    expect(log).toContain('o***@example.com');
    expect(log).toContain(PESAN.subjek);
    expect(log).not.toContain('ortu@example.com');
    expect(log).not.toContain('RAHASIA');
  });
});

describe('pengirim resend', () => {
  it('memanggil fetch dengan URL, header, dan body benar', async () => {
    const f = jest.fn(async () => respons(200, { id: 'abc123' }));
    const p = buatPengirimResend({ apiKey: 're_test', dari: 'arta <a@x.test>', fetch: f as unknown as typeof fetch });
    const r = await p.kirim(PESAN);
    expect(r).toEqual({ id: 'abc123' });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = (f.mock.calls as unknown as [string, RequestInit][])[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'Bearer re_test', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'arta <a@x.test>',
      to: ['ortu@example.com'],
      subject: PESAN.subjek,
      html: PESAN.html,
      text: PESAN.teks,
      headers: PESAN.header,
    });
  });

  it('non-2xx melempar galat tanpa isi respons', async () => {
    const f = jest.fn(async () => respons(422, { message: 'RAHASIA-RESPONS' }));
    const p = buatPengirimResend({ apiKey: 'k', dari: 'd', fetch: f as unknown as typeof fetch });
    await expect(p.kirim(PESAN)).rejects.toThrow(new Error('resend 422'));
    await p.kirim(PESAN).catch((e: Error) => expect(e.message).not.toContain('RAHASIA'));
  });
});

describe('pilihPengirim', () => {
  const fetchPalsu = jest.fn() as unknown as typeof fetch;
  const env = (o: Record<string, string>) => (k: string) => o[k];

  it('tanpa env: log (tidak memanggil fetch)', async () => {
    const baris: string[] = [];
    const p = pilihPengirim(env({}), fetchPalsu, (b) => baris.push(b));
    const r = await p.kirim(PESAN);
    expect(r.id).toBe('log-1');
    expect(baris).toHaveLength(1);
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it('EMAIL_MODE=resend tanpa kunci: log', async () => {
    const p = pilihPengirim(env({ EMAIL_MODE: 'resend', EMAIL_FROM: 'a@x.test' }), fetchPalsu, () => {});
    expect((await p.kirim(PESAN)).id).toBe('log-1');
    const q = pilihPengirim(env({ EMAIL_MODE: 'resend', RESEND_API_KEY: 'k' }), fetchPalsu, () => {});
    expect((await q.kirim(PESAN)).id).toBe('log-1');
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it('kunci terisi tapi mode bukan resend: log', async () => {
    const p = pilihPengirim(env({ RESEND_API_KEY: 'k', EMAIL_FROM: 'a@x.test' }), fetchPalsu, () => {});
    expect((await p.kirim(PESAN)).id).toBe('log-1');
  });

  it('mode resend lengkap: memakai fetch', async () => {
    const f = jest.fn(async () => respons(200, { id: 'zzz' }));
    const p = pilihPengirim(
      env({ EMAIL_MODE: 'resend', RESEND_API_KEY: 'k', EMAIL_FROM: 'a@x.test' }),
      f as unknown as typeof fetch,
      () => {},
    );
    expect((await p.kirim(PESAN)).id).toBe('zzz');
    expect(f).toHaveBeenCalledTimes(1);
  });
});
