import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/data/errors';

export const SALURAN_PENGINGAT = 'pengingat';
export const KUNCI_PUSH_TOKEN = 'arta.pushToken';

export type HasilDaftarPush =
  | { status: 'aktif'; token: string }
  | { status: 'ditolak' }
  | { status: 'tidak-didukung'; alasan: string };

/** Android 13+: saluran harus ada sebelum izin diminta. Di platform lain tidak melakukan apa pun. */
export async function siapkanSaluran(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(SALURAN_PENGINGAT, {
    name: 'Pengingat jatuh tempo',
    // eslint-plugin-import tidak melihat enum yang diekspor ulang lewat `export *`; nilainya ada (lihat .d.ts).
    // eslint-disable-next-line import/namespace
    importance: Notifications.AndroidImportance.HIGH,
  });
}

function ambilProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return Constants.easConfig?.projectId ?? extra?.eas?.projectId;
}

export async function daftarkanPush(): Promise<HasilDaftarPush> {
  if (!Device.isDevice) {
    return { status: 'tidak-didukung', alasan: 'Notifikasi push hanya berjalan di perangkat sungguhan.' };
  }
  try {
    await siapkanSaluran();

    let izin = await Notifications.getPermissionsAsync();
    if (!izin.granted) {
      if (izin.canAskAgain === false && izin.status === 'denied') return { status: 'ditolak' };
      izin = await Notifications.requestPermissionsAsync();
    }
    if (!izin.granted) return { status: 'ditolak' };

    const projectId = ambilProjectId();
    if (!projectId) {
      return { status: 'tidak-didukung', alasan: 'Konfigurasi notifikasi belum lengkap di build ini.' };
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const { error } = await supabase.rpc('simpan_push_token', {
      p_token: token,
      p_platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'web' ? 'web' : 'android',
    });
    if (error) throw toAppError(error);

    await AsyncStorage.setItem(KUNCI_PUSH_TOKEN, token);
    return { status: 'aktif', token };
  } catch (e) {
    const alasan =
      e && typeof e === 'object' && 'pesan' in e && typeof (e as { pesan: unknown }).pesan === 'string'
        ? (e as { pesan: string }).pesan
        : 'Notifikasi tidak bisa diaktifkan di perangkat ini.';
    return { status: 'tidak-didukung', alasan };
  }
}

/** Lepas token perangkat dari akun (dipanggil sebelum signOut). Galat ditelan agar logout tidak tertahan. */
export async function lepasPush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(KUNCI_PUSH_TOKEN);
    if (token) {
      await supabase.rpc('hapus_push_token', { p_token: token });
    }
  } catch {
    // abaikan
  }
  try {
    await AsyncStorage.removeItem(KUNCI_PUSH_TOKEN);
  } catch {
    // abaikan
  }
}
