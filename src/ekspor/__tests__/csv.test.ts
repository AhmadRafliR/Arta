import { amankanSel, buatCsv } from '../csv';

describe('amankanSel', () => {
  it('teks berawalan = + - @ tab CR diberi awalan apostrof', () => {
    for (const s of ['=1+1', '+62812', '-50rb', '@SUM(A1)', '\t=1', '\r=1']) expect(amankanSel(s)).toBe(`'${s}`);
  });
  it('teks biasa, angka (termasuk negatif), dan null tidak diubah', () => {
    expect(amankanSel('Makan siang = enak')).toBe('Makan siang = enak');
    expect(amankanSel(-5000)).toBe(-5000);
    expect(amankanSel(null)).toBeNull();
    expect(amankanSel('')).toBe('');
  });
});

describe('buatCsv', () => {
  it('BOM, CRLF, kutip RFC 4180', () => {
    const csv = buatCsv([
      ['Tanggal', 'Catatan', 'Nominal'],
      ['2026-11-20', 'Makan, "enak"\nbaris 2', 288000],
      ['2026-11-21', null, -5000],
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe(
      'Tanggal,Catatan,Nominal\r\n' + '2026-11-20,"Makan, ""enak""\nbaris 2",288000\r\n' + '2026-11-21,,-5000\r\n',
    );
  });

  it('formula injection dinetralkan, juga di dalam kutip', () => {
    const csv = buatCsv([['=HYPERLINK("http://x","klik")', '@a', '+1', '-1', 'aman']]);
    expect(csv.slice(1)).toBe(`"'=HYPERLINK(""http://x"",""klik"")",'@a,'+1,'-1,aman\r\n`);
  });

  it('CR di tengah teks dikutip', () => {
    expect(buatCsv([['a\rb']]).slice(1)).toBe('"a\rb"\r\n');
  });
});
