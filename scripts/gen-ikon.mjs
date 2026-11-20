// Membangun src/components/ikon/data.ts dari docs/design/arta/icons.json.
// Deterministik: urutan sesuai sumber, tanpa stempel waktu.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const akar = join(dirname(fileURLToPath(import.meta.url)), '..');
const sumber = join(akar, 'docs/design/arta/icons.json');
const tujuan = join(akar, 'src/components/ikon/data.ts');

const ikon = JSON.parse(readFileSync(sumber, 'utf8'));
const q = (s) => `'${String(s).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

function parseElemen(isi, slug) {
  const hasil = [];
  const re = /<(path|circle|rect)\s+([^>]*?)\s*(?:\/>|>\s*<\/\1>)/g;
  let sisa = isi;
  for (const m of isi.matchAll(re)) {
    sisa = sisa.replace(m[0], '');
    const attr = {};
    for (const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g)) attr[a[1]] = a[2];
    const kelas = attr.class;
    delete attr.class;
    if (kelas !== 'ln' && kelas !== 'fill') {
      throw new Error(`${slug}: kelas tak dikenal "${kelas}"`);
    }
    hasil.push({ tag: m[1], kelas, attr });
  }
  if (sisa.trim() !== '') throw new Error(`${slug}: markup tak dikenali: ${sisa.trim()}`);
  return hasil;
}

const baris = [];
baris.push('// DIHASILKAN oleh scripts/gen-ikon.mjs dari docs/design/arta/icons.json.');
baris.push('// Jangan diedit tangan; jalankan `npm run gen:ikon`.');
baris.push('');
baris.push('export type Elemen = {');
baris.push("  tag: 'path' | 'circle' | 'rect';");
baris.push("  kelas: 'ln' | 'fill';");
baris.push('  attr: Record<string, string>;');
baris.push('};');
baris.push('');
baris.push('export type NamaIkon =');
for (const i of ikon) baris.push(`  | ${q(i.slug)}`);
baris[baris.length - 1] += ';';
baris.push('');
baris.push('export const IKON: Record<NamaIkon, Elemen[]> = {');
for (const i of ikon) {
  baris.push(`  ${q(i.slug)}: [`);
  for (const e of parseElemen(i.isi, i.slug)) {
    const attr = Object.entries(e.attr)
      .map(([k, v]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : q(k)}: ${q(v)}`)
      .join(', ');
    baris.push(`    { tag: ${q(e.tag)}, kelas: ${q(e.kelas)}, attr: { ${attr} } },`);
  }
  baris.push('  ],');
}
baris.push('};');
baris.push('');

writeFileSync(tujuan, baris.join('\n'));
console.log(`ikon: ${ikon.length} -> ${tujuan}`);
