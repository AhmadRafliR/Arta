// Penyambung Deno untuk handler `parse-hutang`: mengisi dependensi (Supabase dengan token pengguna, Gemini).
// Logika ada di ../_shared/hutangGambar.ts (dites di Jest). File ini dikecualikan dari tsc.
import { createClient } from '@supabase/supabase-js';
import { GalatSesi, tanggalDiZona, type Kuota } from '../_shared/handler.ts';
import { buatHandlerHutangGambar, SKEMA, type DbHutang } from '../_shared/hutangGambar.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const MODEL = Deno.env.get('GEMINI_MODEL_VISION') || Deno.env.get('OPENAI_MODEL_STT') || 'gemini-2.5-flash';
const GEMINI = (Deno.env.get('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
// Membaca gambar lebih lama daripada teks (model berpikir + gambar besar): batas bawaan 60 detik.
const BATAS_MS = Number(Deno.env.get('GEMINI_VISION_TIMEOUT_MS')) || 60_000;

type GalatPostgrest = { code?: string; message?: string } | null;

// Token ditolak PostgREST (401/PGRST3xx) atau fungsi kuota tidak menemukan auth.uid().
function periksa(error: GalatPostgrest, status: number): void {
  if (!error) return;
  if (
    status === 401 ||
    (error.code ?? '').startsWith('PGRST3') ||
    (error.message ?? '').includes('Tidak terautentikasi')
  ) {
    throw new GalatSesi();
  }
  throw new Error(`db ${status} ${error.code ?? ''}`);
}

function buatDb(token: string): DbHutang {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return {
    async kuota() {
      const { data, error, status } = await sb.rpc('kuota_ai');
      periksa(error, status);
      return data as Kuota;
    },
    async pakaiKuota() {
      const { data, error, status } = await sb.rpc('pakai_kuota_ai');
      periksa(error, status);
      return data as Kuota & { ok: boolean };
    },
    async hariIni(sekarang: Date) {
      // RLS membatasi baris ke milik pengguna.
      const { data, error, status } = await sb.from('profiles').select('zona_waktu').limit(1).maybeSingle();
      periksa(error, status);
      return tanggalDiZona(sekarang, data?.zona_waktu ?? null);
    },
  };
}

function kunciGemini(): string {
  const k = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('OPENAI_STT_API_KEY') || Deno.env.get('OPENAI_API_KEY');
  if (!k) throw new Error('kunci Gemini belum diset');
  return k;
}

function base64(bytes: Uint8Array): string {
  let biner = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    biner += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(biner);
}

// Catat status HTTP dan alasan penyedia (dipotong 200 karakter); tanpa isi permintaan/gambar.
async function cekRespons(res: Response, tahap: string): Promise<void> {
  if (res.ok) return;
  let alasan = '';
  try {
    const data = JSON.parse(await res.text());
    const e = Array.isArray(data) ? data[0]?.error : data?.error;
    alasan = typeof e?.message === 'string' ? e.message.slice(0, 200) : '';
  } catch {
    // abaikan: respons bukan JSON
  }
  console.error(`parse-hutang: gemini ${tahap} status ${res.status}${alasan ? ` — ${alasan}` : ''}`);
  throw new Error(`gemini ${tahap} ${res.status}`);
}

// fetch dengan batas waktu dan catatan durasi per tahap (tanpa isi permintaan/respons).
async function ambil(tahap: string, url: string, init: RequestInit): Promise<Response> {
  const mulai = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(BATAS_MS) });
    console.error(`parse-hutang: ${tahap} http ${res.status} ${Date.now() - mulai}ms`);
    return res;
  } catch (e) {
    const nama = e instanceof Error ? e.name : 'galat';
    console.error(`parse-hutang: ${tahap} gagal ${nama} ${Date.now() - mulai}ms`);
    throw new Error(`gemini ${tahap} ${nama}`);
  }
}

const ai = {
  async baca(gambar: Uint8Array, mime: string, prompt: string): Promise<unknown> {
    const res = await ambil('baca', `${GEMINI}/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': kunciGemini(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: base64(gambar) } }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SKEMA },
      }),
    });
    await cekRespons(res, 'baca');
    const data = await res.json();
    const bagian: unknown[] = data?.candidates?.[0]?.content?.parts ?? [];
    const isi = bagian
      .map((p) => (typeof (p as { text?: unknown })?.text === 'string' ? (p as { text: string }).text : ''))
      .join('')
      .trim();
    if (!isi) throw new Error('gemini baca tanpa isi');
    return JSON.parse(isi);
  },
};

Deno.serve(
  buatHandlerHutangGambar({
    db: buatDb,
    ai,
    sekarang: () => new Date(),
  }),
);
