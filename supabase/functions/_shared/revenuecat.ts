// Logika murni webhook RevenueCat (tanpa API Deno/Node; dites di Jest).
// Penyambung Deno ada di ../revenuecat-webhook/index.ts.

export type Perubahan = {
  userId: string;
  pro: boolean;
  berlakuSampai: string | null;
  produk: string | null;
  periode: 'normal' | 'trial' | 'intro' | null;
  akanDiperpanjang: boolean | null;
  eventMs: number;
  sumber: 'revenuecat' | 'revenuecat_sandbox';
};

export type Abaikan = { abaikan: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TIDAK_DIPERPANJANG = new Set(['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE', 'SUBSCRIPTION_PAUSED']);
const DIPERPANJANG = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
  'REFUND_REVERSED',
]);
const DIKENAL = new Set([
  ...TIDAK_DIPERPANJANG,
  ...DIPERPANJANG,
  'NON_RENEWING_PURCHASE',
  'TRANSFER',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);

function adalahObjek(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function daftarString(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function angka(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function isoDariMs(ms: number): string | null {
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function tafsirkanEvent(
  body: unknown,
  sekarangMs: number,
  entitlement = 'pro',
): Perubahan[] | Abaikan {
  if (!adalahObjek(body) || !adalahObjek(body.event)) return { abaikan: 'bentuk event tidak valid' };
  const e = body.event;
  const tipe = typeof e.type === 'string' ? e.type : '';
  if (tipe === 'TEST') return { abaikan: 'event TEST' };
  if (!DIKENAL.has(tipe)) return { abaikan: `tipe event tidak dikenal: ${tipe.slice(0, 40)}` };

  const eventMs = angka(e.event_timestamp_ms);
  if (eventMs === null) return { abaikan: 'event_timestamp_ms tidak valid' };

  // Hanya event untuk entitlement yang dimaksud. Bila daftar tidak ada, anggap berlaku.
  if (Array.isArray(e.entitlement_ids) && !daftarString(e.entitlement_ids).includes(entitlement)) {
    return { abaikan: 'bukan entitlement yang dimaksud' };
  }

  const sumber = e.environment === 'SANDBOX' ? 'revenuecat_sandbox' : 'revenuecat';

  if (tipe === 'TRANSFER') {
    const dari = [...new Set(daftarString(e.transferred_from).filter((x) => UUID.test(x)))];
    // Pengguna tujuan diperbarui handler lewat API RevenueCat (lihat tujuanTransfer), jadi transfer dari
    // pengguna anonim ke pengguna berUUID tetap diproses.
    if (dari.length === 0 && tujuanTransfer(body).length === 0) return { abaikan: 'transfer tanpa pengguna berUUID' };
    return dari.map((userId) => ({
      userId: userId.toLowerCase(),
      pro: false,
      berlakuSampai: null,
      produk: null,
      periode: null,
      akanDiperpanjang: false,
      eventMs,
      sumber,
    }));
  }

  const kandidat = [
    ...(typeof e.app_user_id === 'string' ? [e.app_user_id] : []),
    ...(typeof e.original_app_user_id === 'string' ? [e.original_app_user_id] : []),
    ...daftarString(e.aliases),
  ];
  const userId = kandidat.find((x) => UUID.test(x));
  if (!userId) return { abaikan: 'tanpa app_user_id berUUID (anonim)' };

  const kedaluwarsaMs = angka(e.expiration_at_ms);
  const pro = tipe !== 'EXPIRATION' && (kedaluwarsaMs === null || kedaluwarsaMs > sekarangMs);

  const periode = e.period_type === 'TRIAL' ? 'trial' : e.period_type === 'INTRO' ? 'intro' : 'normal';
  const akanDiperpanjang = TIDAK_DIPERPANJANG.has(tipe) ? false : DIPERPANJANG.has(tipe) ? true : null;

  return [
    {
      userId: userId.toLowerCase(),
      pro,
      berlakuSampai: kedaluwarsaMs === null ? null : isoDariMs(kedaluwarsaMs),
      produk: typeof e.product_id === 'string' && e.product_id ? e.product_id : null,
      periode,
      akanDiperpanjang,
      eventMs,
      sumber,
    },
  ];
}

/**
 * Pengguna tujuan TRANSFER (berUUID, huruf kecil). Event TRANSFER tidak membawa masa berlaku, jadi status
 * mereka dibaca dari API RevenueCat. Contoh: pulihkan pembelian di akun arta lain (akun baru setelah hapus akun).
 */
export function tujuanTransfer(body: unknown): string[] {
  if (!adalahObjek(body) || !adalahObjek(body.event) || body.event.type !== 'TRANSFER') return [];
  const ke = daftarString(body.event.transferred_to).filter((x) => UUID.test(x));
  return [...new Set(ke.map((x) => x.toLowerCase()))];
}

function msDariIso(v: unknown): number | null {
  if (typeof v !== 'string' || !v) return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Status entitlement dari respons GET /v1/subscribers/{id} RevenueCat (keadaan terkini, sumber kebenaran).
 * `eventMs` memakai waktu permintaan API bila lebih baru, sehingga event lama yang datang belakangan diabaikan RPC.
 */
export function tafsirkanPelanggan(
  json: unknown,
  userId: string,
  opsi: { entitlement: string; sekarangMs: number; eventMs: number },
): Perubahan | Abaikan {
  if (!adalahObjek(json) || !adalahObjek(json.subscriber)) return { abaikan: 'respons pelanggan tidak valid' };
  const s = json.subscriber;
  const eventMs = Math.max(opsi.eventMs, angka(json.request_date_ms) ?? 0);
  const ent = adalahObjek(s.entitlements) ? s.entitlements[opsi.entitlement] : undefined;
  if (!adalahObjek(ent)) {
    return {
      userId,
      pro: false,
      berlakuSampai: null,
      produk: null,
      periode: null,
      akanDiperpanjang: false,
      eventMs,
      sumber: 'revenuecat',
    };
  }

  // expires_date null = seumur hidup. Selain itu harus tanggal valid; masa tenggang (grace) ikut dihitung.
  let kedaluwarsaMs: number | null = null;
  if (ent.expires_date !== null) {
    const habis = msDariIso(ent.expires_date);
    if (habis === null) return { abaikan: 'expires_date entitlement tidak valid' };
    kedaluwarsaMs = Math.max(habis, msDariIso(ent.grace_period_expires_date) ?? 0);
  }

  const idProduk = typeof ent.product_identifier === 'string' && ent.product_identifier ? ent.product_identifier : null;
  const langganan = adalahObjek(s.subscriptions) ? s.subscriptions : {};
  const sub = idProduk
    ? (langganan[idProduk] ?? (idProduk.includes(':') ? langganan[idProduk.split(':')[0]] : undefined))
    : undefined;
  const subObj = adalahObjek(sub) ? sub : null;
  const rencana =
    typeof ent.product_plan_identifier === 'string' && ent.product_plan_identifier
      ? ent.product_plan_identifier
      : typeof subObj?.product_plan_identifier === 'string' && subObj.product_plan_identifier
        ? subObj.product_plan_identifier
        : null;
  const produk = idProduk && rencana && !idProduk.includes(':') ? `${idProduk}:${rencana}` : idProduk;
  const tipePeriode = String(subObj?.period_type ?? '').toLowerCase();

  return {
    userId,
    pro: kedaluwarsaMs === null || kedaluwarsaMs > opsi.sekarangMs,
    berlakuSampai: kedaluwarsaMs === null ? null : isoDariMs(kedaluwarsaMs),
    produk,
    periode: tipePeriode === 'trial' ? 'trial' : tipePeriode === 'intro' ? 'intro' : subObj ? 'normal' : null,
    akanDiperpanjang: subObj
      ? subObj.unsubscribe_detected_at == null && subObj.billing_issues_detected_at == null
      : null,
    eventMs,
    sumber: subObj?.is_sandbox === true ? 'revenuecat_sandbox' : 'revenuecat',
  };
}

// Perbandingan waktu-konstan: seluruh byte selalu dibandingkan, tanpa return lebih awal.
export function samaWaktuKonstan(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  const n = Math.max(x.length, y.length);
  let selisih = x.length ^ y.length;
  for (let i = 0; i < n; i++) {
    selisih |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return selisih === 0;
}

export type DepsWebhook = {
  rahasia: string;
  terapkan(p: Perubahan): Promise<boolean>;
  sekarang(): number;
  entitlement?: string;
  /** GET /v1/subscribers/{id} RevenueCat (butuh REVENUECAT_SECRET_KEY). Tanpa ini tujuan TRANSFER dilewati. */
  ambilPelanggan?(userId: string): Promise<unknown>;
};

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function buatHandlerWebhook(deps: DepsWebhook): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method !== 'POST') return json(405, { error: 'Metode tidak diizinkan' });

    const header = req.headers.get('Authorization') ?? '';
    const cocok = samaWaktuKonstan(header, `Bearer ${deps.rahasia}`);
    if (deps.rahasia === '' || !cocok) return json(401, { error: 'Tidak diizinkan' });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'JSON tidak valid' });
    }

    const entitlement = deps.entitlement ?? 'pro';
    const sekarangMs = deps.sekarang();
    const hasil = tafsirkanEvent(body, sekarangMs, entitlement);
    if ('abaikan' in hasil) {
      const tipe = adalahObjek(body) && adalahObjek(body.event) ? String(body.event.type).slice(0, 40) : '?';
      console.log(`revenuecat-webhook: abaikan ${tipe}: ${hasil.abaikan}`);
      return json(200, { diterapkan: 0, diabaikan: hasil.abaikan });
    }

    try {
      const perubahan = [...hasil];
      const tujuan = tujuanTransfer(body);
      if (tujuan.length > 0 && !deps.ambilPelanggan) {
        console.warn('revenuecat-webhook: TRANSFER tanpa REVENUECAT_SECRET_KEY, pengguna tujuan tidak diperbarui');
      }
      if (tujuan.length > 0 && deps.ambilPelanggan) {
        const e = (body as { event: Record<string, unknown> }).event;
        const eventMs = angka(e.event_timestamp_ms) ?? sekarangMs;
        for (const userId of tujuan) {
          // Galat API dilempar: balas 500 agar RevenueCat mengirim ulang webhook.
          const p = tafsirkanPelanggan(await deps.ambilPelanggan(userId), userId, { entitlement, sekarangMs, eventMs });
          if ('abaikan' in p) console.log(`revenuecat-webhook: tujuan TRANSFER dilewati: ${p.abaikan}`);
          else perubahan.push(p);
        }
      }

      let n = 0;
      for (const p of perubahan) {
        if (await deps.terapkan(p)) n++;
      }
      return json(200, { diterapkan: n });
    } catch {
      console.error('revenuecat-webhook: gagal menerapkan event');
      return json(500, { error: 'Gagal menerapkan event' });
    }
  };
}
