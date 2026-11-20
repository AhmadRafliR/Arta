import { formatRupiah, type IsiLaporan } from './isi.ts';

const TEKS = '#0B424F';
const AKSEN = '#52C3BF';
const LATAR = '#EEF3F5';
const BAHAYA = '#B3261E';
const PERINGATAN = '#9A6700';
const REDUP = '#52707A';

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LABEL_STATUS = { aman: 'Aman', waspada: 'Waspada', lewat: 'Lewat' } as const;
const WARNA_STATUS = { aman: TEKS, waspada: PERINGATAN, lewat: BAHAYA } as const;

const TD = `padding:8px 0;border-bottom:1px solid ${LATAR};font-size:14px;color:${TEKS};`;

function bagian(judul: string, isi: string): string {
  return (
    `<tr><td style="padding:20px 24px 4px 24px;">` +
    `<div style="font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${AKSEN};padding-bottom:6px;">${esc(judul)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${isi}</table>` +
    `</td></tr>`
  );
}

// kiri dan kanan sudah berupa HTML aman.
function baris(kiri: string, kanan: string, tebal = false): string {
  const w = tebal ? 'font-weight:bold;' : '';
  return (
    `<tr><td style="${TD}${w}">${kiri}</td>` +
    `<td align="right" style="${TD}${w}">${kanan}</td></tr>`
  );
}

export function renderLaporan(
  isi: IsiLaporan,
  opsi: { urlBerhenti: string; namaApp?: 'arta' },
): { subjek: string; html: string; teks: string } {
  const app = opsi.namaApp ?? 'arta';
  const subjek = `Laporan keuangan ${isi.labelBulan} · ${isi.nama ?? app}`;
  const r = isi.ringkasan;
  const bagianHtml: string[] = [];
  const t: string[] = [subjek, `Sampai ${isi.sampai}`, ''];

  const ringkas: [string, number][] = [
    ['Pemasukan', r.pemasukan],
    ['Pengeluaran', r.pengeluaran],
    ['Selisih', r.selisih],
    ['Setor dana darurat', r.setorDarurat],
    ['Tarik dana darurat', r.tarikDarurat],
    ['Bayar hutang', r.bayarHutang],
    ['Total saldo semua dompet', r.totalSaldo],
  ];
  bagianHtml.push(
    bagian(
      'Ringkasan',
      ringkas.map(([k, v]) => baris(esc(k), esc(formatRupiah(v)), k === 'Selisih')).join(''),
    ),
  );
  t.push('RINGKASAN', ...ringkas.map(([k, v]) => `${k}: ${formatRupiah(v)}`), '');

  if (isi.kategori.length > 0) {
    bagianHtml.push(
      bagian(
        'Pengeluaran per kategori',
        isi.kategori
          .map((k) => {
            const sisi =
              k.status && k.batas !== null
                ? ` <span style="color:${WARNA_STATUS[k.status]};font-weight:bold;">${LABEL_STATUS[k.status]}</span> (${k.persen}% dari ${esc(formatRupiah(k.batas))})`
                : '';
            return baris(`${esc(k.kategori)}${sisi}`, esc(formatRupiah(k.total)));
          })
          .join(''),
      ),
    );
    t.push(
      'PENGELUARAN PER KATEGORI',
      ...isi.kategori.map((k) => {
        const s =
          k.status && k.batas !== null
            ? ` [${LABEL_STATUS[k.status]}, ${k.persen}% dari ${formatRupiah(k.batas)}]`
            : '';
        return `${k.kategori}: ${formatRupiah(k.total)}${s}`;
      }),
      '',
    );
  }

  if (isi.terbesar.length > 0) {
    const ket = (x: IsiLaporan['terbesar'][number]) =>
      [x.tanggal, x.kategori, x.catatan, x.dompet].filter(Boolean).join(' · ');
    bagianHtml.push(
      bagian(
        'Pengeluaran terbesar',
        isi.terbesar.map((x) => baris(esc(ket(x)), esc(formatRupiah(x.nominal)))).join(''),
      ),
    );
    t.push(
      'PENGELUARAN TERBESAR',
      ...isi.terbesar.map((x) => `${ket(x)}: ${formatRupiah(x.nominal)}`),
      '',
    );
  }

  if (isi.danaDarurat) {
    const d = isi.danaDarurat;
    let h = baris('Saldo', esc(formatRupiah(d.saldo)));
    const tt = [`Saldo: ${formatRupiah(d.saldo)}`];
    if (d.target !== null) {
      h += baris('Target', esc(formatRupiah(d.target)));
      tt.push(`Target: ${formatRupiah(d.target)}`);
    }
    if (d.persen !== null) {
      h += baris('Tercapai', `${d.persen}%`);
      tt.push(`Tercapai: ${d.persen}%`);
    }
    bagianHtml.push(bagian('Dana darurat', h));
    t.push('DANA DARURAT', ...tt, '');
  }

  if (isi.investasi.length > 0) {
    const arah = (u: number) => (u >= 0 ? 'untung' : 'rugi');
    bagianHtml.push(
      bagian(
        'Investasi',
        isi.investasi
          .map((i) =>
            baris(
              esc(i.nama),
              `${esc(formatRupiah(i.nilai))} (${arah(i.untung)} ${esc(formatRupiah(Math.abs(i.untung)))})`,
            ),
          )
          .join(''),
      ),
    );
    t.push(
      'INVESTASI',
      ...isi.investasi.map(
        (i) => `${i.nama}: ${formatRupiah(i.nilai)} (${arah(i.untung)} ${formatRupiah(Math.abs(i.untung))})`,
      ),
      '',
    );
  }

  if (isi.hutang && isi.hutang.length > 0) {
    bagianHtml.push(
      bagian(
        'Hutang',
        isi.hutang
          .map((h) => {
            const tempo = h.jatuhTempo
              ? ` <span style="color:${REDUP};">jatuh tempo ${esc(h.jatuhTempo)}${h.nominal !== null ? ` · ${esc(formatRupiah(h.nominal))}` : ''}</span>`
              : '';
            return baris(`${esc(h.pemberi)}${tempo}`, esc(formatRupiah(h.sisa)));
          })
          .join('') + baris('Total hutang', esc(formatRupiah(isi.totalHutang)), true),
      ),
    );
    t.push(
      'HUTANG',
      ...isi.hutang.map(
        (h) =>
          `${h.pemberi}: ${formatRupiah(h.sisa)}${h.jatuhTempo ? ` (jatuh tempo ${h.jatuhTempo}${h.nominal !== null ? `, ${formatRupiah(h.nominal)}` : ''})` : ''}`,
      ),
      `Total hutang: ${formatRupiah(isi.totalHutang)}`,
      '',
    );
  }

  bagianHtml.push(
    bagian(
      'Kekayaan bersih',
      baris('Total saldo dikurangi hutang', esc(formatRupiah(isi.kekayaanBersih)), true),
    ),
  );
  t.push(`KEKAYAAN BERSIH: ${formatRupiah(isi.kekayaanBersih)}`, '');

  const siapa = isi.nama ?? 'pemilik akun';
  const catatanKaki = `Kamu menerima email ini karena ${siapa} menambahkanmu sebagai penerima laporan di ${app}.`;
  t.push(catatanKaki, `Berhenti menerima: ${opsi.urlBerhenti}`);

  const html =
    `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subjek)}</title></head>` +
    `<body style="margin:0;padding:0;background:${LATAR};font-family:Arial,Helvetica,sans-serif;color:${TEKS};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LATAR};"><tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#FFFFFF;border-radius:12px;border-collapse:separate;">` +
    `<tr><td style="padding:24px;border-bottom:4px solid ${AKSEN};">` +
    `<div style="font-size:13px;font-weight:bold;color:${AKSEN};letter-spacing:2px;">${esc(app.toUpperCase())}</div>` +
    `<div style="font-size:22px;font-weight:bold;color:${TEKS};padding-top:6px;">Laporan keuangan ${esc(isi.labelBulan)}</div>` +
    `<div style="font-size:13px;color:${REDUP};padding-top:4px;">${esc(isi.nama ?? app)} · sampai ${esc(isi.sampai)}</div>` +
    `</td></tr>` +
    bagianHtml.join('') +
    `<tr><td style="padding:24px;font-size:12px;color:${REDUP};">${esc(catatanKaki)}<br>` +
    `<a href="${esc(opsi.urlBerhenti)}" style="color:${TEKS};">Berhenti menerima laporan</a></td></tr>` +
    `</table></td></tr></table></body></html>`;

  return { subjek, html, teks: t.join('\n') };
}
