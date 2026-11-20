package expo.modules.notifikasidompet

import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotifikasiDompetModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "Konteks React belum tersedia" }
      .applicationContext

  override fun definition() = ModuleDefinition {
    Name("NotifikasiDompet")

    Events("onNotifikasi")

    OnCreate {
      PendengarNotifikasiDompet.pendengarJs = { n -> sendEvent("onNotifikasi", n.keMap()) }
    }

    OnDestroy {
      PendengarNotifikasiDompet.pendengarJs = null
    }

    Function("tersedia") {
      true
    }

    Function("izinAktif") {
      NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }

    Function("bukaPengaturanIzin") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("aktif") {
      AntreanNotifikasi.aktif(context)
    }

    Function("setAktif") { nilai: Boolean ->
      AntreanNotifikasi.setAktif(context, nilai)
    }

    Function("ambilAntrean") {
      AntreanNotifikasi.semua(context).map { it.keMap() }
    }

    Function("hapusDariAntrean") { kunci: List<String> ->
      AntreanNotifikasi.hapus(context, kunci)
    }
  }
}
