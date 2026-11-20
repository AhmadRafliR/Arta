// Penulis XLSX minimal (SpreadsheetML) tanpa dependensi.
// Teks = inlineStr (tidak pernah dievaluasi sebagai rumus), angka = <v>, baris pertama tebal.
import { buatZip, utf8 } from './zip';

export type Sel = string | number | null;
export type Sheet = { nama: string; baris: Sel[][] };

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const BATAS_TEKS_SEL = 32767; // batas Excel per sel

/** Indeks kolom 0-based -> huruf kolom: 0 = A, 25 = Z, 26 = AA, 701 = ZZ, 702 = AAA. */
export function hurufKolom(i: number): string {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Buang karakter yang tidak sah di XML 1.0 (kontrol C0 selain tab/LF/CR, U+FFFE/FFFF, surrogate yatim). */
export function bersihkanXml(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (d >= 0xdc00 && d <= 0xdfff) {
        out += s[i] + s[i + 1];
        i++;
      }
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue;
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) continue;
    if (c === 0xfffe || c === 0xffff) continue;
    out += s[i];
  }
  return out;
}

export function escapeXml(s: string): string {
  return bersihkanXml(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Nama sheet: tanpa []:*?/\, tanpa apostrof di ujung, maks 31 karakter, unik (tanpa beda huruf besar). */
export function namaSheetAman(nama: string[]): string[] {
  const dipakai = new Set<string>();
  return nama.map((n) => {
    let dasar = bersihkanXml(n)
      .replace(/[[\]:*?/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^'+|'+$/g, '')
      .trim();
    if (!dasar) dasar = 'Sheet';
    let hasil = dasar.slice(0, 31);
    for (let k = 2; dipakai.has(hasil.toLowerCase()); k++) {
      const akhiran = ` (${k})`;
      hasil = dasar.slice(0, 31 - akhiran.length).trimEnd() + akhiran;
    }
    dipakai.add(hasil.toLowerCase());
    return hasil;
  });
}

function xmlSel(ref: string, v: Sel, tebal: boolean): string {
  const s = tebal ? ' s="1"' : '';
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    return `<c r="${ref}"${s}><v>${String(v)}</v></c>`;
  }
  const teks = escapeXml(String(v).slice(0, BATAS_TEKS_SEL));
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${teks}</t></is></c>`;
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

function xmlWorksheet(baris: Sel[][]): string {
  const rows = baris
    .map((r, i) => {
      const n = i + 1;
      const sel = r.map((v, j) => xmlSel(`${hurufKolom(j)}${n}`, v, i === 0)).join('');
      return `<row r="${n}">${sel}</row>`;
    })
    .join('');
  // Bekukan baris header bila ada data di bawahnya.
  const beku =
    baris.length > 1
      ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
      : '';
  return `${XML}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">${beku}<sheetData>${rows}</sheetData></worksheet>`;
}

const STYLES =
  `${XML}<styleSheet xmlns="${NS_MAIN}">` +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

/** Buat berkas .xlsx; satu sheet per elemen. Baris pertama tiap sheet ditulis tebal (header). */
export function buatXlsx(sheet: Sheet[]): Uint8Array {
  if (sheet.length === 0) throw new Error('XLSX butuh minimal satu sheet.');
  const nama = namaSheetAman(sheet.map((s) => s.nama));

  const contentTypes =
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheet
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join('') +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>';

  const rels =
    `${XML}<Relationships xmlns="${NS_PKG_REL}">` +
    `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
    '</Relationships>';

  const workbook =
    `${XML}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>` +
    nama.map((n, i) => `<sheet name="${escapeXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    '</sheets></workbook>';

  const workbookRels =
    `${XML}<Relationships xmlns="${NS_PKG_REL}">` +
    sheet
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('') +
    `<Relationship Id="rId${sheet.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/>` +
    '</Relationships>';

  return buatZip([
    { nama: '[Content_Types].xml', isi: utf8(contentTypes) },
    { nama: '_rels/.rels', isi: utf8(rels) },
    { nama: 'xl/workbook.xml', isi: utf8(workbook) },
    { nama: 'xl/_rels/workbook.xml.rels', isi: utf8(workbookRels) },
    { nama: 'xl/styles.xml', isi: utf8(STYLES) },
    ...sheet.map((s, i) => ({ nama: `xl/worksheets/sheet${i + 1}.xml`, isi: utf8(xmlWorksheet(s.baris)) })),
  ]);
}
