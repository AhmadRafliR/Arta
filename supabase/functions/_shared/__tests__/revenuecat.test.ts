import {
  buatHandlerWebhook,
  samaWaktuKonstan,
  tafsirkanEvent,
  tafsirkanPelanggan,
  tujuanTransfer,
  type Perubahan,
} from '../revenuecat';

const U1 = '0b9c1f3e-5a2d-4c7e-9a10-1d2e3f4a5b6c';
const U2 = '7e6d5c4b-3a29-4187-8654-0f1e2d3c4b5a';
const SEKARANG = 1_800_000_000_000;
const MASA_DEPAN = SEKARANG + 30 * 86_400_000;
const LAMPAU = SEKARANG - 86_400_000;

function ev(over: Record<string, unknown> = {}) {
  return {
    api_version: '1.0',
    event: {
      type: 'INITIAL_PURCHASE',
      id: 'evt-1',
      app_user_id: U1,
      original_app_user_id: U1,
      product_id: 'arta_pro:bulanan',
      period_type: 'NORMAL',
      expiration_at_ms: MASA_DEPAN,
      event_timestamp_ms: SEKARANG,
      environment: 'PRODUCTION',
      entitlement_ids: ['pro'],
      ...over,
    },
  };
}

function satu(body: unknown): Perubahan {
  const h = tafsirkanEvent(body, SEKARANG);
  if (!Array.isArray(h)) throw new Error(`diabaikan: ${h.abaikan}`);
  expect(h).toHaveLength(1);
  return h[0];
}

describe('tafsirkanEvent', () => {
  it('INITIAL_PURCHASE trial -> pro, periode trial', () => {
    const p = satu(ev({ period_type: 'TRIAL' }));
    expect(p).toMatchObject({
      userId: U1,
      pro: true,
      periode: 'trial',
      akanDiperpanjang: true,
      produk: 'arta_pro:bulanan',
      eventMs: SEKARANG,
      sumber: 'revenuecat',
      berlakuSampai: new Date(MASA_DEPAN).toISOString(),
    });
  });

  it('RENEWAL -> pro, normal', () => {
    expect(satu(ev({ type: 'RENEWAL' }))).toMatchObject({ pro: true, periode: 'normal', akanDiperpanjang: true });
  });

  it('INTRO -> intro; PROMOTIONAL/PREPAID -> normal', () => {
    expect(satu(ev({ period_type: 'INTRO' })).periode).toBe('intro');
    expect(satu(ev({ period_type: 'PROMOTIONAL' })).periode).toBe('normal');
    expect(satu(ev({ period_type: 'PREPAID' })).periode).toBe('normal');
  });

  it('CANCELLATION dengan kedaluwarsa masa depan -> tetap pro, tidak diperpanjang', () => {
    expect(satu(ev({ type: 'CANCELLATION' }))).toMatchObject({ pro: true, akanDiperpanjang: false });
  });

  it('CANCELLATION refund (kedaluwarsa lampau) -> bukan pro', () => {
    expect(
      satu(ev({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT', expiration_at_ms: LAMPAU })),
    ).toMatchObject({ pro: false, akanDiperpanjang: false });
  });

  it('EXPIRATION -> bukan pro, walau kedaluwarsa tampak di masa depan', () => {
    expect(satu(ev({ type: 'EXPIRATION' })).pro).toBe(false);
    expect(satu(ev({ type: 'EXPIRATION', expiration_at_ms: LAMPAU }))).toMatchObject({
      pro: false,
      akanDiperpanjang: false,
    });
  });

  it('BILLING_ISSUE dan SUBSCRIPTION_PAUSED -> pro sampai kedaluwarsa, tidak diperpanjang', () => {
    expect(satu(ev({ type: 'BILLING_ISSUE' }))).toMatchObject({ pro: true, akanDiperpanjang: false });
    expect(satu(ev({ type: 'SUBSCRIPTION_PAUSED' }))).toMatchObject({ pro: true, akanDiperpanjang: false });
  });

  it('akanDiperpanjang true untuk UNCANCELLATION/PRODUCT_CHANGE/SUBSCRIPTION_EXTENDED/REFUND_REVERSED', () => {
    for (const type of ['UNCANCELLATION', 'PRODUCT_CHANGE', 'SUBSCRIPTION_EXTENDED', 'REFUND_REVERSED']) {
      expect(satu(ev({ type })).akanDiperpanjang).toBe(true);
    }
  });

  it('NON_RENEWING_PURCHASE -> akanDiperpanjang null; tanpa kedaluwarsa -> pro tanpa batas', () => {
    expect(satu(ev({ type: 'NON_RENEWING_PURCHASE', expiration_at_ms: null }))).toMatchObject({
      pro: true,
      berlakuSampai: null,
      akanDiperpanjang: null,
    });
  });

  it('TEST -> diabaikan', () => {
    expect(tafsirkanEvent(ev({ type: 'TEST' }), SEKARANG)).toEqual({ abaikan: expect.any(String) });
  });

  it('tipe tidak dikenal dan bentuk rusak -> diabaikan', () => {
    expect(tafsirkanEvent(ev({ type: 'NANTI_ADA' }), SEKARANG)).toHaveProperty('abaikan');
    expect(tafsirkanEvent(null, SEKARANG)).toHaveProperty('abaikan');
    expect(tafsirkanEvent({ event: 'x' }, SEKARANG)).toHaveProperty('abaikan');
    expect(tafsirkanEvent(ev({ event_timestamp_ms: 'x' }), SEKARANG)).toHaveProperty('abaikan');
  });

  it('app_user_id anonim dengan alias UUID -> pakai alias', () => {
    const p = satu(
      ev({ app_user_id: '$RCAnonymousID:abc123', original_app_user_id: '$RCAnonymousID:abc123', aliases: ['$RCAnonymousID:abc123', U2] }),
    );
    expect(p.userId).toBe(U2);
  });

  it('tanpa UUID sama sekali -> diabaikan', () => {
    const h = tafsirkanEvent(
      ev({ app_user_id: '$RCAnonymousID:abc', original_app_user_id: '$RCAnonymousID:abc', aliases: ['$RCAnonymousID:abc'] }),
      SEKARANG,
    );
    expect(h).toHaveProperty('abaikan');
  });

  it('entitlement_ids tanpa pro -> diabaikan; tanpa daftar -> tetap diproses', () => {
    expect(tafsirkanEvent(ev({ entitlement_ids: ['lain'] }), SEKARANG)).toHaveProperty('abaikan');
    expect(tafsirkanEvent(ev({ entitlement_ids: [] }), SEKARANG)).toHaveProperty('abaikan');
    expect(satu(ev({ entitlement_ids: undefined })).pro).toBe(true);
    expect(satu(ev({ entitlement_ids: null })).pro).toBe(true);
  });

  it('nama entitlement bisa diatur', () => {
    const h = tafsirkanEvent(ev({ entitlement_ids: ['premium'] }), SEKARANG, 'premium');
    expect(Array.isArray(h)).toBe(true);
  });

  it('TRANSFER -> cabut Pro dari semua transferred_from berUUID', () => {
    const h = tafsirkanEvent(
      ev({ type: 'TRANSFER', transferred_from: [U1, '$RCAnonymousID:x'], transferred_to: [U2] }),
      SEKARANG,
    );
    expect(h).toEqual([
      expect.objectContaining({ userId: U1, pro: false, berlakuSampai: null, akanDiperpanjang: false, eventMs: SEKARANG }),
    ]);
  });

  it('TRANSFER tanpa asal berUUID -> diabaikan', () => {
    expect(
      tafsirkanEvent(ev({ type: 'TRANSFER', transferred_from: ['$RCAnonymousID:x'] }), SEKARANG),
    ).toHaveProperty('abaikan');
  });

  it('environment SANDBOX -> sumber sandbox', () => {
    expect(satu(ev({ environment: 'SANDBOX' })).sumber).toBe('revenuecat_sandbox');
  });
});

describe('samaWaktuKonstan', () => {
  it('benar hanya untuk string identik, termasuk beda panjang', () => {
    expect(samaWaktuKonstan('abc', 'abc')).toBe(true);
    expect(samaWaktuKonstan('abc', 'abd')).toBe(false);
    expect(samaWaktuKonstan('abc', 'abcd')).toBe(false);
    expect(samaWaktuKonstan('', 'a')).toBe(false);
    expect(samaWaktuKonstan('', '')).toBe(true);
  });
});

describe('buatHandlerWebhook', () => {
  const RAHASIA = 'rahasia-uji';

  function siapkan(over: { rahasia?: string; terapkan?: jest.Mock } = {}) {
    const terapkan = over.terapkan ?? jest.fn(async () => true);
    const handler = buatHandlerWebhook({
      rahasia: over.rahasia ?? RAHASIA,
      terapkan,
      sekarang: () => SEKARANG,
    });
    return { terapkan, handler };
  }

  function req(opsi: { metode?: string; auth?: string | null; body?: unknown; mentah?: string } = {}) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const auth = opsi.auth === undefined ? `Bearer ${RAHASIA}` : opsi.auth;
    if (auth !== null) headers.Authorization = auth;
    const metode = opsi.metode ?? 'POST';
    return new Request('http://localhost/revenuecat-webhook', {
      method: metode,
      headers,
      body: metode === 'GET' ? undefined : (opsi.mentah ?? JSON.stringify(opsi.body ?? ev())),
    });
  }

  it('200 dan menerapkan perubahan', async () => {
    const { handler, terapkan } = siapkan();
    const res = await handler(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ diterapkan: 1 });
    expect(terapkan).toHaveBeenCalledTimes(1);
    expect(terapkan.mock.calls[0][0]).toMatchObject({ userId: U1, pro: true });
  });

  it('diterapkan 0 bila RPC menolak event lama (false)', async () => {
    const { handler } = siapkan({ terapkan: jest.fn(async () => false) });
    const res = await handler(req());
    expect(await res.json()).toEqual({ diterapkan: 0 });
  });

  it('405 bila bukan POST', async () => {
    const { handler, terapkan } = siapkan();
    const res = await handler(req({ metode: 'GET' }));
    expect(res.status).toBe(405);
    expect(terapkan).not.toHaveBeenCalled();
  });

  it('401 bila secret salah, hilang, atau skema bukan Bearer; terapkan tidak dipanggil', async () => {
    const { handler, terapkan } = siapkan();
    for (const auth of ['Bearer salah', null, RAHASIA, `bearer ${RAHASIA}`, `Bearer ${RAHASIA}x`]) {
      const res = await handler(req({ auth }));
      expect(res.status).toBe(401);
    }
    expect(terapkan).not.toHaveBeenCalled();
  });

  it('secret kosong di env -> selalu 401, bahkan dengan header "Bearer "', async () => {
    const { handler, terapkan } = siapkan({ rahasia: '' });
    expect((await handler(req({ auth: 'Bearer ' }))).status).toBe(401);
    expect((await handler(req({ auth: '' }))).status).toBe(401);
    expect((await handler(req({ auth: null }))).status).toBe(401);
    expect(terapkan).not.toHaveBeenCalled();
  });

  it('400 bila JSON rusak', async () => {
    const { handler, terapkan } = siapkan();
    const res = await handler(req({ mentah: '{rusak' }));
    expect(res.status).toBe(400);
    expect(terapkan).not.toHaveBeenCalled();
  });

  it('200 dengan alasan bila event diabaikan', async () => {
    const { handler, terapkan } = siapkan();
    const res = await handler(req({ body: ev({ type: 'TEST' }) }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.diterapkan).toBe(0);
    expect(typeof j.diabaikan).toBe('string');
    expect(terapkan).not.toHaveBeenCalled();
  });

  it('500 bila terapkan melempar (agar RevenueCat mencoba ulang)', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { handler } = siapkan({ terapkan: jest.fn(async () => { throw new Error('db down'); }) });
    const res = await handler(req());
    expect(res.status).toBe(500);
    // Tidak membocorkan isi galat maupun body.
    expect(JSON.stringify(spy.mock.calls)).not.toContain(U1);
    spy.mockRestore();
  });

  it('tidak mencatat isi body saat event diabaikan', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const { handler } = siapkan();
    await handler(req({ body: ev({ type: 'TEST' }) }));
    expect(JSON.stringify(spy.mock.calls)).not.toContain(U1);
    spy.mockRestore();
  });
});

describe('TRANSFER ke pengguna lain (pulihkan pembelian di akun arta lain)', () => {
  const RAHASIA = 'rahasia-uji';
  const transfer = (over: Record<string, unknown> = {}) =>
    ev({ type: 'TRANSFER', transferred_from: [U1], transferred_to: [U2.toUpperCase()], ...over });

  function pelanggan(ent: Record<string, unknown> | null, sub: Record<string, unknown> = {}) {
    return {
      request_date_ms: SEKARANG + 5_000,
      subscriber: {
        entitlements: ent ? { pro: ent } : {},
        subscriptions: {
          arta_pro: {
            period_type: 'normal',
            unsubscribe_detected_at: null,
            billing_issues_detected_at: null,
            is_sandbox: false,
            product_plan_identifier: 'bulanan',
            ...sub,
          },
        },
      },
    };
  }
  const aktif = { expires_date: new Date(MASA_DEPAN).toISOString(), product_identifier: 'arta_pro' };
  const opsi = { entitlement: 'pro', sekarangMs: SEKARANG, eventMs: SEKARANG };

  it('tujuanTransfer: UUID unik huruf kecil, hanya untuk TRANSFER', () => {
    expect(tujuanTransfer(transfer({ transferred_to: [U2, U2.toUpperCase(), '$RCAnonymousID:y'] }))).toEqual([U2]);
    expect(tujuanTransfer(ev())).toEqual([]);
    expect(tujuanTransfer(null)).toEqual([]);
  });

  it('transfer dari pengguna anonim ke UUID tidak diabaikan', () => {
    expect(tafsirkanEvent(transfer({ transferred_from: ['$RCAnonymousID:x'] }), SEKARANG)).toEqual([]);
  });

  it('tafsirkanPelanggan: entitlement aktif -> pro, produk dengan base plan, waktu permintaan API', () => {
    expect(tafsirkanPelanggan(pelanggan(aktif), U2, opsi)).toEqual({
      userId: U2,
      pro: true,
      berlakuSampai: new Date(MASA_DEPAN).toISOString(),
      produk: 'arta_pro:bulanan',
      periode: 'normal',
      akanDiperpanjang: true,
      eventMs: SEKARANG + 5_000,
      sumber: 'revenuecat',
    });
  });

  it('tafsirkanPelanggan: uji coba, dibatalkan, sandbox, dan masa tenggang', () => {
    const p = tafsirkanPelanggan(
      pelanggan(
        { ...aktif, expires_date: new Date(LAMPAU).toISOString(), grace_period_expires_date: new Date(MASA_DEPAN).toISOString() },
        { period_type: 'trial', unsubscribe_detected_at: '2026-11-01T00:00:00Z', is_sandbox: true },
      ),
      U2,
      opsi,
    );
    expect(p).toMatchObject({
      pro: true,
      berlakuSampai: new Date(MASA_DEPAN).toISOString(),
      periode: 'trial',
      akanDiperpanjang: false,
      sumber: 'revenuecat_sandbox',
    });
  });

  it('tafsirkanPelanggan: tanpa entitlement -> bukan Pro; kedaluwarsa -> bukan Pro; seumur hidup -> Pro', () => {
    expect(tafsirkanPelanggan(pelanggan(null), U2, opsi)).toMatchObject({ pro: false, akanDiperpanjang: false });
    expect(
      tafsirkanPelanggan(pelanggan({ ...aktif, expires_date: new Date(LAMPAU).toISOString() }), U2, opsi),
    ).toMatchObject({ pro: false });
    expect(
      tafsirkanPelanggan({ subscriber: { entitlements: { pro: { expires_date: null, product_identifier: 'arta_seumur' } } } }, U2, opsi),
    ).toMatchObject({ pro: true, berlakuSampai: null, produk: 'arta_seumur', periode: null, akanDiperpanjang: null });
  });

  it('tafsirkanPelanggan: respons rusak atau tanggal tidak valid -> diabaikan (tidak mengubah status)', () => {
    expect(tafsirkanPelanggan({}, U2, opsi)).toHaveProperty('abaikan');
    expect(tafsirkanPelanggan(pelanggan({ ...aktif, expires_date: 'bukan-tanggal' }), U2, opsi)).toHaveProperty('abaikan');
  });

  function reqTransfer(body: unknown) {
    return new Request('http://localhost/revenuecat-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RAHASIA}` },
      body: JSON.stringify(body),
    });
  }

  it('handler: asal dicabut, tujuan dibaca dari API RevenueCat lalu diterapkan', async () => {
    const terapkan = jest.fn(async () => true);
    const ambilPelanggan = jest.fn(async () => pelanggan(aktif));
    const handler = buatHandlerWebhook({ rahasia: RAHASIA, terapkan, sekarang: () => SEKARANG, ambilPelanggan });
    const res = await handler(reqTransfer(transfer()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ diterapkan: 2 });
    expect(ambilPelanggan).toHaveBeenCalledWith(U2);
    expect(terapkan).toHaveBeenNthCalledWith(1, expect.objectContaining({ userId: U1, pro: false }));
    expect(terapkan).toHaveBeenNthCalledWith(2, expect.objectContaining({ userId: U2, pro: true }));
  });

  it('handler: API RevenueCat gagal -> 500 agar webhook dikirim ulang', async () => {
    const terapkan = jest.fn(async () => true);
    const handler = buatHandlerWebhook({
      rahasia: RAHASIA,
      terapkan,
      sekarang: () => SEKARANG,
      ambilPelanggan: jest.fn(async () => {
        throw new Error('revenuecat 503');
      }),
    });
    const galat = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect((await handler(reqTransfer(transfer()))).status).toBe(500);
    expect(terapkan).not.toHaveBeenCalled();
    galat.mockRestore();
  });

  it('handler: tanpa kunci API, hanya pengguna asal yang diperbarui (dengan peringatan)', async () => {
    const terapkan = jest.fn(async () => true);
    const peringatan = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const handler = buatHandlerWebhook({ rahasia: RAHASIA, terapkan, sekarang: () => SEKARANG });
    expect(await (await handler(reqTransfer(transfer()))).json()).toEqual({ diterapkan: 1 });
    expect(peringatan).toHaveBeenCalled();
    peringatan.mockRestore();
  });
});
