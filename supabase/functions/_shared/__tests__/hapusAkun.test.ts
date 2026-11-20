import { buatHandlerHapusAkun, type DepsHapusAkun } from '../hapusAkun';

function buat(over: Partial<DepsHapusAkun> = {}) {
  const urutan: string[] = [];
  const deps: DepsHapusAkun = {
    pengguna: jest.fn(async (t: string) => (t === 'tok-valid' ? 'u-1' : null)),
    hapusRevenueCat: jest.fn(async () => void urutan.push('rc')),
    hapusPengguna: jest.fn(async () => void urutan.push('hapus')),
    sisaData: jest.fn(async () => {
      urutan.push('sisa');
      return [];
    }),
    ...over,
  };
  return { deps, urutan, handler: buatHandlerHapusAkun(deps) };
}

function req(body: unknown, token: string | null = 'tok-valid', method = 'POST') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  return new Request('https://x.test/delete-account', {
    method,
    headers,
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('buatHandlerHapusAkun', () => {
  it('OPTIONS -> CORS', async () => {
    const { handler } = buat();
    const res = await handler(req(null, null, 'OPTIONS'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('tanpa token -> 401 dan tidak menghapus', async () => {
    const { handler, deps } = buat();
    const res = await handler(req({ konfirmasi: 'HAPUS' }, null));
    expect(res.status).toBe(401);
    expect(deps.hapusPengguna).not.toHaveBeenCalled();
  });

  it('token tidak valid -> 401 dan tidak menghapus', async () => {
    const { handler, deps } = buat();
    const res = await handler(req({ konfirmasi: 'HAPUS' }, 'tok-salah'));
    expect(res.status).toBe(401);
    expect(deps.hapusPengguna).not.toHaveBeenCalled();
    expect(deps.hapusRevenueCat).not.toHaveBeenCalled();
  });

  it('pengguna() melempar -> 401', async () => {
    const { handler, deps } = buat({
      pengguna: jest.fn(async () => {
        throw new Error('jaringan');
      }),
    });
    expect((await handler(req({ konfirmasi: 'HAPUS' }))).status).toBe(401);
    expect(deps.hapusPengguna).not.toHaveBeenCalled();
  });

  it.each([[{}], [{ konfirmasi: 'hapus' }], [{ konfirmasi: true }], [[]], ['bukan json'], [null]])(
    'konfirmasi salah %j -> 400',
    async (body) => {
      const { handler, deps } = buat();
      const res = await handler(req(body));
      expect(res.status).toBe(400);
      expect((await res.json()).pesan).toBe('Ketik HAPUS untuk konfirmasi.');
      expect(deps.hapusPengguna).not.toHaveBeenCalled();
    },
  );

  it('metode selain POST -> 400', async () => {
    const { handler } = buat();
    expect((await handler(req(null, 'tok-valid', 'GET'))).status).toBe(400);
  });

  it('sukses: urutan RevenueCat -> hapus -> sisa, 200 {terhapus:true}', async () => {
    const { handler, urutan, deps } = buat();
    const res = await handler(req({ konfirmasi: 'HAPUS' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ terhapus: true });
    expect(urutan).toEqual(['rc', 'hapus', 'sisa']);
    expect(deps.hapusPengguna).toHaveBeenCalledWith('u-1');
  });

  it('RevenueCat gagal -> dicatat, tetap sukses', async () => {
    const { handler, urutan } = buat({
      hapusRevenueCat: jest.fn(async () => {
        throw new Error('rc 500');
      }),
    });
    const res = await handler(req({ konfirmasi: 'HAPUS' }));
    expect(res.status).toBe(200);
    expect(urutan).toEqual(['hapus', 'sisa']);
    expect(console.error).toHaveBeenCalled();
  });

  it('hapus gagal -> 500 dengan pesan, sisaData tidak dipanggil', async () => {
    const { handler, deps } = buat({
      hapusPengguna: jest.fn(async () => {
        throw new Error('db');
      }),
    });
    const res = await handler(req({ konfirmasi: 'HAPUS' }));
    expect(res.status).toBe(500);
    expect((await res.json()).pesan).toBe('Akun belum terhapus, coba lagi.');
    expect(deps.sisaData).not.toHaveBeenCalled();
  });

  it('sisa data tidak kosong -> log nama tabel saja, tetap 200', async () => {
    const { handler } = buat({ sisaData: jest.fn(async () => [{ tabel: 'debts', jumlah: 3 }]) });
    const res = await handler(req({ konfirmasi: 'HAPUS' }));
    expect(res.status).toBe(200);
    const log = (console.error as jest.Mock).mock.calls.flat().join(' ');
    expect(log).toContain('debts');
    expect(log).not.toContain('u-1');
    expect(log).not.toContain('tok-valid');
  });

  it('sisaData melempar -> tetap 200', async () => {
    const { handler } = buat({
      sisaData: jest.fn(async () => {
        throw new Error('rpc');
      }),
    });
    expect((await handler(req({ konfirmasi: 'HAPUS' }))).status).toBe(200);
  });
});
