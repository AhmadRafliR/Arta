import { hapusAkun } from '../akun';

const mockInvoke = jest.fn();
const mockSignOut = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    auth: { signOut: (...a: unknown[]) => mockSignOut(...a) },
  },
}));

const galatHttp = (body: unknown) => ({
  name: 'FunctionsHttpError',
  message: 'non-2xx',
  context: { json: async () => body },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSignOut.mockResolvedValue({ error: null });
});

describe('hapusAkun', () => {
  it('invoke delete-account dengan konfirmasi lalu signOut lokal', async () => {
    mockInvoke.mockResolvedValue({ data: { terhapus: true }, error: null });
    await hapusAkun();
    expect(mockInvoke).toHaveBeenCalledWith('delete-account', { body: { konfirmasi: 'HAPUS' } });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('galat server -> pesan server, tanpa signOut', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: galatHttp({ galat: 'server', pesan: 'Akun belum terhapus, coba lagi.' }),
    });
    await expect(hapusAkun()).rejects.toMatchObject({ kind: 'lain', pesan: 'Akun belum terhapus, coba lagi.' });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('body bukan JSON -> pesan umum', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsHttpError', context: { json: async () => Promise.reject(new Error('x')) } },
    });
    await expect(hapusAkun()).rejects.toMatchObject({ kind: 'lain', pesan: 'Terjadi kesalahan. Coba lagi.' });
  });

  it('fetch gagal -> offline', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError', message: 'x' } });
    await expect(hapusAkun()).rejects.toMatchObject({ kind: 'offline' });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('invoke melempar -> AppError', async () => {
    mockInvoke.mockRejectedValue(new Error('Network request failed'));
    await expect(hapusAkun()).rejects.toMatchObject({ kind: 'offline' });
  });

  it('signOut gagal setelah akun terhapus -> tidak melempar', async () => {
    mockInvoke.mockResolvedValue({ data: { terhapus: true }, error: null });
    mockSignOut.mockRejectedValue(new Error('x'));
    await expect(hapusAkun()).resolves.toBeUndefined();
  });
});
