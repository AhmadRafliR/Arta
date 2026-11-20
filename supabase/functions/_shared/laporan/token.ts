// Token HMAC untuk tautan verifikasi / berhenti berlangganan.
// Format: tujuan.recipientId.exp.sig, sig = tandatangan(`tujuan.recipientId.email.exp`).

export type Tujuan = 'verif' | 'henti';

export const MASA_VERIF = 7 * 86400;
export const MASA_HENTI = 400 * 86400;

export type Tandatangan = (pesan: string) => Promise<string>;

export type HasilToken =
  | { ok: true; tujuan: Tujuan; recipientId: string }
  | { ok: false; alasan: 'format' | 'kedaluwarsa' | 'tidak_ditemukan' | 'tanda_tangan' };

const pesanDari = (tujuan: string, recipientId: string, email: string, exp: number | string) =>
  `${tujuan}.${recipientId}.${email}.${exp}`;

export async function buatToken(
  t: { tujuan: Tujuan; recipientId: string; email: string; exp: number },
  tandatangan: Tandatangan,
): Promise<string> {
  const sig = await tandatangan(pesanDari(t.tujuan, t.recipientId, t.email, t.exp));
  return `${t.tujuan}.${t.recipientId}.${t.exp}.${sig}`;
}

// Perbandingan waktu-konstan (tidak berhenti di beda pertama).
function samaKonstan(a: string, b: string): boolean {
  let beda = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    beda |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return beda === 0;
}

export async function bacaToken(
  token: string,
  ambilEmail: (recipientId: string) => Promise<string | null>,
  tandatangan: Tandatangan,
  sekarangDetik: number,
): Promise<HasilToken> {
  const bagian = token.split('.');
  if (bagian.length !== 4) return { ok: false, alasan: 'format' };
  const [tujuan, recipientId, expStr, sig] = bagian;
  if (tujuan !== 'verif' && tujuan !== 'henti') return { ok: false, alasan: 'format' };
  if (!recipientId || !sig || !/^\d+$/.test(expStr)) return { ok: false, alasan: 'format' };
  const exp = Number(expStr);
  if (!Number.isSafeInteger(exp)) return { ok: false, alasan: 'format' };
  if (sekarangDetik > exp) return { ok: false, alasan: 'kedaluwarsa' };
  const email = await ambilEmail(recipientId);
  if (email === null) return { ok: false, alasan: 'tidak_ditemukan' };
  const harapan = await tandatangan(pesanDari(tujuan, recipientId, email, exp));
  if (!samaKonstan(harapan, sig)) return { ok: false, alasan: 'tanda_tangan' };
  return { ok: true, tujuan, recipientId };
}
