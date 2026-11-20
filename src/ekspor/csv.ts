// CSV RFC 4180: UTF-8 dengan BOM (agar Excel membaca UTF-8), pemisah koma, baris CRLF.
import type { Sel } from './xlsx';

export const MIME_CSV = 'text/csv';

const AWALAN_BERBAHAYA = /^[=+\-@\t\r]/;

/**
 * Cegah formula injection: teks yang diawali `= + - @`, tab, atau CR diberi awalan `'`
 * sehingga spreadsheet menganggapnya teks. Angka tidak diubah (nominal negatif tetap angka).
 */
export function amankanSel<T extends Sel>(s: T): T {
  if (typeof s === 'string' && AWALAN_BERBAHAYA.test(s)) return `'${s}` as T;
  return s;
}

function selCsv(v: Sel): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  const s = amankanSel(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buatCsv(baris: Sel[][]): string {
  return '﻿' + baris.map((r) => r.map(selCsv).join(',') + '\r\n').join('');
}
