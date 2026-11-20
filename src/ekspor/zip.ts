// Penulis ZIP minimal tanpa dependensi: metode store (tanpa kompresi), nama berkas UTF-8 (bit 11).
// Cukup untuk kontainer XLSX; tidak mendukung ZIP64 (batas 4 GB / 65535 entri).

export type BerkasZip = { nama: string; isi: Uint8Array };

/** Encode UTF-8. Surrogate yang tidak berpasangan menjadi U+FFFD. */
export function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      } else c = 0xfffd;
    } else if (c >= 0xdc00 && c <= 0xdfff) c = 0xfffd;

    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

let TABEL_CRC: Uint32Array | null = null;
function tabelCrc(): Uint32Array {
  if (TABEL_CRC) return TABEL_CRC;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  TABEL_CRC = t;
  return t;
}

/** CRC-32 (IEEE 802.3), sama dengan yang dipakai ZIP. String di-encode UTF-8 dulu. */
export function crc32(data: Uint8Array | string): number {
  const bytes = typeof data === 'string' ? utf8(data) : data;
  const t = tabelCrc();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const FLAG_UTF8 = 0x0800;
const VERSI = 20; // 2.0
// Waktu DOS tetap (1980-01-01 00:00) agar keluaran deterministik; isi XLSX tidak bergantung padanya.
const DOS_WAKTU = 0;
const DOS_TANGGAL = (0 << 9) | (1 << 5) | 1;

/** Gabungkan berkas menjadi arsip ZIP (store). */
export function buatZip(berkas: BerkasZip[]): Uint8Array {
  if (berkas.length > 0xffff) throw new Error('Terlalu banyak berkas untuk ZIP.');
  const entri = berkas.map((b) => ({ nama: utf8(b.nama), isi: b.isi, crc: crc32(b.isi) }));

  let total = 22; // end of central directory
  for (const e of entri) total += 30 + e.nama.length + e.isi.length + 46 + e.nama.length;
  if (total > 0xffffffff) throw new Error('Arsip ZIP terlalu besar.');

  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  let p = 0;
  const u16 = (v: number) => {
    dv.setUint16(p, v, true);
    p += 2;
  };
  const u32 = (v: number) => {
    dv.setUint32(p, v >>> 0, true);
    p += 4;
  };
  const tulis = (b: Uint8Array) => {
    out.set(b, p);
    p += b.length;
  };

  const offset: number[] = [];
  for (const e of entri) {
    offset.push(p);
    u32(0x04034b50); // local file header
    u16(VERSI);
    u16(FLAG_UTF8);
    u16(0); // store
    u16(DOS_WAKTU);
    u16(DOS_TANGGAL);
    u32(e.crc);
    u32(e.isi.length);
    u32(e.isi.length);
    u16(e.nama.length);
    u16(0); // extra
    tulis(e.nama);
    tulis(e.isi);
  }

  const awalCd = p;
  entri.forEach((e, i) => {
    u32(0x02014b50); // central directory header
    u16(VERSI); // made by: MS-DOS, 2.0
    u16(VERSI);
    u16(FLAG_UTF8);
    u16(0);
    u16(DOS_WAKTU);
    u16(DOS_TANGGAL);
    u32(e.crc);
    u32(e.isi.length);
    u32(e.isi.length);
    u16(e.nama.length);
    u16(0); // extra
    u16(0); // komentar
    u16(0); // disk
    u16(0); // atribut internal
    u32(0); // atribut eksternal
    u32(offset[i]);
    tulis(e.nama);
  });
  const ukuranCd = p - awalCd;

  u32(0x06054b50); // end of central directory
  u16(0);
  u16(0);
  u16(entri.length);
  u16(entri.length);
  u32(ukuranCd);
  u32(awalCd);
  u16(0); // komentar
  return out;
}
