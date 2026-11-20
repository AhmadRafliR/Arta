import * as Notifications from 'expo-notifications';

type RouterMinimal = { push: (url: string) => void };

function urlAman(data: unknown): string | null {
  const url = data && typeof data === 'object' ? (data as { url?: unknown }).url : undefined;
  // Hanya rute internal: diawali "/" tetapi bukan "//" (protocol-relative).
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : null;
}

/** Pasang penangan notifikasi (foreground + ketuk). Kembalikan fungsi pembersih. */
export function pasangPenangan(router: RouterMinimal): () => void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  const buka = (respons: Notifications.NotificationResponse | null | undefined) => {
    const url = urlAman(respons?.notification?.request?.content?.data);
    if (url) router.push(url);
  };

  const langganan = Notifications.addNotificationResponseReceivedListener(buka);

  // Aplikasi dibuka dari keadaan mati lewat ketukan notifikasi.
  let batal = false;
  Notifications.getLastNotificationResponseAsync()
    .then((r) => {
      if (!batal) buka(r);
    })
    .catch(() => {});

  return () => {
    batal = true;
    langganan.remove();
  };
}
