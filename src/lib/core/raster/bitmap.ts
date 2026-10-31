/**
 * Bitmap a 1 bit per pixel con primitive di disegno (linee, poligoni, cerchi, testo a tratti).
 *
 * Le righe sono impacchettate MSB-first (il pixel x = 0 è il bit più significativo del primo
 * byte della riga), 1 = nero, 0 = bianco: è la stessa convenzione dei TIFF con
 * PhotometricInterpretation = 0 (WhiteIsZero) e FillOrder = 1 che produce Docfa.
 *
 * Tutto il codice è TypeScript puro: funziona identico in Node e nel webview di Tauri.
 */
import { glifoHershey, HERSHEY_ALTEZZA_MAIUSCOLE, HERSHEY_BASE, HERSHEY_DISCENDENTE } from './hershey';

export type Punto = [number, number];

/** Allineamento orizzontale del testo rispetto al punto di inserimento. */
export type AllineamentoH = 'sinistra' | 'centro' | 'destra';
/** Allineamento verticale del testo rispetto al punto di inserimento. */
export type AllineamentoV = 'base' | 'basso' | 'medio' | 'alto';

export interface OpzioniTesto {
  /** altezza delle maiuscole in pixel */
  altezza: number;
  /** rotazione in gradi, antioraria (come nel DXF) */
  rotazione?: number;
  allineamentoH?: AllineamentoH;
  allineamentoV?: AllineamentoV;
  /** spessore del tratto in pixel (default 1) */
  spessore?: number;
  /** passo fisso tra i caratteri in pixel (monospazio); se assente si usa l'avanzamento proporzionale del glifo */
  passo?: number;
  /** fattore di larghezza (1 = proporzioni originali del font) */
  larghezza?: number;
}

export class Bitmap {
  readonly width: number;
  readonly height: number;
  /** byte per riga */
  readonly rowBytes: number;
  /** righe impacchettate, MSB-first, 1 = nero */
  readonly data: Uint8Array;

  constructor(width: number, height: number, data?: Uint8Array) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new Error(`Dimensioni bitmap non valide: ${width}x${height}`);
    }
    this.width = width;
    this.height = height;
    this.rowBytes = (width + 7) >> 3;
    const n = this.rowBytes * height;
    if (data) {
      if (data.length !== n) throw new Error(`Buffer bitmap di ${data.length} byte, attesi ${n}`);
      this.data = data;
    } else {
      this.data = new Uint8Array(n);
    }
  }

  /** Copia indipendente della bitmap. */
  clona(): Bitmap {
    return new Bitmap(this.width, this.height, this.data.slice());
  }

  /** Legge un pixel (true = nero); fuori dai bordi restituisce false. */
  getPixel(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return (this.data[y * this.rowBytes + (x >> 3)] & (0x80 >> (x & 7))) !== 0;
  }

  /** Scrive un pixel; le coordinate fuori dai bordi vengono ignorate. */
  setPixel(x: number, y: number, nero = true): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = y * this.rowBytes + (x >> 3);
    const m = 0x80 >> (x & 7);
    if (nero) this.data[i] |= m;
    else this.data[i] &= ~m;
  }

  /** Numero di pixel neri. */
  contaNeri(): number {
    let n = 0;
    for (let y = 0; y < this.height; y++) {
      const base = y * this.rowBytes;
      for (let x = 0; x < this.width; x++) {
        if (this.data[base + (x >> 3)] & (0x80 >> (x & 7))) n++;
      }
    }
    return n;
  }

  /** Riempie un rettangolo (estremi inclusi) di nero o di bianco. */
  rettangolo(x0: number, y0: number, x1: number, y1: number, nero = true): void {
    const xa = Math.max(0, Math.min(x0, x1));
    const xb = Math.min(this.width - 1, Math.max(x0, x1));
    const ya = Math.max(0, Math.min(y0, y1));
    const yb = Math.min(this.height - 1, Math.max(y0, y1));
    for (let y = ya; y <= yb; y++) this.segmentoOrizzontale(xa, xb, y, nero);
  }

  /** Segmento orizzontale da xa a xb (inclusi) sulla riga y, lavorando a byte interi dove possibile. */
  private segmentoOrizzontale(xa: number, xb: number, y: number, nero: boolean): void {
    if (y < 0 || y >= this.height) return;
    xa = Math.max(0, xa);
    xb = Math.min(this.width - 1, xb);
    if (xa > xb) return;
    const base = y * this.rowBytes;
    let x = xa;
    while (x <= xb) {
      if ((x & 7) === 0 && x + 7 <= xb) {
        this.data[base + (x >> 3)] = nero ? 0xff : 0;
        x += 8;
      } else {
        const i = base + (x >> 3);
        const m = 0x80 >> (x & 7);
        if (nero) this.data[i] |= m;
        else this.data[i] &= ~m;
        x++;
      }
    }
  }

  /** Disco pieno (pennello per le linee spesse): i pixel interi a distanza ≤ raggio dal centro. */
  disco(cx: number, cy: number, raggio: number, nero = true): void {
    const r = Math.max(0, raggio);
    const r2 = r * r;
    const ri = Math.floor(r);
    const x0 = Math.round(cx), y0 = Math.round(cy);
    for (let dy = -ri; dy <= ri; dy++) {
      const dx = Math.floor(Math.sqrt(r2 - dy * dy));
      this.segmentoOrizzontale(x0 - dx, x0 + dx, y0 + dy, nero);
    }
  }

  /** Timbra un punto con la penna dello spessore dato: 1 px, quadrato 2×2 oppure disco. */
  private timbra(x: number, y: number, spessore: number, nero: boolean): void {
    if (spessore <= 1) this.setPixel(x, y, nero);
    else if (spessore === 2) this.rettangolo(x, y, x + 1, y + 1, nero);
    else this.disco(x, y, spessore / 2, nero);
  }

  /**
   * Linea con l'algoritmo di Bresenham. Con spessore > 1 ogni punto viene "timbrato" con la
   * penna (quadrato 2×2 per spessore 2, disco di diametro pari allo spessore oltre: estremi
   * arrotondati, come una penna).
   */
  linea(x0: number, y0: number, x1: number, y1: number, spessore = 1, nero = true): void {
    let xa = Math.round(x0), ya = Math.round(y0);
    const xb = Math.round(x1), yb = Math.round(y1);
    const dx = Math.abs(xb - xa), sx = xa < xb ? 1 : -1;
    const dy = -Math.abs(yb - ya), sy = ya < yb ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.timbra(xa, ya, spessore, nero);
      if (xa === xb && ya === yb) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; xa += sx; }
      if (e2 <= dx) { err += dx; ya += sy; }
    }
  }

  /** Spezzata; con chiusa = true collega l'ultimo punto al primo. */
  polilinea(punti: Punto[], spessore = 1, chiusa = false, nero = true): void {
    if (punti.length === 1) { this.linea(punti[0][0], punti[0][1], punti[0][0], punti[0][1], spessore, nero); return; }
    for (let i = 1; i < punti.length; i++) this.linea(punti[i - 1][0], punti[i - 1][1], punti[i][0], punti[i][1], spessore, nero);
    if (chiusa && punti.length > 2) {
      const a = punti[punti.length - 1], b = punti[0];
      this.linea(a[0], a[1], b[0], b[1], spessore, nero);
    }
  }

  /** Poligono riempito (regola pari/dispari, scanline). I lati non vengono tracciati: usare polilinea per il contorno. */
  poligonoPieno(punti: Punto[], nero = true): void {
    if (punti.length < 3) return;
    let ymin = Infinity, ymax = -Infinity;
    for (const [, y] of punti) { if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
    const ya = Math.max(0, Math.ceil(ymin));
    const yb = Math.min(this.height - 1, Math.floor(ymax));
    const xs: number[] = [];
    for (let y = ya; y <= yb; y++) {
      xs.length = 0;
      const yc = y + 0.5; // campiona al centro del pixel
      for (let i = 0; i < punti.length; i++) {
        const [x0, y0] = punti[i];
        const [x1, y1] = punti[(i + 1) % punti.length];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) {
          xs.push(x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        this.segmentoOrizzontale(Math.round(xs[i]), Math.round(xs[i + 1]) - 1, y, nero);
      }
    }
  }

  /**
   * Arco di cerchio da angoloInizio ad angoloFine (gradi, antiorari nel sistema matematico con
   * asse Y verso l'alto: in pixel l'asse Y è verso il basso, quindi gli angoli vengono invertiti).
   * Con fine = inizio + 360 disegna il cerchio completo.
   */
  arco(cx: number, cy: number, raggio: number, angoloInizio: number, angoloFine: number, spessore = 1, nero = true): void {
    let a0 = angoloInizio;
    let a1 = angoloFine;
    while (a1 <= a0) a1 += 360;
    const ampiezza = a1 - a0;
    // passo angolare tale che la corda si discosti dall'arco meno di ~0,25 px
    const passi = Math.max(8, Math.ceil((ampiezza / 360) * Math.max(16, 2 * Math.PI * raggio / 1.5)));
    const punti: Punto[] = [];
    for (let i = 0; i <= passi; i++) {
      const a = ((a0 + (ampiezza * i) / passi) * Math.PI) / 180;
      punti.push([cx + raggio * Math.cos(a), cy - raggio * Math.sin(a)]);
    }
    this.polilinea(punti, spessore, false, nero);
  }

  /** Cerchio completo. */
  cerchio(cx: number, cy: number, raggio: number, spessore = 1, nero = true): void {
    this.arco(cx, cy, raggio, 0, 360, spessore, nero);
  }

  /**
   * Larghezza in pixel che occuperebbe il testo con le opzioni date (senza rotazione).
   */
  static larghezzaTesto(testo: string, opzioni: OpzioniTesto): number {
    const scala = (opzioni.altezza / HERSHEY_ALTEZZA_MAIUSCOLE) * (opzioni.larghezza ?? 1);
    if (opzioni.passo !== undefined) return testo.length * opzioni.passo;
    let w = 0;
    for (let i = 0; i < testo.length; i++) w += glifoHershey(codiceAscii(testo, i)).avanzamento * scala;
    return w;
  }

  /**
   * Scrive un testo con il font a tratti Hershey Simplex. (x, y) è il punto di inserimento in
   * pixel; l'allineamento predefinito è sinistra/linea di base, come nel DXF.
   */
  testo(x: number, y: number, testo: string, opzioni: OpzioniTesto, nero = true): void {
    if (!testo.length) return;
    const scalaY = opzioni.altezza / HERSHEY_ALTEZZA_MAIUSCOLE;
    const scalaX = scalaY * (opzioni.larghezza ?? 1);
    const spessore = opzioni.spessore ?? 1;
    const larghezza = Bitmap.larghezzaTesto(testo, opzioni);
    // spostamento del punto di partenza per l'allineamento (nel sistema locale del testo:
    // x verso destra lungo la linea di base, y verso l'alto)
    let dx = 0;
    if (opzioni.allineamentoH === 'centro') dx = -larghezza / 2;
    else if (opzioni.allineamentoH === 'destra') dx = -larghezza;
    let dy = 0; // posizione (verso l'alto) della linea di base rispetto al punto di inserimento
    switch (opzioni.allineamentoV) {
      case 'basso': dy = HERSHEY_DISCENDENTE * scalaY; break; // la base sta sopra il punto, di quanto scendono i discendenti
      case 'medio': dy = -opzioni.altezza / 2; break; // il punto è a metà delle maiuscole
      case 'alto': dy = -opzioni.altezza; break; // il punto è in cima alle maiuscole
      default: dy = 0;
    }
    const ang = ((opzioni.rotazione ?? 0) * Math.PI) / 180;
    const cos = Math.cos(ang), sin = Math.sin(ang);
    // trasforma un punto del sistema locale (u lungo la base, v verso l'alto) in pixel:
    // rotazione antioraria di ang con Y verso l'alto, poi Y invertita perché in pixel va verso il basso
    const toPx = (u: number, v: number): Punto => [x + u * cos - v * sin, y - u * sin - v * cos];
    let avanzamento = 0;
    for (let i = 0; i < testo.length; i++) {
      const g = glifoHershey(codiceAscii(testo, i));
      let origineX: number;
      if (opzioni.passo !== undefined) {
        // monospazio: il glifo viene centrato nella sua cella
        origineX = dx + avanzamento + opzioni.passo / 2 - ((g.sinistra + g.destra) / 2) * scalaX;
        avanzamento += opzioni.passo;
      } else {
        origineX = dx + avanzamento - g.sinistra * scalaX;
        avanzamento += g.avanzamento * scalaX;
      }
      for (const tratto of g.tratti) {
        const pts: Punto[] = tratto.map(([gx, gy]) => {
          // coordinate Hershey: y verso il basso, base a HERSHEY_BASE → v verso l'alto
          const u = origineX + gx * scalaX;
          const v = (HERSHEY_BASE - gy) * scalaY + dy;
          return toPx(u, v);
        });
        this.polilinea(pts, spessore, false, nero);
      }
    }
  }

  /** Dilatazione morfologica con un quadrato di lato 2r+1 (per i confronti nei test). */
  dilata(r: number): Bitmap {
    const out = new Bitmap(this.width, this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!this.getPixel(x, y)) continue;
        out.rettangolo(x - r, y - r, x + r, y + r, true);
      }
    }
    return out;
  }

  /** Rettangolo minimo (estremi inclusi) che contiene i pixel neri nella fascia di righe indicata; null se non ce ne sono. */
  bboxNeri(y0 = 0, y1 = this.height - 1): { x0: number; y0: number; x1: number; y1: number } | null {
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (let y = Math.max(0, y0); y <= Math.min(this.height - 1, y1); y++) {
      const base = y * this.rowBytes;
      for (let b = 0; b < this.rowBytes; b++) {
        const v = this.data[base + b];
        if (!v) continue;
        for (let k = 0; k < 8; k++) {
          if (v & (0x80 >> k)) {
            const x = b * 8 + k;
            if (x < bx0) bx0 = x;
            if (x > bx1) bx1 = x;
            if (y < by0) by0 = y;
            if (y > by1) by1 = y;
          }
        }
      }
    }
    return bx1 < 0 ? null : { x0: bx0, y0: by0, x1: bx1, y1: by1 };
  }
}

/** Codice ASCII del carattere i-esimo, con sostituzione dei caratteri accentati più comuni. */
function codiceAscii(s: string, i: number): number {
  const c = s.charCodeAt(i);
  if (c < 128) return c;
  const ch = s[i].normalize('NFD');
  const base = ch.charCodeAt(0);
  return base < 128 ? base : 63;
}
