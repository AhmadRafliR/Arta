import { buatPenyediaMock } from '../mock';
import { pilihPenyedia } from '../penyedia';

describe('pilihPenyedia', () => {
  it('kunci + android -> revenuecat', () => {
    expect(pilihPenyedia({ apiKey: 'goog_x', platform: 'android', dev: false }).nama).toBe('revenuecat');
  });
  it('tanpa kunci + dev -> mock', () => {
    expect(pilihPenyedia({ apiKey: undefined, platform: 'android', dev: true }).nama).toBe('mock');
  });
  it('tanpa kunci rilis, atau bukan android -> tidak-tersedia', async () => {
    const a = pilihPenyedia({ apiKey: '', platform: 'android', dev: false });
    expect(a.nama).toBe('tidak-tersedia');
    expect((await a.beli('x')).status).toBe('galat');
    expect(pilihPenyedia({ apiKey: 'k', platform: 'ios', dev: false }).nama).toBe('tidak-tersedia');
  });
});

describe('mock', () => {
  it('paket palsu bulanan trial 14 hari dan tahunan; beli sukses', async () => {
    const m = buatPenyediaMock({ jedaMs: 0 });
    const p = await m.paket();
    expect(p.find((x) => x.jenis === 'bulanan')).toMatchObject({ harga: 'Rp19.000', ujiCobaHari: 14 });
    expect(p.find((x) => x.jenis === 'tahunan')?.harga).toBe('Rp190.000');
    expect((await m.beli(p[0].id)).status).toBe('sukses');
  });
});
