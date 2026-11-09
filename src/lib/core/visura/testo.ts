/**
 * Estrazione del testo con le posizioni da un PDF (pdf.js, caricato solo quando serve).
 * Coordinate PDF: origine in basso a sinistra, y cresce verso l'alto.
 */

export interface ElementoTesto {
  testo: string;
  x: number;
  y: number;
  /** larghezza e altezza (corpo del carattere) */
  w: number;
  h: number;
  pagina: number;
  /** ordine nel flusso del contenuto (globale sul documento) */
  ordine: number;
}

export interface PaginaTesto {
  numero: number;
  larghezza: number;
  altezza: number;
  elementi: ElementoTesto[];
}

export interface Riga {
  pagina: number;
  y: number;
  /** ordinati per x */
  elementi: ElementoTesto[];
  testo: string;
}

type Pdfjs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let caricamento: Promise<Pdfjs> | undefined;

/**
 * pdf.js (build legacy: polyfill per le webview meno recenti, gira anche in node/vitest).
 * Nel browser il worker è un file a parte servito da Vite (`?url`); in node pdf.js usa il worker "finto" nello stesso thread.
 */
function pdfjs(): Promise<Pdfjs> {
  caricamento ??= (async () => {
    const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && !lib.GlobalWorkerOptions.workerSrc) {
      const { default: url } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
      lib.GlobalWorkerOptions.workerSrc = url;
    }
    return lib;
  })();
  caricamento.catch(() => (caricamento = undefined));
  return caricamento;
}

/** Testo di tutte le pagine, con posizioni; scarta gli elementi vuoti. */
export async function estraiTesto(dati: Uint8Array): Promise<PaginaTesto[]> {
  const lib = await pdfjs();
  // copia: pdf.js trasferisce il buffer al worker
  const doc = await lib.getDocument({ data: dati.slice(), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  try {
    const pagine: PaginaTesto[] = [];
    let ordine = 0;
    for (let n = 1; n <= doc.numPages; n++) {
      const p = await doc.getPage(n);
      const vista = p.getViewport({ scale: 1 });
      const contenuto = await p.getTextContent();
      const elementi: ElementoTesto[] = [];
      for (const it of contenuto.items) {
        if (!('str' in it)) continue;
        const testo = it.str.replace(/\s+/g, ' ').trim();
        if (!testo) continue;
        const t = it.transform as number[];
        elementi.push({ testo, x: t[4], y: t[5], w: it.width, h: it.height || Math.hypot(t[2], t[3]), pagina: n, ordine: ordine++ });
      }
      pagine.push({ numero: n, larghezza: vista.width, altezza: vista.height, elementi });
      p.cleanup();
    }
    return pagine;
  } finally {
    await doc.destroy();
  }
}

/** Unisce gli elementi in righe (stessa pagina, y entro la tolleranza); righe dall'alto in basso. */
export function righe(elementi: ElementoTesto[], tolleranza = 2): Riga[] {
  const ord = [...elementi].sort((a, b) => a.pagina - b.pagina || b.y - a.y || a.x - b.x);
  const out: Riga[] = [];
  for (const e of ord) {
    const r = out[out.length - 1];
    if (r && r.pagina === e.pagina && Math.abs(r.y - e.y) <= tolleranza) r.elementi.push(e);
    else out.push({ pagina: e.pagina, y: e.y, elementi: [e], testo: '' });
  }
  for (const r of out) {
    r.elementi.sort((a, b) => a.x - b.x);
    r.testo = testoRiga(r.elementi);
  }
  return out;
}

/** Testo di una riga: spazio tra elementi staccati. */
function testoRiga(el: ElementoTesto[]): string {
  let s = '';
  let fine = -Infinity;
  for (const e of el) {
    if (s && e.x - fine > Math.max(0.5, e.h * 0.12)) s += ' ';
    s += e.testo;
    fine = e.x + e.w;
  }
  return s;
}

/**
 * Testo di una cella su più righe. `trattino`: a capo dopo "-" senza spazio (parole spezzate, es. "INTERNI-FRAZIONAMENTO").
 */
export function testoCella(el: ElementoTesto[], trattino = false): string {
  let s = '';
  for (const r of righe(el)) {
    if (s && !(trattino && s.endsWith('-'))) s += ' ';
    s += r.testo;
  }
  return s.trim();
}
