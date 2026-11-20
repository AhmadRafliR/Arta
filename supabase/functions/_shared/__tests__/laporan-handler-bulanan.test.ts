import { buatPengirimMemori, type PesanEmail } from '../laporan/email';
import { buatHandlerBulanan, waktuLokal, waktunyaKirim, type DepsBulanan } from '../laporan/handlerBulanan';
import type { PenerimaLaporan } from '../laporan/handlerKirim';
import type { DataLaporan } from '../laporan/isi';

const ttd = async (pesan: string) => `s${pesan.length}`;

const DATA: DataLaporan = {
  nama: 'Rafli',
  zona: 'Asia/Jakarta',
  wallets: [{ id: 'w1', nama: 'GoPay', tipe: 'harian', saldo_awal: 100000, target: null, diarsip: false }],
  txs: [],
  budgets: [],
  hutang: null,
};

const PENERIMA: Record<string, PenerimaLaporan[]> = {
  a: [
    { id: 'ra1', email: 'ibu@example.com', terverifikasi: true },
    { id: 'ra2', email: 'adik@example.com', terverifikasi: false },
  ],
  b: [{ id: 'rb1', email: 'ayah@example.com', terverifikasi: true }],
};

type Opsi = {
  sekarang?: string;
  kandidat?: { userId: string; zona: string }[];
  klaim?: (userId: string, bulan: string) => Promise<string | null>;
  data?: (userId: string) => Promise<DataLaporan>;
  rahasia?: string;
};

function siapkan(o: Opsi = {}) {
  const memori = buatPengirimMemori();
  const email = { terkirim: memori.terkirim, kirim: jest.fn((p: PesanEmail) => memori.kirim(p)) };
  const deps = {
    rahasiaCron: o.rahasia ?? 'rahasia-cron',
    kandidat: jest.fn(async () => o.kandidat ?? [{ userId: 'a', zona: 'Asia/Jakarta' }]),
    klaim: jest.fn(o.klaim ?? (async (userId: string) => `log-${userId}`)),
    data: jest.fn(o.data ?? (async () => DATA)),
    penerima: jest.fn(async (userId: string) => PENERIMA[userId] ?? []),
    selesai: jest.fn(async () => {}),
    email,
    tandatangan: ttd,
    urlVerify: 'https://proj.supabase.co/functions/v1/report-verify',
    sekarang: () => new Date(o.sekarang ?? '2026-12-01T01:30:00Z'),
    log: jest.fn(),
  };
  return { handler: buatHandlerBulanan(deps as DepsBulanan), deps, email };
}

const req = (rahasia: string | null = 'rahasia-cron') =>
  new Request('http://localhost/report-monthly', {
    method: 'POST',
    headers: rahasia === null ? {} : { 'x-cron-secret': rahasia },
    body: '{}',
  });

describe('waktu lokal', () => {
  it('jam dan tanggal di zona; zona tidak valid → Asia/Jakarta', () => {
    const t = new Date('2026-12-01T00:30:00Z');
    expect(waktuLokal(t, 'Asia/Jakarta')).toEqual({ tanggal: '2026-12-01', jam: 7 });
    expect(waktuLokal(t, 'Bukan/Zona')).toEqual({ tanggal: '2026-12-01', jam: 7 });
    expect(waktuLokal(t, 'Asia/Jayapura')).toEqual({ tanggal: '2026-12-01', jam: 9 });
    expect(waktuLokal(new Date('2026-11-30T17:00:00Z'), 'Asia/Jakarta')).toEqual({ tanggal: '2026-12-01', jam: 0 });
  });

  it('waktunyaKirim: tgl 1 ≥ 08.00, tgl 2–7 kapan saja, tgl 8 tidak', () => {
    expect(waktunyaKirim({ tanggal: '2026-12-01', jam: 7 })).toBe(false);
    expect(waktunyaKirim({ tanggal: '2026-12-01', jam: 8 })).toBe(true);
    expect(waktunyaKirim({ tanggal: '2026-12-02', jam: 0 })).toBe(true);
    expect(waktunyaKirim({ tanggal: '2026-12-07', jam: 23 })).toBe(true);
    expect(waktunyaKirim({ tanggal: '2026-12-08', jam: 10 })).toBe(false);
    expect(waktunyaKirim({ tanggal: '2026-11-30', jam: 10 })).toBe(false);
  });
});

describe('report-monthly', () => {
  it('rahasia salah / tidak ada → 401 tanpa membaca kandidat', async () => {
    const { handler, deps } = siapkan();
    expect((await handler(req('salah'))).status).toBe(401);
    expect((await handler(req(null))).status).toBe(401);
    expect(deps.kandidat).not.toHaveBeenCalled();
  });

  it('rahasia kosong di server → 401 walau header kosong', async () => {
    const { handler, deps } = siapkan({ rahasia: '' });
    expect((await handler(req(''))).status).toBe(401);
    expect(deps.kandidat).not.toHaveBeenCalled();
  });

  it('2026-12-01 07.30 WIB → dilewati', async () => {
    const { handler, deps, email } = siapkan({ sekarang: '2026-12-01T00:30:00Z' });
    const res = await handler(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ diproses: 1, terkirim: 0, dilewati: 1, gagal: 0 });
    expect(deps.klaim).not.toHaveBeenCalled();
    expect(email.kirim).not.toHaveBeenCalled();
  });

  it('2026-12-01 08.30 WIB → laporan 2026-11 ke penerima terverifikasi saja', async () => {
    const { handler, deps, email } = siapkan({ sekarang: '2026-12-01T01:30:00Z' });
    const res = await handler(req());
    expect(await res.json()).toEqual({ diproses: 1, terkirim: 1, dilewati: 0, gagal: 0 });
    expect(deps.klaim).toHaveBeenCalledWith('a', '2026-11');
    expect(email.terkirim.map((p) => p.ke)).toEqual(['ibu@example.com']);
    expect(email.terkirim[0].subjek).toBe('Laporan keuangan November 2026 · Rafli');
    expect(email.terkirim[0].teks).toContain('2026-11-30');
    expect(email.terkirim[0].header?.['List-Unsubscribe']).toContain('report-verify?t=henti.ra1.');
    expect(deps.selesai).toHaveBeenCalledWith('log-a', 'terkirim', 1);
  });

  it('Januari → laporan Desember tahun lalu', async () => {
    const { handler, deps } = siapkan({ sekarang: '2027-01-03T03:00:00Z' });
    await handler(req());
    expect(deps.klaim).toHaveBeenCalledWith('a', '2026-12');
  });

  it('2026-12-09 → dilewati', async () => {
    const { handler, deps } = siapkan({ sekarang: '2026-12-09T03:00:00Z' });
    expect(await (await handler(req())).json()).toEqual({ diproses: 1, terkirim: 0, dilewati: 1, gagal: 0 });
    expect(deps.klaim).not.toHaveBeenCalled();
  });

  it('klaim null (sudah dikirim) → tidak ada email', async () => {
    const { handler, deps, email } = siapkan({ klaim: async () => null });
    expect(await (await handler(req())).json()).toEqual({ diproses: 1, terkirim: 0, dilewati: 1, gagal: 0 });
    expect(email.kirim).not.toHaveBeenCalled();
    expect(deps.data).not.toHaveBeenCalled();
    expect(deps.selesai).not.toHaveBeenCalled();
  });

  it('dua eksekusi berurutan: klaim kedua null → satu email saja', async () => {
    const diklaim = new Set<string>();
    const { handler, email } = siapkan({
      klaim: async (u, b) => {
        const k = `${u}:${b}`;
        if (diklaim.has(k)) return null;
        diklaim.add(k);
        return `log-${u}`;
      },
    });
    await Promise.all([handler(req()), handler(req())]);
    expect(email.terkirim).toHaveLength(1);
  });

  it('tanpa penerima terverifikasi → dilewati tanpa klaim', async () => {
    const { handler, deps } = siapkan({ kandidat: [{ userId: 'c', zona: 'Asia/Jakarta' }] });
    expect(await (await handler(req())).json()).toEqual({ diproses: 1, terkirim: 0, dilewati: 1, gagal: 0 });
    expect(deps.klaim).not.toHaveBeenCalled();
  });

  it('galat data pengguna A tidak menghentikan pengguna B', async () => {
    const { handler, deps, email } = siapkan({
      kandidat: [
        { userId: 'a', zona: 'Asia/Jakarta' },
        { userId: 'b', zona: 'Asia/Jakarta' },
      ],
      data: async (u) => {
        if (u === 'a') throw new Error('db');
        return DATA;
      },
    });
    expect(await (await handler(req())).json()).toEqual({ diproses: 2, terkirim: 1, dilewati: 0, gagal: 1 });
    expect(email.terkirim.map((p) => p.ke)).toEqual(['ayah@example.com']);
    expect(deps.selesai).toHaveBeenCalledWith('log-a', 'gagal', 0);
    expect(deps.selesai).toHaveBeenCalledWith('log-b', 'terkirim', 1);
  });

  it('klaim melempar untuk A → B tetap diproses', async () => {
    const { handler, email } = siapkan({
      kandidat: [
        { userId: 'a', zona: 'Asia/Jakarta' },
        { userId: 'b', zona: 'Asia/Jakarta' },
      ],
      klaim: async (u) => {
        if (u === 'a') throw new Error('db');
        return `log-${u}`;
      },
    });
    expect(await (await handler(req())).json()).toEqual({ diproses: 2, terkirim: 1, dilewati: 0, gagal: 1 });
    expect(email.terkirim).toHaveLength(1);
  });

  it('zona per pengguna: Jayapura sudah 08.00, Jakarta belum', async () => {
    const { handler, deps } = siapkan({
      sekarang: '2026-11-30T23:30:00Z', // 06.30 WIB, 08.30 WIT tanggal 1
      kandidat: [
        { userId: 'a', zona: 'Asia/Jakarta' },
        { userId: 'b', zona: 'Asia/Jayapura' },
      ],
    });
    expect(await (await handler(req())).json()).toEqual({ diproses: 2, terkirim: 1, dilewati: 1, gagal: 0 });
    expect(deps.klaim).toHaveBeenCalledTimes(1);
    expect(deps.klaim).toHaveBeenCalledWith('b', '2026-11');
  });

  it('kandidat galat → 500', async () => {
    const { handler, deps } = siapkan();
    deps.kandidat.mockRejectedValueOnce(new Error('db'));
    expect((await handler(req())).status).toBe(500);
  });

  it('log hanya jumlah', async () => {
    const { handler, deps } = siapkan();
    await handler(req());
    const semua = deps.log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(semua).not.toContain('@');
    expect(semua).toContain('terkirim=1');
  });
});
