/// <reference types="node" />
import { DOMParser } from '@xmldom/xmldom';
import { buatZip, crc32, utf8 } from '../zip';
import { bersihkanXml, buatXlsx, hurufKolom, namaSheetAman } from '../xlsx';

type Entri = { nama: string; isi: Uint8Array; crc: number; flag: number };

/** Parser ZIP uji: baca EOCD -> central directory -> header lokal, cocokkan semua medan. */
function bacaZip(z: Uint8Array): Entri[] {
  const dv = new DataView(z.buffer, z.byteOffset, z.byteLength);
  const eocd = z.length - 22; // tanpa komentar
  expect(dv.getUint32(eocd, true)).toBe(0x06054b50);
  const jumlah = dv.getUint16(eocd + 10, true);
  expect(dv.getUint16(eocd + 8, true)).toBe(jumlah);
  const ukuranCd = dv.getUint32(eocd + 12, true);
  const awalCd = dv.getUint32(eocd + 16, true);
  expect(awalCd + ukuranCd).toBe(eocd);

  const hasil: Entri[] = [];
  let p = awalCd;
  for (let i = 0; i < jumlah; i++) {
    expect(dv.getUint32(p, true)).toBe(0x02014b50);
    const flag = dv.getUint16(p + 8, true);
    const metode = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const ukuranK = dv.getUint32(p + 20, true);
    const ukuran = dv.getUint32(p + 24, true);
    const pNama = dv.getUint16(p + 28, true);
    const pExtra = dv.getUint16(p + 30, true);
    const pKomen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const namaB = z.subarray(p + 46, p + 46 + pNama);
    p += 46 + pNama + pExtra + pKomen;

    expect(metode).toBe(0);
    expect(ukuranK).toBe(ukuran);
    // Header lokal harus sama dengan central directory.
    expect(dv.getUint32(offset, true)).toBe(0x04034b50);
    expect(dv.getUint16(offset + 6, true)).toBe(flag);
    expect(dv.getUint16(offset + 8, true)).toBe(0);
    expect(dv.getUint32(offset + 14, true)).toBe(crc);
    expect(dv.getUint32(offset + 18, true)).toBe(ukuran);
    expect(dv.getUint32(offset + 22, true)).toBe(ukuran);
    const lNama = dv.getUint16(offset + 26, true);
    const lExtra = dv.getUint16(offset + 28, true);
    expect(Buffer.from(z.subarray(offset + 30, offset + 30 + lNama)).equals(Buffer.from(namaB))).toBe(true);
    const mulai = offset + 30 + lNama + lExtra;
    const isi = z.slice(mulai, mulai + ukuran);
    expect(crc32(isi)).toBe(crc);
    hasil.push({ nama: Buffer.from(namaB).toString('utf8'), isi, crc, flag });
  }
  expect(p).toBe(eocd);
  return hasil;
}

const teks = (b: Uint8Array) => Buffer.from(b).toString('utf8');

// xmldom 0.8 longgar terhadap '&' telanjang dan karakter kontrol, jadi dicek manual juga.
function parseKetat(xml: string) {
  const galat: string[] = [];
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(xml)) galat.push("'&' tanpa entitas");
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/.test(xml)) galat.push('karakter kontrol ilegal');
  const doc = new DOMParser({
    errorHandler: {
      warning: (m: string) => galat.push(m),
      error: (m: string) => galat.push(m),
      fatalError: (m: string) => galat.push(m),
    },
  }).parseFromString(xml, 'text/xml');
  if (galat.length) throw new Error(`XML tidak valid: ${galat.join('; ')}`);
  return doc;
}

describe('crc32', () => {
  it('vektor standar', () => {
    expect(crc32('123456789')).toBe(0xcbf43926);
    expect(crc32(utf8('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
    expect(crc32('The quick brown fox jumps over the lazy dog')).toBe(0x414fa339);
  });
});

describe('utf8', () => {
  it('sama dengan Buffer, surrogate yatim -> U+FFFD', () => {
    const s = 'Rp288.000 ü € 😀 中';
    expect(Buffer.from(utf8(s)).equals(Buffer.from(s, 'utf8'))).toBe(true);
    expect(teks(utf8('a\uD800b'))).toBe('a�b');
  });
});

describe('buatZip', () => {
  it('bisa di-parse ulang: nama, CRC, isi, flag UTF-8', () => {
    const berkas = [
      { nama: 'a.txt', isi: utf8('halo') },
      { nama: 'folder/ü €.txt', isi: utf8('isi\r\nbaris') },
      { nama: 'kosong', isi: new Uint8Array(0) },
    ];
    const z = buatZip(berkas);
    const e = bacaZip(z);
    expect(e.map((x) => x.nama)).toEqual(berkas.map((b) => b.nama));
    e.forEach((x, i) => {
      expect(x.flag & 0x0800).toBe(0x0800);
      expect(x.crc).toBe(crc32(berkas[i].isi));
      expect(teks(x.isi)).toBe(teks(berkas[i].isi));
    });
  });

  it('arsip kosong tetap punya EOCD', () => {
    expect(bacaZip(buatZip([]))).toEqual([]);
  });
});

describe('hurufKolom', () => {
  it('A..Z, AA.., sampai XFD', () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702, 16383].map(hurufKolom)).toEqual([
      'A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA', 'XFD',
    ]);
  });
});

describe('namaSheetAman', () => {
  it('membuang []:*?/\\, maks 31 karakter, unik tanpa beda huruf', () => {
    const n = namaSheetAman(['Tr[a]n:s*a?k/s\\i', 'x'.repeat(40), 'x'.repeat(40), 'Dompet', 'dompet', '', "'kutip'", 'Dompet/[x]']);
    expect(n[0]).toBe('Tr a n s a k s i');
    expect(n[1]).toBe('x'.repeat(31));
    expect(n[2]).toBe(`${'x'.repeat(27)} (2)`);
    expect(n[2].length).toBe(31);
    expect(n[3]).toBe('Dompet');
    expect(n[4]).toBe('dompet (2)');
    expect(n[5]).toBe('Sheet');
    expect(n[6]).toBe('kutip');
    expect(n[7]).toBe('Dompet x');
  });
});

describe('bersihkanXml', () => {
  it('membuang kontrol ilegal, mempertahankan tab/LF/CR dan emoji', () => {
    expect(bersihkanXml('a\u0000b\u0001c\u000Bd\u001Fe\tf\ng\rh￾i😀\uDC00')).toBe('abcde\tf\ng\rhi😀');
  });
});

describe('buatXlsx', () => {
  const lebar = Array.from({ length: 28 }, (_, i) => (i === 27 ? 'akhir' : null));
  const z = buatXlsx([
    {
      nama: 'Transaksi',
      baris: [
        ['Tanggal', 'Catatan', 'Nominal'],
        ['2026-11-20', 'Makan <&> "enak" \'ya\'\u0007', 288000],
        ['2026-11-21', '=1+1', -5000],
        ['2026-11-22', null, 0],
        lebar,
      ],
    },
    { nama: 'Dompet', baris: [['Nama']] },
    { nama: 'Kosong', baris: [] },
  ]);
  const entri = bacaZip(z);
  const isi = (nama: string) => {
    const e = entri.find((x) => x.nama === nama);
    if (!e) throw new Error(`tidak ada ${nama}`);
    return teks(e.isi);
  };

  it('berisi entri OOXML yang diharapkan, semuanya XML valid', () => {
    expect(entri.map((e) => e.nama)).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
      'xl/worksheets/sheet3.xml',
    ]);
    for (const e of entri) expect(() => parseKetat(teks(e.isi))).not.toThrow();
  });

  it('pemeriksa XML menolak XML rusak', () => {
    expect(() => parseKetat('<a><b>x & y</b></a>')).toThrow();
    expect(() => parseKetat('<a><b>x</a>')).toThrow();
    expect(() => parseKetat('<a>\u0007</a>')).toThrow();
  });

  it('teks <&>" ter-escape dan kembali utuh; karakter kontrol dibuang', () => {
    const doc = parseKetat(isi('xl/worksheets/sheet1.xml'));
    const sel = Array.from(doc.getElementsByTagName('c'));
    const b2 = sel.find((c) => c.getAttribute('r') === 'B2')!;
    expect(b2.getAttribute('t')).toBe('inlineStr');
    expect(b2.getElementsByTagName('t')[0].getAttribute('xml:space')).toBe('preserve');
    expect(b2.textContent).toBe('Makan <&> "enak" \'ya\'');
  });

  it('angka sebagai <v> tanpa tipe teks; teks rumus tetap inlineStr', () => {
    const doc = parseKetat(isi('xl/worksheets/sheet1.xml'));
    const sel = (r: string) => Array.from(doc.getElementsByTagName('c')).find((c) => c.getAttribute('r') === r);
    expect(sel('C2')!.hasAttribute('t')).toBe(false);
    expect(sel('C2')!.getElementsByTagName('v')[0].textContent).toBe('288000');
    expect(sel('C3')!.getElementsByTagName('v')[0].textContent).toBe('-5000');
    expect(sel('C4')!.getElementsByTagName('v')[0].textContent).toBe('0');
    expect(sel('B3')!.getAttribute('t')).toBe('inlineStr');
    expect(sel('B3')!.getElementsByTagName('f').length).toBe(0);
    expect(sel('B4')).toBeUndefined(); // null dilewati
    expect(sel('AB5')!.textContent).toBe('akhir');
  });

  it('header baris pertama tebal (s="1" -> font bold)', () => {
    const doc = parseKetat(isi('xl/worksheets/sheet1.xml'));
    const baris = Array.from(doc.getElementsByTagName('row'));
    for (const c of Array.from(baris[0].getElementsByTagName('c'))) expect(c.getAttribute('s')).toBe('1');
    for (const c of Array.from(baris[1].getElementsByTagName('c'))) expect(c.hasAttribute('s')).toBe(false);
    const st = parseKetat(isi('xl/styles.xml'));
    const xf = st.getElementsByTagName('cellXfs')[0].getElementsByTagName('xf');
    expect(xf.length).toBe(2);
    const font = st.getElementsByTagName('fonts')[0].getElementsByTagName('font');
    expect(font[Number(xf[1].getAttribute('fontId'))].getElementsByTagName('b').length).toBe(1);
  });

  it('workbook, rels, dan content types saling cocok', () => {
    const wb = parseKetat(isi('xl/workbook.xml'));
    const sheets = Array.from(wb.getElementsByTagName('sheet'));
    expect(sheets.map((s) => s.getAttribute('name'))).toEqual(['Transaksi', 'Dompet', 'Kosong']);
    const rels = Array.from(parseKetat(isi('xl/_rels/workbook.xml.rels')).getElementsByTagName('Relationship'));
    for (const s of sheets) {
      const rel = rels.find((r) => r.getAttribute('Id') === s.getAttribute('r:id'))!;
      expect(entri.some((e) => e.nama === `xl/${rel.getAttribute('Target')}`)).toBe(true);
    }
    expect(rels.some((r) => r.getAttribute('Target') === 'styles.xml')).toBe(true);
    const ct = isi('[Content_Types].xml');
    for (const e of entri.filter((x) => x.nama.startsWith('xl/') && !x.nama.includes('_rels'))) {
      expect(ct).toContain(`PartName="/${e.nama}"`);
    }
  });

  it('butuh minimal satu sheet', () => {
    expect(() => buatXlsx([])).toThrow();
  });
});
