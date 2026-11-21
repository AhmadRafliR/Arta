import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SALURAN_PENGINGAT, siapkanSaluran } from './push';
import type { ItemJadwal } from './jadwalPengingat';

export const JENIS_PENGINGAT = 'pengingat-hutang';
const URL_HUTANG = '/hutang';

function web(): boolean {
  return Platform.OS === 'web';
}

function milikPengingat(n: Notifications.NotificationRequest): boolean {
  const data = n.content?.data as { jenis?: unknown } | undefined;
  return data?.jenis === JENIS_PENGINGAT;
}

/** Batalkan hanya notifikasi terjadwal milik pengingat (notifikasi lain tak disentuh). */
export async function batalkanPengingat(): Promise<void> {
  if (web()) return;
  try {
    const semua = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      semua.filter(milikPengingat).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // abaikan
  }
}

/** Ganti seluruh jadwal pengingat dengan `item`. Mengembalikan jumlah yang berhasil dijadwalkan. */
export async function jadwalkanUlangPengingat(item: ItemJadwal[]): Promise<number> {
  if (web()) return 0;
  try {
    await siapkanSaluran();
    await batalkanPengingat();
    let n = 0;
    for (const i of item) {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: i.id,
          content: {
            title: i.judul,
            body: i.isi,
            sound: 'default',
            data: { jenis: JENIS_PENGINGAT, url: URL_HUTANG },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: i.waktu,
            channelId: SALURAN_PENGINGAT,
          },
        });
        n++;
      } catch {
        // satu gagal tak membatalkan yang lain
      }
    }
    return n;
  } catch {
    return 0;
  }
}

/** Notifikasi uji, muncul sekitar 5 detik lagi. */
export async function kirimNotifikasiUji(): Promise<boolean> {
  if (web()) return false;
  try {
    await siapkanSaluran();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Notifikasi arta aktif',
        body: 'Pengingat jatuh tempo akan muncul seperti ini.',
        sound: 'default',
        data: { jenis: 'uji', url: URL_HUTANG },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        channelId: SALURAN_PENGINGAT,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Minta izin notifikasi (dialog sistem bila perlu). Tanpa push token. */
export async function mintaIzinNotifikasi(): Promise<'diberikan' | 'ditolak'> {
  if (web()) return 'ditolak';
  try {
    await siapkanSaluran();
    let izin = await Notifications.getPermissionsAsync();
    if (!izin.granted) {
      if (izin.canAskAgain === false && izin.status === 'denied') return 'ditolak';
      izin = await Notifications.requestPermissionsAsync();
    }
    return izin.granted ? 'diberikan' : 'ditolak';
  } catch {
    return 'ditolak';
  }
}

/** Izin sudah diberikan? Tidak memunculkan dialog. */
export async function izinSudahDiberikan(): Promise<boolean> {
  if (web()) return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}
