import { buatHandlerVerifikasi, PESAN_VERIFIKASI } from '../laporan/handlerVerifikasi';
import { buatToken, MASA_HENTI, MASA_VERIF, type Tujuan } from '../laporan/token';

const ttd = async (pesan: string) => {
  let h = 5381;
  for (let i = 0; i < pesan.length; i++) h = ((h * 33) ^ pesan.charCodeAt(i)) >>> 0;
  return `s${h.toString(36)}`;
};

const SEKARANG = new Date('2026-11-20T05:00:00Z');
const DETIK = Math.floor(SEKARANG.getTime() / 1000);
const EMAIL = 'ibu@example.com';
const URL = 'https://proj.supabase.co/functions/v1/report-verify';

function siapkan() {
  const deps = {
    ambilEmail: jest.fn(async (id: string) => (id === 'rec-1' ? EMAIL : null)),
    tandaiTerverifikasi: jest.fn(async () => {}),
    hapus: jest.fn(async () => {}),
    tandatangan: ttd,
    sekarang: () => SEKARANG,
    log: jest.fn(),
  };
  return { handler: buatHandlerVerifikasi(deps), deps };
}

const token = (tujuan: Tujuan = 'verif', o: { exp?: number; email?: string; id?: string } = {}) =>
  buatToken(
    {
      tujuan,
      recipientId: o.id ?? 'rec-1',
      email: o.email ?? EMAIL,
      exp: o.exp ?? DETIK + (tujuan === 'verif' ? MASA_VERIF : MASA_HENTI),
    },
    ttd,
  );

const get = (t: string) => new Request(`${URL}?t=${encodeURIComponent(t)}`);
const post = (t: string, query = '') =>
  new Request(`${URL}${query}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ t }).toString(),
  });

describe('report-verify', () => {
  it('GET token valid → 200 HTML berisi form, tanpa aksi', async () => {
    const { handler, deps } = siapkan();
    const t = await token('verif');
    const res = await handler(get(t));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    const html = await res.text();
    expect(html).toContain('<form method="post"');
    expect(html).toContain(`name="t" value="${t}"`);
    expect(html).toContain('Ya, konfirmasi');
    expect(deps.tandaiTerverifikasi).not.toHaveBeenCalled();
    expect(deps.hapus).not.toHaveBeenCalled();
  });

  it('GET token henti → tombol berhenti, tanpa aksi', async () => {
    const { handler, deps } = siapkan();
    const html = await (await handler(get(await token('henti')))).text();
    expect(html).toContain('Ya, berhenti menerima');
    expect(deps.hapus).not.toHaveBeenCalled();
  });

  it('GET tanpa token → 400', async () => {
    const { handler } = siapkan();
    const res = await handler(new Request(URL));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain(PESAN_VERIFIKASI.tidakValid);
  });

  it('POST verif → tandaiTerverifikasi', async () => {
    const { handler, deps } = siapkan();
    const res = await handler(post(await token('verif')));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(PESAN_VERIFIKASI.terverifikasi);
    expect(deps.tandaiTerverifikasi).toHaveBeenCalledWith('rec-1');
    expect(deps.hapus).not.toHaveBeenCalled();
  });

  it('POST henti → hapus', async () => {
    const { handler, deps } = siapkan();
    const res = await handler(post(await token('henti')));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(PESAN_VERIFIKASI.berhenti);
    expect(deps.hapus).toHaveBeenCalledWith('rec-1');
    expect(deps.tandaiTerverifikasi).not.toHaveBeenCalled();
  });

  it('POST one-click (token di query, body List-Unsubscribe=One-Click) → hapus', async () => {
    const { handler, deps } = siapkan();
    const t = await token('henti');
    const res = await handler(
      new Request(`${URL}?t=${encodeURIComponent(t)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
      }),
    );
    expect(res.status).toBe(200);
    expect(deps.hapus).toHaveBeenCalledWith('rec-1');
  });

  it('token rusak, kedaluwarsa, email lain, penerima hilang → 400 tanpa aksi', async () => {
    const { handler, deps } = siapkan();
    const valid = await token('verif');
    const rusak = valid.slice(0, -1) + (valid.endsWith('a') ? 'b' : 'a');
    const kasus = [
      'abc',
      rusak,
      await token('verif', { exp: DETIK - 1 }),
      await token('verif', { email: 'lain@example.com' }),
      await token('verif', { id: 'rec-hilang' }),
    ];
    for (const t of kasus) {
      const resGet = await handler(get(t));
      expect(resGet.status).toBe(400);
      const resPost = await handler(post(t));
      expect(resPost.status).toBe(400);
      expect(await resPost.text()).toContain(PESAN_VERIFIKASI.tidakValid);
    }
    expect(deps.tandaiTerverifikasi).not.toHaveBeenCalled();
    expect(deps.hapus).not.toHaveBeenCalled();
  });

  it('galat db → 500 halaman', async () => {
    const { handler, deps } = siapkan();
    deps.tandaiTerverifikasi.mockRejectedValueOnce(new Error('db'));
    const res = await handler(post(await token('verif')));
    expect(res.status).toBe(500);
  });

  it('log tidak memuat email atau token', async () => {
    const { handler, deps } = siapkan();
    const t = await token('verif');
    await handler(get(t));
    await handler(post(t));
    const semua = deps.log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(semua).not.toContain('@');
    expect(semua).not.toContain(t);
  });
});
