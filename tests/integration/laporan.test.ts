import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cleanupUsers, createTestUser, uuidV4 } from './helpers';

afterAll(cleanupUsers);

// Akses eksplisit (aturan expo/no-dynamic-env-var).
const ENV: Record<string, string | undefined> = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
const env = (n: string) => {
  const v = ENV[n];
  if (!v) throw new Error(`Missing env var ${n} (set it in .env.test)`);
  return v;
};
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = () =>
  createClient(new URL(env('SUPABASE_URL')).origin, env('SUPABASE_SERVICE_ROLE_KEY'), opts);
const anon = () =>
  createClient(new URL(env('SUPABASE_URL')).origin, env('SUPABASE_ANON_KEY'), opts);

const KOLOM = 'id,user_id,email,terverifikasi,diverifikasi_pada,verifikasi_dikirim_pada';

async function tambahPenerima(client: SupabaseClient, email: string) {
  const { data, error } = await client
    .from('report_recipients')
    .insert({ email })
    .select(KOLOM)
    .single();
  expect(error).toBeNull();
  return data!;
}

async function jumlahPenerima(client: SupabaseClient): Promise<number | null> {
  const { count, error } = await client
    .from('report_recipients')
    .select('*', { count: 'exact', head: true });
  expect(error).toBeNull();
  return count;
}

// ---------------------------------------------------------------- report_recipients

describe('report_recipients', () => {
  test('insert email -> belum terverifikasi', async () => {
    const a = await createTestUser();
    const p = await tambahPenerima(a.client, 'ortu@example.com');
    expect(p.user_id).toBe(a.userId);
    expect(p.email).toBe('ortu@example.com');
    expect(p.terverifikasi).toBe(false);
    expect(p.diverifikasi_pada).toBeNull();
    expect(p.verifikasi_dikirim_pada).toBeNull();
  });

  test('insert dengan kolom verifikasi atau user_id ditolak (privilege kolom)', async () => {
    const a = await createTestUser();
    const r1 = await a.client
      .from('report_recipients')
      .insert({ email: 'a@example.com', terverifikasi: true });
    expect(r1.error).not.toBeNull();
    const r2 = await a.client
      .from('report_recipients')
      .insert({ email: 'b@example.com', diverifikasi_pada: new Date().toISOString() });
    expect(r2.error).not.toBeNull();
    const r3 = await a.client
      .from('report_recipients')
      .insert({ email: 'c@example.com', verifikasi_dikirim_pada: new Date().toISOString() });
    expect(r3.error).not.toBeNull();
    const r4 = await a.client
      .from('report_recipients')
      .insert({ email: 'd@example.com', user_id: a.userId });
    expect(r4.error).not.toBeNull();
    expect(await jumlahPenerima(a.client)).toBe(0);
  });

  test('update apa pun oleh pengguna ditolak dan baris tidak berubah', async () => {
    const a = await createTestUser();
    const p = await tambahPenerima(a.client, 'ortu@example.com');

    const u1 = await a.client
      .from('report_recipients')
      .update({ terverifikasi: true })
      .eq('id', p.id)
      .select('id');
    expect(u1.error).not.toBeNull();
    const u2 = await a.client
      .from('report_recipients')
      .update({ email: 'lain@example.com' })
      .eq('id', p.id)
      .select('id');
    expect(u2.error).not.toBeNull();

    const { data } = await a.client.from('report_recipients').select(KOLOM).eq('id', p.id);
    expect(data).toHaveLength(1);
    expect(data![0].terverifikasi).toBe(false);
    expect(data![0].email).toBe('ortu@example.com');
  });

  test('penerima ke-4 ditolak: Maksimal 3 penerima laporan', async () => {
    const a = await createTestUser();
    await tambahPenerima(a.client, 'satu@example.com');
    await tambahPenerima(a.client, 'dua@example.com');
    await tambahPenerima(a.client, 'tiga@example.com');
    const r = await a.client.from('report_recipients').insert({ email: 'empat@example.com' });
    expect(r.error).not.toBeNull();
    expect(r.error!.message).toContain('Maksimal 3 penerima laporan');
    expect(await jumlahPenerima(a.client)).toBe(3);
  });

  test('setelah satu dihapus, boleh menambah lagi sampai 3', async () => {
    const a = await createTestUser();
    const p1 = await tambahPenerima(a.client, 'satu@example.com');
    await tambahPenerima(a.client, 'dua@example.com');
    await tambahPenerima(a.client, 'tiga@example.com');
    const del = await a.client.from('report_recipients').delete().eq('id', p1.id);
    expect(del.error).toBeNull();
    await tambahPenerima(a.client, 'empat@example.com');
    expect(await jumlahPenerima(a.client)).toBe(3);
  });

  test('insert paralel tidak melewati 3 penerima (kunci advisory)', async () => {
    const a = await createTestUser();
    const hasil = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        a.client.from('report_recipients').insert({ email: `paralel${i}@example.com` }),
      ),
    );
    expect(hasil.filter((r) => r.error === null)).toHaveLength(3);
    const gagal = hasil.filter((r) => r.error !== null);
    expect(gagal).toHaveLength(3);
    expect(gagal.every((r) => r.error!.message.includes('Maksimal 3 penerima laporan'))).toBe(
      true,
    );
    expect(await jumlahPenerima(a.client)).toBe(3);
  });

  test('batas 3 berlaku per pengguna', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    for (const e of ['satu@example.com', 'dua@example.com', 'tiga@example.com']) {
      await tambahPenerima(a.client, e);
    }
    await tambahPenerima(b.client, 'satu@example.com');
    expect(await jumlahPenerima(b.client)).toBe(1);
  });

  test('email tidak valid, berhuruf besar, atau berspasi ditolak', async () => {
    const a = await createTestUser();
    for (const email of [
      'bukan-email',
      'A@Example.com',
      ' ortu@example.com',
      'ortu@example',
      'or tu@example.com',
      `${'a'.repeat(250)}@example.com`,
    ]) {
      const r = await a.client.from('report_recipients').insert({ email });
      expect(r.error).not.toBeNull();
    }
    expect(await jumlahPenerima(a.client)).toBe(0);
  });

  test('email sama dua kali untuk pengguna yang sama ditolak (unik)', async () => {
    const a = await createTestUser();
    await tambahPenerima(a.client, 'ortu@example.com');
    const r = await a.client.from('report_recipients').insert({ email: 'ortu@example.com' });
    expect(r.error).not.toBeNull();
    expect(r.error!.code).toBe('23505');
  });

  test('pengguna B tidak bisa membaca atau menghapus penerima A', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const p = await tambahPenerima(a.client, 'ortu@example.com');

    const sel = await b.client.from('report_recipients').select('*');
    expect(sel.error).toBeNull();
    expect(sel.data).toEqual([]);

    const del = await b.client.from('report_recipients').delete().eq('id', p.id).select('id');
    expect(del.data ?? []).toEqual([]);
    expect(await jumlahPenerima(a.client)).toBe(1);
  });

  test('pemilik bisa menghapus penerima sendiri', async () => {
    const a = await createTestUser();
    const p = await tambahPenerima(a.client, 'ortu@example.com');
    const del = await a.client.from('report_recipients').delete().eq('id', p.id).select('id');
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);
    expect(await jumlahPenerima(a.client)).toBe(0);
  });

  test('anon tidak bisa membaca atau menyisipkan penerima', async () => {
    const sel = await anon().from('report_recipients').select('*');
    expect(sel.error).not.toBeNull();
    const ins = await anon().from('report_recipients').insert({ email: 'x@example.com' });
    expect(ins.error).not.toBeNull();
  });

  test('service role boleh menyisipkan penerima terverifikasi dan mengubah verifikasi', async () => {
    const a = await createTestUser();
    const svc = admin();
    const sekarang = new Date().toISOString();
    const ins = await svc
      .from('report_recipients')
      .insert({
        user_id: a.userId,
        email: 'svc@example.com',
        terverifikasi: true,
        diverifikasi_pada: sekarang,
      })
      .select(KOLOM)
      .single();
    expect(ins.error).toBeNull();
    expect(ins.data!.terverifikasi).toBe(true);
    expect(ins.data!.diverifikasi_pada).not.toBeNull();

    const p = await tambahPenerima(a.client, 'ortu@example.com');
    const upd = await svc
      .from('report_recipients')
      .update({ terverifikasi: true, diverifikasi_pada: sekarang })
      .eq('id', p.id)
      .select('terverifikasi');
    expect(upd.error).toBeNull();
    expect(upd.data).toEqual([{ terverifikasi: true }]);
  });

  test('batas 3 juga berlaku untuk service role', async () => {
    const a = await createTestUser();
    const svc = admin();
    for (const e of ['satu@example.com', 'dua@example.com', 'tiga@example.com']) {
      const r = await svc.from('report_recipients').insert({ user_id: a.userId, email: e });
      expect(r.error).toBeNull();
    }
    const r = await svc
      .from('report_recipients')
      .insert({ user_id: a.userId, email: 'empat@example.com' });
    expect(r.error).not.toBeNull();
    expect(r.error!.message).toContain('Maksimal 3 penerima laporan');
  });
});

// ---------------------------------------------------------------- report_log

describe('report_log dan batas kirim manual', () => {
  test('mulai_kirim_laporan 3x -> 3 id, ke-4 ditolak', async () => {
    const a = await createTestUser();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { data, error } = await a.client.rpc('mulai_kirim_laporan', { p_bulan: '2026-11' });
      expect(error).toBeNull();
      expect(typeof data).toBe('string');
      ids.push(data as string);
    }
    expect(new Set(ids).size).toBe(3);

    const r4 = await a.client.rpc('mulai_kirim_laporan', { p_bulan: '2026-11' });
    expect(r4.error).not.toBeNull();
    expect(r4.error!.message).toContain('Batas kirim laporan 3 kali per hari');

    const { data: log, error } = await a.client
      .from('report_log')
      .select('id,user_id,bulan,jenis,status,jumlah_penerima');
    expect(error).toBeNull();
    expect(log).toHaveLength(3);
    expect(
      log!.every(
        (l) =>
          l.user_id === a.userId &&
          l.bulan === '2026-11' &&
          l.jenis === 'manual' &&
          l.status === 'proses' &&
          l.jumlah_penerima === 0,
      ),
    ).toBe(true);
  });

  test('kiriman gagal tidak dihitung: setelah satu gagal boleh lagi', async () => {
    const a = await createTestUser();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { data } = await a.client.rpc('mulai_kirim_laporan', { p_bulan: '2026-11' });
      ids.push(data as string);
    }
    const s = await a.client.rpc('selesai_kirim_laporan', {
      p_id: ids[0],
      p_status: 'gagal',
      p_jumlah: 0,
    });
    expect(s.error).toBeNull();

    const lagi = await a.client.rpc('mulai_kirim_laporan', { p_bulan: '2026-10' });
    expect(lagi.error).toBeNull();
    expect(typeof lagi.data).toBe('string');

    const habis = await a.client.rpc('mulai_kirim_laporan', { p_bulan: '2026-11' });
    expect(habis.error).not.toBeNull();
    expect(habis.error!.message).toContain('Batas kirim laporan 3 kali per hari');
  });

  test('kiriman terkirim tetap dihitung', async () => {
    const a = await createTestUser();
    for (let i = 0; i < 3; i++) {
      const { data } = await a.client.rpc('mulai_kirim_laporan', { p_bulan: '2026-11' });
      await a.client.rpc('selesai_kirim_laporan', {
        p_id: data,
        p_status: 'terkirim',
        p_jumlah: 1,
      });
    }
    const r = await a.client.rpc('mulai_kirim_laporan', { p_bulan: '2026-11' });
    expect(r.error).not.toBeNull();
  });

  test('mulai_kirim_laporan paralel tidak melewati 3', async () => {
    const a = await createTestUser();
    const hasil = await Promise.all(
      Array.from({ length: 6 }, () =>
        a.client.rpc('mulai_kirim_laporan', { p_bulan: '2026-11' }),
      ),
    );
    expect(hasil.filter((r) => r.error === null)).toHaveLength(3);
    const { count } = await a.client
      .from('report_log')
      .select('*', { count: 'exact', head: true });
    expect(count).toBe(3);
  });

  test('batas kirim berlaku per pengguna', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    for (let i = 0; i < 3; i++) {
      await a.client.rpc('mulai_kirim_laporan', { p_bulan: '2026-11' });
    }
    const rb = await b.client.rpc('mulai_kirim_laporan', { p_bulan: '2026-11' });
    expect(rb.error).toBeNull();
  });

  test('bulan tidak valid ditolak', async () => {
    const a = await createTestUser();
    for (const p_bulan of ['2026-13', '2026-00', '2026-1', 'abc', '']) {
      const r = await a.client.rpc('mulai_kirim_laporan', { p_bulan });
      expect(r.error).not.toBeNull();
      expect(r.error!.message).toContain('Bulan tidak valid');
    }
    const { count } = await a.client
      .from('report_log')
      .select('*', { count: 'exact', head: true });
    expect(count).toBe(0);
  });

  test('selesai_kirim_laporan mencatat status dan hanya mengubah baris yang masih proses', async () => {
    const a = await createTestUser();
    const { data: id } = await a.client.rpc('mulai_kirim_laporan', { p_bulan: '2026-11' });
    const s1 = await a.client.rpc('selesai_kirim_laporan', {
      p_id: id,
      p_status: 'terkirim',
      p_jumlah: 2,
    });
    expect(s1.error).toBeNull();
    const s2 = await a.client.rpc('selesai_kirim_laporan', {
      p_id: id,
      p_status: 'gagal',
      p_jumlah: 0,
    });
    expect(s2.error).toBeNull();

    const { data } = await a.client
      .from('report_log')
      .select('status,jumlah_penerima')
      .eq('id', id);
    expect(data).toEqual([{ status: 'terkirim', jumlah_penerima: 2 }]);
  });

  test('selesai_kirim_laporan menolak status atau jumlah tidak valid', async () => {
    const a = await createTestUser();
    const { data: id } = await a.client.rpc('mulai_kirim_laporan', { p_bulan: '2026-11' });
    const r1 = await a.client.rpc('selesai_kirim_laporan', {
      p_id: id,
      p_status: 'proses',
      p_jumlah: 0,
    });
    expect(r1.error).not.toBeNull();
    const r2 = await a.client.rpc('selesai_kirim_laporan', {
      p_id: id,
      p_status: 'terkirim',
      p_jumlah: -1,
    });
    expect(r2.error).not.toBeNull();
    const { data } = await a.client.from('report_log').select('status').eq('id', id);
    expect(data).toEqual([{ status: 'proses' }]);
  });

  test('pengguna B tidak bisa menyelesaikan atau membaca log A', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const { data: id } = await a.client.rpc('mulai_kirim_laporan', { p_bulan: '2026-11' });
    const s = await b.client.rpc('selesai_kirim_laporan', {
      p_id: id,
      p_status: 'gagal',
      p_jumlah: 0,
    });
    expect(s.error).toBeNull();

    const sel = await b.client.from('report_log').select('*');
    expect(sel.error).toBeNull();
    expect(sel.data).toEqual([]);

    const { data } = await a.client.from('report_log').select('status').eq('id', id);
    expect(data).toEqual([{ status: 'proses' }]);
  });

  test('insert, update, atau delete langsung ke report_log oleh pengguna ditolak', async () => {
    const a = await createTestUser();
    const ins = await a.client
      .from('report_log')
      .insert({ user_id: a.userId, bulan: '2026-11', jenis: 'manual', status: 'gagal' });
    expect(ins.error).not.toBeNull();

    const { data: id } = await a.client.rpc('mulai_kirim_laporan', { p_bulan: '2026-11' });
    const upd = await a.client.from('report_log').update({ status: 'gagal' }).eq('id', id);
    expect(upd.error).not.toBeNull();
    const del = await a.client.from('report_log').delete().eq('id', id);
    expect(del.error).not.toBeNull();

    const { data } = await a.client.from('report_log').select('status');
    expect(data).toEqual([{ status: 'proses' }]);
  });

  test('service role: dua log bulanan untuk bulan yang sama -> yang kedua melanggar unik', async () => {
    const a = await createTestUser();
    const svc = admin();
    const baris = { user_id: a.userId, bulan: '2026-10', jenis: 'bulanan' };
    const r1 = await svc.from('report_log').insert(baris);
    expect(r1.error).toBeNull();
    const r2 = await svc.from('report_log').insert(baris);
    expect(r2.error).not.toBeNull();
    expect(r2.error!.code).toBe('23505');

    // Bulan lain dan log manual pada bulan yang sama tetap boleh.
    const r3 = await svc.from('report_log').insert({ ...baris, bulan: '2026-11' });
    expect(r3.error).toBeNull();
    const r4 = await svc.from('report_log').insert({ ...baris, jenis: 'manual' });
    expect(r4.error).toBeNull();
    const r5 = await svc.from('report_log').insert({ ...baris, jenis: 'manual' });
    expect(r5.error).toBeNull();
  });

  test('service role: insert bulanan paralel untuk bulan yang sama -> hanya satu', async () => {
    const a = await createTestUser();
    const svc = admin();
    const baris = { user_id: a.userId, bulan: '2026-09', jenis: 'bulanan' };
    const hasil = await Promise.all(
      Array.from({ length: 4 }, () => svc.from('report_log').insert(baris)),
    );
    expect(hasil.filter((r) => r.error === null)).toHaveLength(1);
  });

  test('anon tidak bisa memanggil fungsi laporan atau membaca report_log', async () => {
    const r1 = await anon().rpc('mulai_kirim_laporan', { p_bulan: '2026-11' });
    expect(r1.error).not.toBeNull();
    const r2 = await anon().rpc('selesai_kirim_laporan', {
      p_id: uuidV4(),
      p_status: 'gagal',
      p_jumlah: 0,
    });
    expect(r2.error).not.toBeNull();
    const r3 = await anon().from('report_log').select('*');
    expect(r3.error).not.toBeNull();
  });
});

// ---------------------------------------------------------------- tandai_verifikasi_dikirim

describe('tandai_verifikasi_dikirim', () => {
  test('pertama true, langsung kedua false, waktu kirim tercatat', async () => {
    const a = await createTestUser();
    const p = await tambahPenerima(a.client, 'ortu@example.com');
    const r1 = await a.client.rpc('tandai_verifikasi_dikirim', { p_recipient: p.id });
    expect(r1.error).toBeNull();
    expect(r1.data).toBe(true);
    const r2 = await a.client.rpc('tandai_verifikasi_dikirim', { p_recipient: p.id });
    expect(r2.error).toBeNull();
    expect(r2.data).toBe(false);

    const { data } = await a.client
      .from('report_recipients')
      .select('terverifikasi,verifikasi_dikirim_pada')
      .eq('id', p.id)
      .single();
    expect(data!.terverifikasi).toBe(false);
    expect(data!.verifikasi_dikirim_pada).not.toBeNull();
  });

  test('panggilan paralel -> hanya satu true', async () => {
    const a = await createTestUser();
    const p = await tambahPenerima(a.client, 'ortu@example.com');
    const hasil = await Promise.all(
      Array.from({ length: 4 }, () =>
        a.client.rpc('tandai_verifikasi_dikirim', { p_recipient: p.id }),
      ),
    );
    expect(hasil.every((r) => r.error === null)).toBe(true);
    expect(hasil.filter((r) => r.data === true)).toHaveLength(1);
  });

  test('lewat 10 menit -> boleh lagi', async () => {
    const a = await createTestUser();
    const p = await tambahPenerima(a.client, 'ortu@example.com');
    const r1 = await a.client.rpc('tandai_verifikasi_dikirim', { p_recipient: p.id });
    expect(r1.data).toBe(true);
    const upd = await admin()
      .from('report_recipients')
      .update({ verifikasi_dikirim_pada: new Date(Date.now() - 11 * 60_000).toISOString() })
      .eq('id', p.id);
    expect(upd.error).toBeNull();
    const r2 = await a.client.rpc('tandai_verifikasi_dikirim', { p_recipient: p.id });
    expect(r2.error).toBeNull();
    expect(r2.data).toBe(true);
  });

  test('penerima milik B atau id acak -> Penerima tidak ditemukan', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const pb = await tambahPenerima(b.client, 'ortu@example.com');
    const r1 = await a.client.rpc('tandai_verifikasi_dikirim', { p_recipient: pb.id });
    expect(r1.error).not.toBeNull();
    expect(r1.error!.message).toContain('Penerima tidak ditemukan');
    const r2 = await a.client.rpc('tandai_verifikasi_dikirim', { p_recipient: uuidV4() });
    expect(r2.error).not.toBeNull();
    expect(r2.error!.message).toContain('Penerima tidak ditemukan');

    const { data } = await b.client
      .from('report_recipients')
      .select('verifikasi_dikirim_pada')
      .eq('id', pb.id)
      .single();
    expect(data!.verifikasi_dikirim_pada).toBeNull();
  });

  test('penerima sudah terverifikasi -> ditolak', async () => {
    const a = await createTestUser();
    const p = await tambahPenerima(a.client, 'ortu@example.com');
    await admin()
      .from('report_recipients')
      .update({ terverifikasi: true, diverifikasi_pada: new Date().toISOString() })
      .eq('id', p.id);
    const r = await a.client.rpc('tandai_verifikasi_dikirim', { p_recipient: p.id });
    expect(r.error).not.toBeNull();
    expect(r.error!.message).toContain('Penerima sudah terverifikasi');
  });

  test('anon tidak bisa memanggil', async () => {
    const r = await anon().rpc('tandai_verifikasi_dikirim', { p_recipient: uuidV4() });
    expect(r.error).not.toBeNull();
  });
});
