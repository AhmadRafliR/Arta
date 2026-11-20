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
    if (dari.length === 0) return { abaikan: 'transfer tanpa pengguna asal berUUID' };
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

    const hasil = tafsirkanEvent(body, deps.sekarang(), deps.entitlement ?? 'pro');
    if ('abaikan' in hasil) {
      const tipe = adalahObjek(body) && adalahObjek(body.event) ? String(body.event.type).slice(0, 40) : '?';
      console.log(`revenuecat-webhook: abaikan ${tipe}: ${hasil.abaikan}`);
      return json(200, { diterapkan: 0, diabaikan: hasil.abaikan });
    }

    try {
      let n = 0;
      for (const p of hasil) {
        if (await deps.terapkan(p)) n++;
      }
      return json(200, { diterapkan: n });
    } catch {
      console.error('revenuecat-webhook: gagal menerapkan event');
      return json(500, { error: 'Gagal menerapkan event' });
    }
  };
}
