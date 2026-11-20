// Penyambung Deno untuk handler `parse`: mengisi dependensi (Supabase dengan token pengguna, OpenAI).
// Logika ada di ../_shared/handler.ts (dites di Jest). File ini dikecualikan dari tsc.
import { createClient } from '@supabase/supabase-js';
import { buatHandler, GalatSesi, tanggalDiZona, type DbPengguna, type Kuota } from '../_shared/handler.ts';
import { SKEMA_PARSE, type Konteks } from '../_shared/parsing.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const MODEL_STT = Deno.env.get('OPENAI_MODEL_STT') || 'gpt-4o-mini-transcribe';
// 'transcriptions' = /audio/transcriptions (OpenAI); 'chat' = input_audio di chat/completions (Gemini).
const STT_MODE = Deno.env.get('OPENAI_STT_MODE') || 'transcriptions';
const MODEL_PARSE = Deno.env.get('OPENAI_MODEL_PARSE') || 'gpt-5-mini';
// Endpoint kompatibel OpenAI. Bawaan OpenAI; ganti lewat secret, misalnya router.bangunweb.com/v1.
const OPENAI = (Deno.env.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/+$/, '');
// Transkripsi boleh memakai penyedia/kunci lain (router teks belum tentu punya model suara).
const OPENAI_STT = (Deno.env.get('OPENAI_STT_BASE_URL') || OPENAI).replace(/\/+$/, '');
// reasoning_effort hanya dikenal model OpenAI; kirim hanya bila diatur.
const REASONING = Deno.env.get('OPENAI_REASONING_EFFORT') || (OPENAI.includes('api.openai.com') ? 'low' : '');

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

function buatDb(token: string): DbPengguna {
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
    async konteks(sekarang: Date): Promise<Konteks> {
      // RLS membatasi semua baris ke milik pengguna.
      const [profil, dompet, kategori] = await Promise.all([
        sb.from('profiles').select('zona_waktu').limit(1).maybeSingle(),
        sb.from('wallets').select('id, nama, tipe').not('diarsip', 'is', true),
        sb.from('categories').select('jenis, nama'),
      ]);
      periksa(profil.error, profil.status);
      periksa(dompet.error, dompet.status);
      periksa(kategori.error, kategori.status);
      return {
        hariIni: tanggalDiZona(sekarang, profil.data?.zona_waktu ?? null),
        dompet: (dompet.data ?? []).map((d) => ({
          id: d.id,
          nama: d.nama,
          tipe: d.tipe ?? 'harian',
        })),
        kategori: kategori.data ?? [],
      };
    },
  };
}

function kunciOpenAI(stt = false): string {
  const k = (stt ? Deno.env.get('OPENAI_STT_API_KEY') : undefined) || Deno.env.get('OPENAI_API_KEY');
  if (!k) throw new Error('OPENAI_API_KEY belum diset');
  return k;
}

function base64(bytes: Uint8Array): string {
  let biner = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    biner += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(biner);
}

// Format yang dikenal input_audio Gemini: wav, mp3, aac, ogg, flac, aiff.
// m4a (AAC dalam MP4) dipetakan ke aac; webm/3gp/caf tidak didukung dan ditolak.
function formatAudioChat(mime: string): string | null {
  const m = mime.toLowerCase();
  if (m.includes('wav')) return 'wav';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('aac') || m.includes('m4a') || m.includes('mp4')) return 'aac';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('flac')) return 'flac';
  if (m.includes('aiff')) return 'aiff';
  return null;
}

function ekstensi(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('webm')) return 'webm';
  if (m.includes('wav')) return 'wav';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('aac')) return 'aac';
  return 'm4a';
}

// Hanya status HTTP yang dicatat; isi respons/permintaan bisa memuat teks pengguna.
async function cekRespons(res: Response, tahap: string): Promise<void> {
  if (res.ok) return;
  await res.body?.cancel();
  console.error(`parse: openai ${tahap} status ${res.status}`);
  throw new Error(`openai ${tahap} ${res.status}`);
}

const openai = {
  async transkripsi(audio: Uint8Array, mime: string): Promise<string> {
    // Gemini (lewat endpoint OpenAI-compatible) tidak punya /audio/transcriptions;
    // audio dikirim sebagai input_audio di chat/completions.
    if (STT_MODE === 'chat') {
      const format = formatAudioChat(mime);
      if (!format) throw new Error(`format audio tidak didukung: ${mime}`);
      const res = await fetch(`${OPENAI_STT}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${kunciOpenAI(true)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL_STT,
          temperature: 0,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Transkripsikan audio ini ke teks Bahasa Indonesia. Keluarkan hanya teksnya, tanpa penjelasan.' },
                { type: 'input_audio', input_audio: { data: base64(audio), format } },
              ],
            },
          ],
        }),
      });
      await cekRespons(res, 'stt');
      const data = await res.json();
      const isi = data?.choices?.[0]?.message?.content;
      return typeof isi === 'string' ? isi.trim() : '';
    }

    const form = new FormData();
    form.append('file', new Blob([audio], { type: mime }), `rekaman.${ekstensi(mime)}`);
    form.append('model', MODEL_STT);
    form.append('language', 'id');
    form.append('temperature', '0');
    const res = await fetch(`${OPENAI_STT}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kunciOpenAI(true)}` },
      body: form,
    });
    await cekRespons(res, 'stt');
    const data = await res.json();
    return typeof data?.text === 'string' ? data.text : '';
  },

  async parse(prompt: string, teks: string): Promise<unknown> {
    const res = await fetch(`${OPENAI}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kunciOpenAI()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_PARSE,
        ...(REASONING ? { reasoning_effort: REASONING } : {}),
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: teks },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'transaksi', strict: true, schema: SKEMA_PARSE },
        },
      }),
    });
    await cekRespons(res, 'parse');
    const data = await res.json();
    const isi = data?.choices?.[0]?.message?.content;
    if (typeof isi !== 'string' || !isi) throw new Error('openai parse tanpa isi');
    return JSON.parse(isi);
  },
};

Deno.serve(
  buatHandler({
    db: buatDb,
    openai,
    buatId: () => crypto.randomUUID(),
    sekarang: () => new Date(),
  }),
);
