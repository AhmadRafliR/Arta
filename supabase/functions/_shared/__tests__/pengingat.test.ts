import {
  buatHandlerPengingat,
  jamLokal,
  kunciDedup,
  susunPesan,
  tanggalLokal,
  tanggalTarget,
  type DepsPengingat,
  type Penerima,
  type Tagihan,
  type TiketExpo,
} from '../pengingat';

// 2026-11-20 01:00 UTC = 08:00 WIB (Jumat) = 09:00 WITA.
const SEKARANG = new Date('2026-11-20T01:00:00Z');
const RAHASIA = 'rahasia-cron';

const P: Penerima = { userId: 'u1', tokens: ['ExponentPushToken[a]'], hariSebelum: 1, jam: 8, zona: 'Asia/Jakarta' };
const T1: Tagihan = { tagihanId: 't1', debtId: 'd1', pemberi: 'Bank ABC', jatuhTempo: '2026-11-21', nominal: 300000 };
const T2: Tagihan = { tagihanId: 't2', debtId: 'd2', pemberi: 'Budi', jatuhTempo: '2026-11-20', nominal: 1250000 };

const ok = (): TiketExpo => ({ status: 'ok', id: 'x' });

function siapkan(o: Partial<DepsPengingat> = {}) {
  const deps = {
    rahasia: RAHASIA,
    penerima: jest.fn(async () => [P]),
    tagihan: jest.fn(async (): Promise<Tagihan[] | null> => [T1]),
    sudahDikirim: jest.fn(async () => new Set<string>()),
    catatDikirim: jest.fn(async () => {}),
    kirim: jest.fn(async (pesan: unknown[]) => pesan.map(ok)),
    hapusToken: jest.fn(async () => {}),
    sekarang: () => SEKARANG,
    ...o,
  } as DepsPengingat & { [K in keyof DepsPengingat]: DepsPengingat[K] };
  return deps;
}

const panggil = (deps: DepsPengingat, auth: string | null = `Bearer ${RAHASIA}`) =>
  buatHandlerPengingat(deps)(
    new Request('https://x.test/debt-reminders', {
      method: 'POST',
      headers: auth ? { authorization: auth } : {},
    }),
  );

let logSpy: jest.SpyInstance;
let errSpy: jest.SpyInstance;
beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
});

describe('waktu lokal', () => {
  it('zona Asia/Makassar menggeser jam', () => {
    expect(jamLokal(SEKARANG, 'Asia/Jakarta')).toBe(8);
    expect(jamLokal(SEKARANG, 'Asia/Makassar')).toBe(9);
  });
  it('zona tidak valid/kosong kembali ke Asia/Jakarta', () => {
    expect(jamLokal(SEKARANG, 'Bukan/Zona')).toBe(8);
    expect(jamLokal(SEKARANG, null)).toBe(8);
    expect(tanggalLokal(SEKARANG, 'Bukan/Zona')).toBe('2026-11-20');
  });
  it('tanggalLokal menggeser hari melewati batas bulan', () => {
    expect(tanggalLokal(new Date('2026-11-30T05:00:00Z'), 'Asia/Jakarta', 1)).toBe('2026-12-01');
  });
  it('tanggalTarget = [hari ini + hariSebelum, hari ini], unik', () => {
    expect(tanggalTarget({ ...P, hariSebelum: 3 }, SEKARANG)).toEqual(['2026-11-23', '2026-11-20']);
    expect(tanggalTarget({ ...P, hariSebelum: 0 }, SEKARANG)).toEqual(['2026-11-20']);
  });
});

describe('susunPesan', () => {
  it('satu tagihan besok', () => {
    const [m] = susunPesan(P, [T1], '2026-11-20');
    expect(m.title).toBe('Tagihan Bank ABC besok');
    expect(m.body).toBe('Rp300.000 jatuh tempo Sabtu, 21 Nov.');
    expect(m).toMatchObject({ to: P.tokens[0], channelId: 'pengingat', priority: 'high', sound: 'default', data: { url: '/hutang' } });
  });
  it('hari ini dan 3 hari lagi', () => {
    expect(susunPesan(P, [T2], '2026-11-20')[0].title).toBe('Tagihan Budi hari ini');
    expect(susunPesan(P, [{ ...T1, jatuhTempo: '2026-11-23' }], '2026-11-20')[0].title).toBe('Tagihan Bank ABC 3 hari lagi');
  });
  it('beberapa tagihan digabung, satu pesan per token', () => {
    const p = { ...P, tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'] };
    const m = susunPesan(p, [T1, T2], '2026-11-20');
    expect(m).toHaveLength(2);
    expect(m[0].title).toBe('2 tagihan jatuh tempo');
    expect(m[0].body).toBe('Total Rp1.550.000. Terdekat: Budi hari ini.');
  });
  it('kunciDedup', () => {
    expect(kunciDedup(T1, '2026-11-20')).toBe('t1:2026-11-21:2026-11-20');
  });
});

describe('buatHandlerPengingat', () => {
  it('rahasia salah, hilang, atau kosong → 401 tanpa menyentuh data', async () => {
    const deps = siapkan();
    expect((await panggil(deps, 'Bearer salah')).status).toBe(401);
    expect((await panggil(deps, null)).status).toBe(401);
    const kosong = siapkan({ rahasia: '' });
    expect((await panggil(kosong, 'Bearer ')).status).toBe(401);
    expect((await panggil(kosong, 'Bearer x')).status).toBe(401);
    expect(deps.penerima).not.toHaveBeenCalled();
    expect(kosong.penerima).not.toHaveBeenCalled();
  });

  it('jam tidak cocok → tidak diproses', async () => {
    const deps = siapkan({ penerima: jest.fn(async () => [{ ...P, jam: 9 }]) });
    const body = await (await panggil(deps)).json();
    expect(body).toEqual({ diproses: 0, dikirim: 0, dilewati: 0, tokenDihapus: 0 });
    expect(deps.tagihan).not.toHaveBeenCalled();
    expect(deps.kirim).not.toHaveBeenCalled();
  });

  it('zona Asia/Makassar: jam 9 lokal cocok pada saat yang sama', async () => {
    const deps = siapkan({ penerima: jest.fn(async () => [{ ...P, jam: 9, zona: 'Asia/Makassar' }]) });
    const body = await (await panggil(deps)).json();
    expect(body.diproses).toBe(1);
    expect(body.dikirim).toBe(1);
  });

  it('H-1: tagihan besok → 1 pesan "besok", dicatat, tanggal target benar', async () => {
    const deps = siapkan();
    const res = await panggil(deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ diproses: 1, dikirim: 1, dilewati: 0, tokenDihapus: 0 });
    expect(deps.tagihan).toHaveBeenCalledWith('u1', ['2026-11-21', '2026-11-20']);
    const pesan = (deps.kirim as jest.Mock).mock.calls[0][0];
    expect(pesan).toHaveLength(1);
    expect(pesan[0].title).toContain('besok');
    expect(deps.catatDikirim).toHaveBeenCalledWith('u1', ['t1:2026-11-21:2026-11-20']);
  });

  it('dua tagihan → digabung jadi satu notifikasi', async () => {
    const deps = siapkan({ tagihan: jest.fn(async () => [T1, T2]) });
    await panggil(deps);
    const pesan = (deps.kirim as jest.Mock).mock.calls[0][0];
    expect(pesan).toHaveLength(1);
    expect(pesan[0].title).toBe('2 tagihan jatuh tempo');
    expect(deps.catatDikirim).toHaveBeenCalledWith('u1', ['t1:2026-11-21:2026-11-20', 't2:2026-11-20:2026-11-20']);
  });

  it('sudah dikirim → dilewati, tidak kirim dan tidak catat', async () => {
    const deps = siapkan({ sudahDikirim: jest.fn(async () => new Set(['t1:2026-11-21:2026-11-20'])) });
    const body = await (await panggil(deps)).json();
    expect(body).toEqual({ diproses: 1, dikirim: 0, dilewati: 1, tokenDihapus: 0 });
    expect(deps.kirim).not.toHaveBeenCalled();
    expect(deps.catatDikirim).not.toHaveBeenCalled();
  });

  it('hanya tagihan yang belum tercatat yang masuk pesan', async () => {
    const deps = siapkan({
      tagihan: jest.fn(async () => [T1, T2]),
      sudahDikirim: jest.fn(async () => new Set(['t2:2026-11-20:2026-11-20'])),
    });
    await panggil(deps);
    const pesan = (deps.kirim as jest.Mock).mock.calls[0][0];
    expect(pesan[0].title).toBe('Tagihan Bank ABC besok');
    expect(deps.catatDikirim).toHaveBeenCalledWith('u1', ['t1:2026-11-21:2026-11-20']);
  });

  it('230 pesan → 3 panggilan kirim (100+100+30)', async () => {
    const tokens = Array.from({ length: 230 }, (_, i) => `ExponentPushToken[${i}]`);
    const deps = siapkan({ penerima: jest.fn(async () => [{ ...P, tokens }]) });
    const body = await (await panggil(deps)).json();
    const kirim = deps.kirim as jest.Mock;
    expect(kirim).toHaveBeenCalledTimes(3);
    expect(kirim.mock.calls.map((c) => c[0].length)).toEqual([100, 100, 30]);
    expect(body.dikirim).toBe(230);
    expect(deps.catatDikirim).toHaveBeenCalledTimes(1);
  });

  it('DeviceNotRegistered → token dihapus; pengguna tetap dicatat bila ada tiket ok', async () => {
    const tokens = ['ExponentPushToken[hidup]', 'ExponentPushToken[mati]'];
    const deps = siapkan({
      penerima: jest.fn(async () => [{ ...P, tokens }]),
      kirim: jest.fn(async () => [
        ok(),
        { status: 'error', message: 'x', details: { error: 'DeviceNotRegistered' } } as TiketExpo,
      ]),
    });
    const body = await (await panggil(deps)).json();
    expect(deps.hapusToken).toHaveBeenCalledWith(['ExponentPushToken[mati]']);
    expect(body.tokenDihapus).toBe(1);
    expect(body.dikirim).toBe(1);
    expect(deps.catatDikirim).toHaveBeenCalledTimes(1);
  });

  it('semua tiket error → tidak dicatat terkirim', async () => {
    const deps = siapkan({
      kirim: jest.fn(async () => [{ status: 'error', message: 'x', details: { error: 'MessageRateExceeded' } } as TiketExpo]),
    });
    const body = await (await panggil(deps)).json();
    expect(body.dikirim).toBe(0);
    expect(deps.catatDikirim).not.toHaveBeenCalled();
    expect(deps.hapusToken).not.toHaveBeenCalled();
  });

  it('HTTP kirim gagal → tidak dicatat terkirim', async () => {
    const deps = siapkan({ kirim: jest.fn(async () => { throw new Error('expo 500'); }) });
    const res = await panggil(deps);
    expect(res.status).toBe(200);
    expect((await res.json()).dikirim).toBe(0);
    expect(deps.catatDikirim).not.toHaveBeenCalled();
  });

  it('kontrak tagihan belum ada (null) → 200 dengan catatan, 0 dikirim', async () => {
    const deps = siapkan({ tagihan: jest.fn(async () => null) });
    const res = await panggil(deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ dikirim: 0, catatan: 'tagihan_untuk_pengingat belum tersedia' });
    expect(deps.kirim).not.toHaveBeenCalled();
  });

  it('log tidak memuat token push atau isi pesan', async () => {
    await panggil(siapkan());
    const semua = JSON.stringify([...logSpy.mock.calls, ...errSpy.mock.calls]);
    expect(semua).not.toContain('ExponentPushToken');
    expect(semua).not.toContain('Bank ABC');
  });
});
