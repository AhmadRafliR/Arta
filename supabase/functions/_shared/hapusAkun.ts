// Handler Edge Function `delete-account`: hanya API web standar (tanpa Deno/Node), dependensi disuntikkan
// agar bisa dites di Jest. Penyambung Deno ada di ../delete-account/index.ts.

export type DepsHapusAkun = {
  /** Id pengguna dari token, atau null bila token tidak valid/kedaluwarsa. */
  pengguna(token: string): Promise<string | null>;
  /** Hapus data pelanggan di RevenueCat (kegagalan tidak menghalangi hapus akun). */
  hapusRevenueCat(userId: string): Promise<void>;
  /** auth.admin.deleteUser: semua tabel pengguna ikut terhapus lewat FK on delete cascade. */
  hapusPengguna(userId: string): Promise<void>;
  /** sisa_data_pengguna: tabel yang masih punya baris milik pengguna (harusnya kosong). */
  sisaData(userId: string): Promise<{ tabel: string; jumlah: number }[]>;
};

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PESAN = {
  unauthorized: 'Sesi habis, masuk lagi.',
  konfirmasi: 'Ketik HAPUS untuk konfirmasi.',
  gagal: 'Akun belum terhapus, coba lagi.',
} as const;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });

const galat = (status: number, kode: 'unauthorized' | 'bad_request' | 'server', pesan: string) =>
  json(status, { galat: kode, pesan });

function tokenDari(req: Request): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get('authorization') ?? '');
  return m ? m[1] : null;
}

// Catat tahap saja: jangan pernah mencetak token, email, atau isi data pengguna.
const catat = (tahap: string) => console.error(`delete-account: gagal di tahap ${tahap}`);

export function buatHandlerHapusAkun(deps: DepsHapusAkun): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS });
    if (req.method !== 'POST') return galat(400, 'bad_request', PESAN.konfirmasi);

    const token = tokenDari(req);
    if (!token) return galat(401, 'unauthorized', PESAN.unauthorized);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return galat(400, 'bad_request', PESAN.konfirmasi);
    }
    const konfirmasi =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>).konfirmasi
        : undefined;
    if (konfirmasi !== 'HAPUS') return galat(400, 'bad_request', PESAN.konfirmasi);

    let userId: string | null;
    try {
      userId = await deps.pengguna(token);
    } catch {
      userId = null;
    }
    if (!userId) return galat(401, 'unauthorized', PESAN.unauthorized);

    try {
      await deps.hapusRevenueCat(userId);
    } catch {
      catat('revenuecat'); // dicatat saja: akun tetap dihapus
    }

    try {
      await deps.hapusPengguna(userId);
    } catch {
      catat('hapus_pengguna');
      return galat(500, 'server', PESAN.gagal);
    }

    // Akun auth sudah hilang; sisa data hanya dilaporkan (nama tabel saja) untuk ditindaklanjuti.
    try {
      const sisa = await deps.sisaData(userId);
      if (sisa.length > 0) {
        console.error(`delete-account: sisa data di tabel ${sisa.map((s) => s.tabel).join(', ')}`);
      }
    } catch {
      catat('sisa_data');
    }

    return json(200, { terhapus: true });
  };
}
