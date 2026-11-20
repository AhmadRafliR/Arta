import { bacaToken, buatToken, MASA_HENTI, MASA_VERIF } from '../laporan/token';

// Tanda tangan palsu deterministik (bukan WebCrypto).
const ttd = async (pesan: string) => {
  let h = 5381;
  for (let i = 0; i < pesan.length; i++) h = ((h * 33) ^ pesan.charCodeAt(i)) >>> 0;
  return `s${h.toString(36)}`;
};

const NOW = 1_800_000_000;
const EMAIL = 'ibu@example.com';
const ambil = async (id: string) => (id === 'rec-1' ? EMAIL : null);

const buat = (tujuan: 'verif' | 'henti' = 'verif', exp = NOW + MASA_VERIF) =>
  buatToken({ tujuan, recipientId: 'rec-1', email: EMAIL, exp }, ttd);

describe('token laporan', () => {
  it('konstanta masa berlaku', () => {
    expect(MASA_VERIF).toBe(7 * 86400);
    expect(MASA_HENTI).toBe(400 * 86400);
  });

  it('buat lalu baca ok', async () => {
    const t = await buat();
    expect(t.split('.')).toHaveLength(4);
    expect(await bacaToken(t, ambil, ttd, NOW)).toEqual({ ok: true, tujuan: 'verif', recipientId: 'rec-1' });
    const h = await buat('henti', NOW + MASA_HENTI);
    expect(await bacaToken(h, ambil, ttd, NOW)).toEqual({ ok: true, tujuan: 'henti', recipientId: 'rec-1' });
  });

  it('tanda tangan diubah', async () => {
    const t = await buat();
    const rusak = t.slice(0, -1) + (t.endsWith('a') ? 'b' : 'a');
    expect(await bacaToken(rusak, ambil, ttd, NOW)).toEqual({ ok: false, alasan: 'tanda_tangan' });
  });

  it('tujuan atau exp diubah tanpa tanda tangan baru', async () => {
    const t = await buat('verif');
    const jadiHenti = t.replace(/^verif/, 'henti');
    expect(await bacaToken(jadiHenti, ambil, ttd, NOW)).toEqual({ ok: false, alasan: 'tanda_tangan' });
    const [a, b, exp, sig] = t.split('.');
    const exp2 = [a, b, String(Number(exp) + 1000), sig].join('.');
    expect(await bacaToken(exp2, ambil, ttd, NOW)).toEqual({ ok: false, alasan: 'tanda_tangan' });
  });

  it('email berbeda dari ambilEmail', async () => {
    const t = await buat();
    const lain = async () => 'lain@example.com';
    expect(await bacaToken(t, lain, ttd, NOW)).toEqual({ ok: false, alasan: 'tanda_tangan' });
  });

  it('kedaluwarsa', async () => {
    const t = await buat('verif', NOW - 1);
    expect(await bacaToken(t, ambil, ttd, NOW)).toEqual({ ok: false, alasan: 'kedaluwarsa' });
  });

  it('recipient hilang', async () => {
    const t = await buat();
    expect(await bacaToken(t, async () => null, ttd, NOW)).toEqual({ ok: false, alasan: 'tidak_ditemukan' });
  });

  it('format salah', async () => {
    expect(await bacaToken('abc', ambil, ttd, NOW)).toEqual({ ok: false, alasan: 'format' });
    expect(await bacaToken('', ambil, ttd, NOW)).toEqual({ ok: false, alasan: 'format' });
    expect(await bacaToken('hapus.rec-1.99999999999.sig', ambil, ttd, NOW)).toEqual({ ok: false, alasan: 'format' });
    expect(await bacaToken('verif.rec-1.abc.sig', ambil, ttd, NOW)).toEqual({ ok: false, alasan: 'format' });
    expect(await bacaToken('verif.rec-1.1.sig.ekstra', ambil, ttd, NOW)).toEqual({ ok: false, alasan: 'format' });
  });

  it('tujuan lain yang ditandatangani tetap format', async () => {
    const t = await buatToken({ tujuan: 'hapus' as never, recipientId: 'rec-1', email: EMAIL, exp: NOW + 10 }, ttd);
    expect(await bacaToken(t, ambil, ttd, NOW)).toEqual({ ok: false, alasan: 'format' });
  });
});
