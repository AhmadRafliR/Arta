import * as Notifications from 'expo-notifications';
import { batalkanPengingat, jadwalkanUlangPengingat, kirimNotifikasiUji, mintaIzinNotifikasi } from '../lokal';

jest.mock('expo-notifications', () => ({
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  AndroidImportance: { HIGH: 6 },
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
}));

const N = Notifications as unknown as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  N.getAllScheduledNotificationsAsync.mockResolvedValue([
    { identifier: 'p1', content: { data: { jenis: 'pengingat-hutang' } } },
    { identifier: 'lain', content: { data: { jenis: 'lain' } } },
    { identifier: 'p2', content: { data: { jenis: 'pengingat-hutang' } } },
  ]);
});

describe('batalkanPengingat', () => {
  it('hanya membatalkan milik pengingat', async () => {
    await batalkanPengingat();
    const ids = N.cancelScheduledNotificationAsync.mock.calls.map((c) => c[0]);
    expect(ids).toEqual(['p1', 'p2']);
  });
});

describe('jadwalkanUlangPengingat', () => {
  it('membatalkan lama lalu menjadwalkan dengan trigger DATE dan penanda', async () => {
    const waktu = new Date('2026-11-25T01:00:00Z');
    const n = await jadwalkanUlangPengingat([{ id: 'x', waktu, judul: 'J', isi: 'I' }]);
    expect(n).toBe(1);
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(N.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'x',
        content: expect.objectContaining({
          title: 'J',
          body: 'I',
          data: { jenis: 'pengingat-hutang', url: '/hutang' },
        }),
        trigger: { type: 'date', date: waktu, channelId: 'pengingat' },
      }),
    );
  });

  it('satu gagal tidak menghentikan yang lain', async () => {
    N.scheduleNotificationAsync.mockRejectedValueOnce(new Error('gagal'));
    const w = new Date('2026-11-25T01:00:00Z');
    const n = await jadwalkanUlangPengingat([
      { id: 'a', waktu: w, judul: 'A', isi: '' },
      { id: 'b', waktu: w, judul: 'B', isi: '' },
    ]);
    expect(n).toBe(1);
  });
});

describe('kirimNotifikasiUji & mintaIzinNotifikasi', () => {
  it('notifikasi uji dijadwalkan 5 detik', async () => {
    expect(await kirimNotifikasiUji()).toBe(true);
    expect(N.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: 'Notifikasi arta aktif' }),
        trigger: expect.objectContaining({ seconds: 5 }),
      }),
    );
  });

  it('izin sudah ada -> diberikan tanpa dialog', async () => {
    N.getPermissionsAsync.mockResolvedValue({ granted: true });
    expect(await mintaIzinNotifikasi()).toBe('diberikan');
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('meminta izin lalu ditolak', async () => {
    N.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true, status: 'undetermined' });
    N.requestPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await mintaIzinNotifikasi()).toBe('ditolak');
  });

  it('tidak bisa ditanya lagi -> ditolak langsung', async () => {
    N.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false, status: 'denied' });
    expect(await mintaIzinNotifikasi()).toBe('ditolak');
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
