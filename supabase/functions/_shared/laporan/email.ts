// Adapter pengiriman email. Bawaan hanya mencatat log; Resend aktif hanya bila dikonfigurasi.

export type PesanEmail = {
  ke: string;
  subjek: string;
  html: string;
  teks: string;
  header?: Record<string, string>;
};

export type PengirimEmail = { kirim(p: PesanEmail): Promise<{ id: string }> };

export function buatPengirimMemori(): PengirimEmail & { terkirim: PesanEmail[] } {
  const terkirim: PesanEmail[] = [];
  return {
    terkirim,
    async kirim(p) {
      terkirim.push(p);
      return { id: `memori-${terkirim.length}` };
    },
  };
}

function samarkan(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

export function buatPengirimLog(log: (baris: string) => void): PengirimEmail {
  let n = 0;
  return {
    async kirim(p) {
      n += 1;
      log(`[email:log] ke=${samarkan(p.ke)} subjek=${p.subjek}`);
      return { id: `log-${n}` };
    },
  };
}

export function buatPengirimResend(o: {
  apiKey: string;
  dari: string;
  fetch: typeof fetch;
}): PengirimEmail {
  return {
    async kirim(p) {
      const badan: Record<string, unknown> = {
        from: o.dari,
        to: [p.ke],
        subject: p.subjek,
        html: p.html,
        text: p.teks,
      };
      if (p.header) badan.headers = p.header;
      const res = await o.fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${o.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(badan),
      });
      if (res.status < 200 || res.status >= 300) throw new Error(`resend ${res.status}`);
      let id = '';
      try {
        const j = (await res.json()) as { id?: unknown };
        if (typeof j.id === 'string') id = j.id;
      } catch {
        // abaikan isi respons yang tidak valid
      }
      return { id };
    },
  };
}

export function pilihPengirim(
  env: (k: string) => string | undefined,
  fetchFn: typeof fetch,
  log: (baris: string) => void,
): PengirimEmail {
  const apiKey = env('RESEND_API_KEY');
  const dari = env('EMAIL_FROM');
  if (env('EMAIL_MODE') === 'resend' && apiKey && dari) {
    return buatPengirimResend({ apiKey, dari, fetch: fetchFn });
  }
  return buatPengirimLog(log);
}
