/// <reference types="node" />
import fs from 'fs';
import path from 'path';

const akar = path.resolve(__dirname, '../..');

function kumpul(dir: string, hasil: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      kumpul(p, hasil);
    } else if (e.name.endsWith('.tsx')) hasil.push(p);
  }
  return hasil;
}

describe('font-sans pada Text/TextInput', () => {
  it('setiap tag <Text / <TextInput memuat font-sans', () => {
    const gagal: string[] = [];
    const files = [...kumpul(path.join(akar, 'app')), ...kumpul(path.join(akar, 'src'))];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      const re = /<(Text|TextInput)(?=[\s>/])/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        // Cari '>' penutup tag di luar kurung kurawal.
        let i = m.index + m[0].length;
        let depth = 0;
        for (; i < src.length; i++) {
          const c = src[i];
          if (c === '{') depth++;
          else if (c === '}') depth--;
          else if (c === '>' && depth === 0 && src[i - 1] !== '=') break;
        }
        const tag = src.slice(m.index, i + 1);
        if (!/className=(?:"[^"]*|'[^']*|\{[^}]*)font-sans/.test(tag)) {
          const baris = src.slice(0, m.index).split('\n').length;
          gagal.push(`${path.relative(akar, f)}:${baris}`);
        }
      }
    }
    expect(gagal).toEqual([]);
  });
});

describe('app.json', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(akar, 'app.json'), 'utf8')).expo;
  it('nama dan slug', () => {
    expect(cfg.name).toBe('arta');
    expect(cfg.slug).toBe('keuangan-app');
  });
  it('plugin expo-font dengan 4 bobot', () => {
    const entri = cfg.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-font');
    expect(entri).toBeDefined();
    const fonts = entri[1].android.fonts;
    expect(fonts[0].fontFamily).toBe('NunitoSans');
    expect(fonts[0].fontDefinitions.map((d: { weight: number }) => d.weight)).toEqual([400, 600, 700, 800]);
  });
});
