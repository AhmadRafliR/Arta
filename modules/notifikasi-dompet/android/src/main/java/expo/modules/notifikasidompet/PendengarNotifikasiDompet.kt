package expo.modules.notifikasidompet

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Membaca notifikasi aplikasi dompet (daftar putih) dan memasukkannya ke antrean lokal.
 * Notifikasi dari paket lain diabaikan dan tidak disimpan.
 */
class PendengarNotifikasiDompet : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    try {
      val paket = sbn.packageName ?: return
      if (paket !in PAKET_DIIZINKAN) return
      if (!AntreanNotifikasi.aktif(applicationContext)) return

      val extras = sbn.notification?.extras ?: return
      val judul = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
      val besar = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
      val teks = if (!besar.isNullOrEmpty()) {
        besar
      } else {
        extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
      }

      val notif = NotifikasiMentah(
        kunci = "${sbn.key}:${sbn.postTime}",
        paket = paket,
        judul = judul,
        teks = teks,
        waktu = sbn.postTime
      )

      if (AntreanNotifikasi.tambah(applicationContext, notif)) {
        try {
          pendengarJs?.invoke(notif)
        } catch (e: Exception) {
          // Modul JS tidak hidup atau gagal menerima event; antrean tetap aman.
        }
      }
    } catch (e: Exception) {
      // Jangan pernah membuat service crash karena satu notifikasi.
    }
  }

  companion object {
    val PAKET_DIIZINKAN = setOf("com.gojek.app", "com.gojek.gopay", "com.shopee.id")

    /** Diisi modul saat hidup (OnCreate) dan dikosongkan di OnDestroy. */
    @Volatile
    var pendengarJs: ((NotifikasiMentah) -> Unit)? = null
  }
}
