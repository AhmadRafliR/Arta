// Migrasi 20261120000040: status_langganan, terapkan_event_langganan, pro_aktif.
// Dijalankan setelah `npx supabase db push --remote` (npm run test:integration).
import { createClient } from '@supabase/supabase-js';
import { cleanupUsers, createTestUser } from './helpers';

afterAll(cleanupUsers);

const env = (n: string) => {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env var ${n} (set it in .env.test)`);
  return v;
};
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = () =>
  createClient(new URL(env('SUPABASE_URL')).origin, env('SUPABASE_SERVICE_ROLE_KEY'), opts);

const hari = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const event = (userId: string, o: Partial<Record<string, unknown>> = {}) => ({
  p_user: userId,
  p_pro: true,
  p_berlaku_sampai: hari(14),
  p_produk: 'arta_pro:bulanan',
  p_periode: 'trial',
  p_akan_diperpanjang: true,
  p_event_ms: 1_000,
  p_sumber: 'revenuecat_sandbox',
  ...o,
});

test('pengguna baru: bukan pro, kolom lain null', async () => {
  const a = await createTestUser();
  const { data, error } = await a.client.rpc('status_langganan');
  expect(error).toBeNull();
  expect(data).toEqual({
    pro: false,
    berlaku_sampai: null,
    periode: null,
    produk: null,
    akan_diperpanjang: null,
  });
});

test('authenticated tidak bisa memanggil terapkan_event_langganan atau pro_aktif', async () => {
  const a = await createTestUser();
  const t = await a.client.rpc('terapkan_event_langganan', event(a.userId));
  expect(t.error).not.toBeNull();
  const p = await a.client.rpc('pro_aktif', { p_user: a.userId });
  expect(p.error).not.toBeNull();
  const { data } = await a.client.rpc('status_langganan');
  expect(data.pro).toBe(false);
});

test('event lewat service role -> pro; kuota_ai ikut naik ke 600', async () => {
  const a = await createTestUser();
  const { data: ok, error } = await admin().rpc('terapkan_event_langganan', event(a.userId));
  expect(error).toBeNull();
  expect(ok).toBe(true);
  const { data } = await a.client.rpc('status_langganan');
  expect(data).toMatchObject({ pro: true, periode: 'trial', produk: 'arta_pro:bulanan', akan_diperpanjang: true });
  const { data: k } = await a.client.rpc('kuota_ai');
  expect(k).toMatchObject({ pro: true, batas: 600 });
});

test('event lebih lama tidak menimpa yang lebih baru', async () => {
  const a = await createTestUser();
  await admin().rpc('terapkan_event_langganan', event(a.userId, { p_event_ms: 5_000 }));
  const { data: ok } = await admin().rpc(
    'terapkan_event_langganan',
    event(a.userId, { p_event_ms: 4_000, p_pro: false, p_berlaku_sampai: hari(-1) }),
  );
  expect(ok).toBe(false);
  const { data } = await a.client.rpc('status_langganan');
  expect(data.pro).toBe(true);
});

test('kedaluwarsa lampau (refund/expiration) -> bukan pro', async () => {
  const a = await createTestUser();
  await admin().rpc('terapkan_event_langganan', event(a.userId, { p_event_ms: 1 }));
  await admin().rpc(
    'terapkan_event_langganan',
    event(a.userId, { p_event_ms: 2, p_pro: true, p_berlaku_sampai: hari(-1), p_akan_diperpanjang: false }),
  );
  const { data } = await a.client.rpc('status_langganan');
  expect(data.pro).toBe(false);
});

test('pengguna yang tidak ada -> false tanpa galat', async () => {
  const { data, error } = await admin().rpc(
    'terapkan_event_langganan',
    event('00000000-0000-4000-8000-000000000000'),
  );
  expect(error).toBeNull();
  expect(data).toBe(false);
});

test('periode tidak valid ditolak', async () => {
  const a = await createTestUser();
  const { error } = await admin().rpc('terapkan_event_langganan', event(a.userId, { p_periode: 'seumur-hidup' }));
  expect(error).not.toBeNull();
});
