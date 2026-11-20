// Penyambung Deno untuk handler `debt-reminders` (dipanggil pg_cron tiap jam). Logika ada di
// ../_shared/pengingat.ts (dites di Jest). File ini dikecualikan dari tsc.
// Log tanpa token push atau isi pesan.
import { createClient } from '@supabase/supabase-js';
import {
  buatHandlerPengingat,
  type Penerima,
  type Tagihan,
  type TiketExpo,
} from '../_shared/pengingat.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') ?? '';
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

type Baris = Record<string, unknown>;

Deno.serve(
  buatHandlerPengingat({
    rahasia: CRON_SECRET,
    sekarang: () => new Date(),

    async penerima(): Promise<Penerima[]> {
      const { data, error } = await sb.rpc('penerima_pengingat');
      if (error) throw new Error(`penerima ${error.code ?? ''}`);
      return ((data ?? []) as Baris[]).map((r) => ({
        userId: r.user_id as string,
        tokens: (r.tokens as string[]) ?? [],
        hariSebelum: Number(r.hari_sebelum) as 0 | 1 | 3,
        jam: Number(r.jam),
        zona: (r.zona_waktu as string | null) ?? null,
      }));
    },

    async tagihan(userId, tanggal): Promise<Tagihan[] | null> {
      const { data, error } = await sb.rpc('tagihan_untuk_pengingat', {
        p_user: userId,
        p_tanggal: tanggal,
      });
      if (error) {
        if (error.code === 'PGRST202') return null; // kontrak Rencana 3 belum ada
        throw new Error(`tagihan ${error.code ?? ''}`);
      }
      return ((data ?? []) as Baris[]).map((r) => ({
        tagihanId: r.tagihan_id as string,
        debtId: r.debt_id as string,
        pemberi: r.pemberi as string,
        jatuhTempo: String(r.jatuh_tempo).slice(0, 10),
        nominal: Number(r.nominal),
      }));
    },

    async sudahDikirim(userId, kunci) {
      if (kunci.length === 0) return new Set<string>();
      const { data, error } = await sb
        .from('log_pengingat')
        .select('kunci')
        .eq('user_id', userId)
        .in('kunci', kunci);
      if (error) throw new Error(`log ${error.code ?? ''}`);
      return new Set(((data ?? []) as { kunci: string }[]).map((r) => r.kunci));
    },

    async catatDikirim(userId, kunci) {
      if (kunci.length === 0) return;
      const { error } = await sb
        .from('log_pengingat')
        .upsert(
          kunci.map((k) => ({ user_id: userId, kunci: k })),
          { onConflict: 'user_id,kunci', ignoreDuplicates: true },
        );
      if (error) throw new Error(`catat ${error.code ?? ''}`);
    },

    async kirim(pesan): Promise<TiketExpo[]> {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      if (EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`;
      const res = await fetch(EXPO_PUSH, { method: 'POST', headers, body: JSON.stringify(pesan) });
      if (!res.ok) {
        await res.body?.cancel();
        console.error(`debt-reminders: expo push status ${res.status}`);
        throw new Error(`expo ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data?.data) ? (data.data as TiketExpo[]) : [];
    },

    async hapusToken(tokens) {
      if (tokens.length === 0) return;
      const { error } = await sb.from('push_tokens').delete().in('token', tokens);
      if (error) throw new Error(`hapus ${error.code ?? ''}`);
    },
  }),
);
