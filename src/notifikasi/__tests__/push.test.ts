import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { daftarkanPush, lepasPush, KUNCI_PUSH_TOKEN } from '../push';
import { pasangPenangan } from '../penangan';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a) },
}));

const mockDevice = { isDevice: true };
jest.mock('expo-device', () => ({
  get isDevice() {
    return mockDevice.isDevice;
  },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { easConfig: { projectId: 'proj-uji' }, expoConfig: { extra: {} } },
}));

const N = Notifications as unknown as {
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  getExpoPushTokenAsync: jest.Mock;
  setNotificationChannelAsync: jest.Mock;
  setNotificationHandler: jest.Mock;
  addNotificationResponseReceivedListener: jest.Mock;
  getLastNotificationResponseAsync: jest.Mock;
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockDevice.isDevice = true;
  mockRpc.mockResolvedValue({ data: null, error: null });
  await AsyncStorage.clear();
});

describe('daftarkanPush', () => {
  it('izin sudah diberikan: token disimpan via RPC dan AsyncStorage', async () => {
    N.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted', granted: true, canAskAgain: true });
    const h = await daftarkanPush();
    expect(h).toEqual({ status: 'aktif', token: 'ExponentPushToken[uji]' });
    expect(N.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-uji' });
    expect(mockRpc).toHaveBeenCalledWith('simpan_push_token', {
      p_token: 'ExponentPushToken[uji]',
      p_platform: expect.stringMatching(/^(android|ios)$/),
    });
    expect(await AsyncStorage.getItem(KUNCI_PUSH_TOKEN)).toBe('ExponentPushToken[uji]');
  });

  it('izin diminta lalu diberikan', async () => {
    N.requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted', granted: true, canAskAgain: true });
    const h = await daftarkanPush();
    expect(N.requestPermissionsAsync).toHaveBeenCalled();
    expect(h.status).toBe('aktif');
  });

  it('izin ditolak: status ditolak tanpa token dan tanpa RPC', async () => {
    const h = await daftarkanPush();
    expect(h).toEqual({ status: 'ditolak' });
    expect(N.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(KUNCI_PUSH_TOKEN)).toBeNull();
  });

  it('bukan perangkat sungguhan: tidak-didukung', async () => {
    mockDevice.isDevice = false;
    const h = await daftarkanPush();
    expect(h.status).toBe('tidak-didukung');
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('RPC gagal: tidak-didukung dan token tidak disimpan', async () => {
    N.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted', granted: true, canAskAgain: true });
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'Token push tidak valid' } });
    const h = await daftarkanPush();
    expect(h).toEqual({ status: 'tidak-didukung', alasan: 'Token push tidak valid' });
    expect(await AsyncStorage.getItem(KUNCI_PUSH_TOKEN)).toBeNull();
  });
});

describe('lepasPush', () => {
  it('memanggil hapus_push_token dengan token tersimpan lalu menghapus kunci', async () => {
    await AsyncStorage.setItem(KUNCI_PUSH_TOKEN, 'ExponentPushToken[abc]');
    await lepasPush();
    expect(mockRpc).toHaveBeenCalledWith('hapus_push_token', { p_token: 'ExponentPushToken[abc]' });
    expect(await AsyncStorage.getItem(KUNCI_PUSH_TOKEN)).toBeNull();
  });

  it('tanpa token tersimpan: tidak memanggil RPC', async () => {
    await lepasPush();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('galat RPC ditelan', async () => {
    await AsyncStorage.setItem(KUNCI_PUSH_TOKEN, 'ExponentPushToken[abc]');
    mockRpc.mockRejectedValueOnce(new Error('network request failed'));
    await expect(lepasPush()).resolves.toBeUndefined();
    expect(await AsyncStorage.getItem(KUNCI_PUSH_TOKEN)).toBeNull();
  });
});

describe('pasangPenangan', () => {
  const respons = (data: unknown) => ({ notification: { request: { content: { data } } } });

  it('mengatur handler foreground tanpa shouldShowAlert', async () => {
    pasangPenangan({ push: jest.fn() });
    const handler = N.setNotificationHandler.mock.calls[0][0];
    expect(await handler.handleNotification()).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });

  it('hanya mengikuti url relatif', () => {
    const router = { push: jest.fn() };
    pasangPenangan(router);
    const cb = N.addNotificationResponseReceivedListener.mock.calls[0][0];
    cb(respons({ url: '/hutang' }));
    cb(respons({ url: 'https://jahat.example/x' }));
    cb(respons({ url: '//jahat.example/x' }));
    cb(respons({ url: 42 }));
    cb(respons({}));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/hutang');
  });

  it('membuka url dari notifikasi yang meluncurkan app', async () => {
    N.getLastNotificationResponseAsync.mockResolvedValueOnce(respons({ url: '/hutang' }));
    const router = { push: jest.fn() };
    pasangPenangan(router);
    await Promise.resolve();
    await Promise.resolve();
    expect(router.push).toHaveBeenCalledWith('/hutang');
  });

  it('cleanup melepas listener', () => {
    const remove = jest.fn();
    N.addNotificationResponseReceivedListener.mockReturnValueOnce({ remove });
    const cleanup = pasangPenangan({ push: jest.fn() });
    cleanup();
    expect(remove).toHaveBeenCalled();
  });
});
