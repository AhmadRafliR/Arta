// Format manual (tanpa Intl) agar konsisten di Jest/Hermes.
function titikRibuan(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatRupiah(n: number): string {
  const abs = Math.abs(Math.round(n));
  return `${n < 0 ? '-' : ''}Rp${titikRibuan(abs)}`;
}

function desimalKoma(x: number): string {
  return String(Math.round(x * 10) / 10).replace('.', ',');
}

export function formatRingkas(n: number): string {
  const tanda = n < 0 ? '-' : '';
  const abs = Math.abs(Math.round(n));
  if (abs >= 1_000_000) return `${tanda}${desimalKoma(abs / 1_000_000)}jt`;
  if (abs >= 1_000) return `${tanda}${desimalKoma(abs / 1_000)}rb`;
  return `${tanda}${abs}`;
}

export function parseNominal(input: string): number | null {
  const s = input.toLowerCase().replace(/rp/g, '').replace(/\s+/g, '');
  const m = /^(\d+(?:[.,]\d+)*)(rb|ribu|k|jt|juta)?$/.exec(s);
  if (!m) return null;
  const [, angka, akhiran] = m;
  let nilai: number;
  if (akhiran) {
    const faktor = akhiran === 'jt' || akhiran === 'juta' ? 1_000_000 : 1_000;
    // koma = desimal; titik sebagai pemisah ribuan dibuang
    const norm = angka.includes(',') ? angka.replace(/\./g, '').replace(',', '.') : angka;
    if (!/^\d+(\.\d+)?$/.test(norm)) return null;
    nilai = Number(norm) * faktor;
  } else {
    nilai = Number(angka.replace(/[.,]/g, ''));
  }
  const bulat = Math.round(nilai);
  if (!Number.isFinite(bulat) || Math.abs(nilai - bulat) > 1e-6 || bulat <= 0 || bulat > Number.MAX_SAFE_INTEGER) return null;
  return bulat;
}
