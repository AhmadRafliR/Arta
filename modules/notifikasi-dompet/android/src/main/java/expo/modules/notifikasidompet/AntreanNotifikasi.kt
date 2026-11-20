package expo.modules.notifikasidompet

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Satu notifikasi mentah dari aplikasi dompet. */
data class NotifikasiMentah(
  val kunci: String,
  val paket: String,
  val judul: String,
  val teks: String,
  val waktu: Long
) {
  fun keMap(): Map<String, Any?> = mapOf(
    "kunci" to kunci,
    "paket" to paket,
    "judul" to judul,
    "teks" to teks,
    // Double agar aman dikonversi ke number JS (epoch ms muat di 53 bit).
    "waktu" to waktu.toDouble()
  )
}

/**
 * Antrean notifikasi di SharedPreferences (JSON array). Semua akses disinkronkan
 * pada satu kunci karena service dan modul JS berjalan di thread berbeda.
 */
object AntreanNotifikasi {
  private const val NAMA_PREFS = "notifikasi_dompet"
  private const val KUNCI_ANTREAN = "antrean"
  private const val KUNCI_AKTIF = "aktif"
  const val MAKS_ITEM = 300

  private val kunciKunci = Any()

  private fun prefs(context: Context) =
    context.applicationContext.getSharedPreferences(NAMA_PREFS, Context.MODE_PRIVATE)

  fun aktif(context: Context): Boolean =
    prefs(context).getBoolean(KUNCI_AKTIF, false)

  fun setAktif(context: Context, nilai: Boolean) {
    prefs(context).edit().putBoolean(KUNCI_AKTIF, nilai).apply()
  }

  private fun baca(context: Context): MutableList<NotifikasiMentah> {
    val mentah = prefs(context).getString(KUNCI_ANTREAN, null) ?: return mutableListOf()
    val hasil = mutableListOf<NotifikasiMentah>()
    try {
      val arr = JSONArray(mentah)
      for (i in 0 until arr.length()) {
        val o = arr.optJSONObject(i) ?: continue
        hasil.add(
          NotifikasiMentah(
            kunci = o.optString("kunci", ""),
            paket = o.optString("paket", ""),
            judul = o.optString("judul", ""),
            teks = o.optString("teks", ""),
            waktu = o.optLong("waktu", 0L)
          )
        )
      }
    } catch (e: Exception) {
      // Data rusak: mulai dari antrean kosong.
      return mutableListOf()
    }
    return hasil
  }

  private fun tulis(context: Context, daftar: List<NotifikasiMentah>) {
    val arr = JSONArray()
    for (n in daftar) {
      arr.put(
        JSONObject()
          .put("kunci", n.kunci)
          .put("paket", n.paket)
          .put("judul", n.judul)
          .put("teks", n.teks)
          .put("waktu", n.waktu)
      )
    }
    prefs(context).edit().putString(KUNCI_ANTREAN, arr.toString()).apply()
  }

  /** Tambah ke antrean. Mengembalikan false bila kunci sudah ada (duplikat). */
  fun tambah(context: Context, n: NotifikasiMentah): Boolean {
    synchronized(kunciKunci) {
      val daftar = baca(context)
      if (daftar.any { it.kunci == n.kunci }) return false
      daftar.add(n)
      daftar.sortBy { it.waktu }
      while (daftar.size > MAKS_ITEM) daftar.removeAt(0)
      tulis(context, daftar)
      return true
    }
  }

  /** Seluruh antrean, urut waktu naik. */
  fun semua(context: Context): List<NotifikasiMentah> {
    synchronized(kunciKunci) {
      return baca(context).sortedBy { it.waktu }
    }
  }

  fun hapus(context: Context, kunci: List<String>) {
    if (kunci.isEmpty()) return
    val set = kunci.toHashSet()
    synchronized(kunciKunci) {
      val daftar = baca(context)
      val sisa = daftar.filter { it.kunci !in set }
      if (sisa.size != daftar.size) tulis(context, sisa)
    }
  }
}
