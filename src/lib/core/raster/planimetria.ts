/**
 * Composizione della scheda di planimetria come la produce Docfa: modello TIFF dell'Agenzia
 * (cartiglio già stampato) + valori del cartiglio + disegno del DXF nel riquadro.
 *
 * Le posizioni dei valori del cartiglio sono state misurate confrontando pixel per pixel il TIFF
 * generato da Docfa (fixtures NCV002/0000007.001) con il modello A4.mod; per l'A3, dove il
 * cartiglio è stampato lungo il lato sinistro ruotato di 90°, misurate allo stesso modo sulle schede
 * A3 di NCV081 (0000211.006); protocollo e data, vuoti nei campioni, restano ricavati dalle etichette.
 */
import type { Poligono } from '../model';
import { dxfToPx, FOGLI, type FoglioPlanimetria } from '../ntf';
import { Bitmap, type OpzioniTesto } from './bitmap';
import { rilevaFoglio, type DxfLetto, type Entita } from './dxf';
import { preparaDxf } from './dxf-correzioni';
import { codificaG4 } from './g4';
import { AREA_DISEGNO, caricaModello, type FormatoModello, type TipoModello } from './modelli';
import { scriviTiffG4 } from './tiff';

export interface Cartiglio {
  /** ufficio provinciale (es. "Firenze"), stampato in grande sotto "Ufficio Provinciale di" */
  ufficio: string;
  comune: string;
  via: string;
  civico: string;
  sezione?: string;
  foglio: string;
  particella: string;
  subalterno?: string;
  /** "Cognome Nome" del tecnico */
  compilatore: string;
  /** albo (es. "Geometri") */
  albo: string;
  /** provincia dell'albo */
  provincia: string;
  numeroAlbo: string;
  protocollo?: string;
  data?: string;
  scheda: number;
  scala: number;
}

export interface OpzioniPlanimetria {
  /** contenuto del DXF oppure DXF già letto */
  dxf: string | DxfLetto;
  /** formato e scala; se assenti vengono dedotti dal riquadro del DXF */
  foglio?: FoglioPlanimetria;
  cartiglio: Cartiglio;
  /** data per il tag DateTime del TIFF (default: adesso) */
  data?: Date;
}

export interface PlanimetriaComposta {
  bitmap: Bitmap;
  tiff: Uint8Array;
  g4: Uint8Array;
  width: number;
  height: number;
  poligoni: Poligono[];
  foglio: FoglioPlanimetria;
}

/** Font del cartiglio: imita il Courier di Docfa (maiuscole alte 15 px, passo 14 px, tratto 2 px). */
const FONT_CARTIGLIO: OpzioniTesto = { altezza: 15, passo: 14, spessore: 2 };
/** Rapporto medio fra la larghezza dell'Arial e quella del font Hershey Simplex a pari altezza. */
const FATTORE_LARGHEZZA_TESTI = 0.85;
/** Font del nome dell'ufficio (sans-serif grande, centrato). */
const FONT_UFFICIO: OpzioniTesto = { altezza: 23, spessore: 3, allineamentoH: 'centro' };

interface PosizioneCampo {
  /** A4: x del bordo sinistro del testo (o centro, per l'ufficio) e y della linea di base */
  a4: [number, number];
  /** A3: stesse coordinate nel sistema del cartiglio ruotato (u lungo l'altezza del foglio, v lungo la larghezza) */
  a3: [number, number];
}

/** Posizioni dei valori del cartiglio, in pixel (misurate su 0000007.001 / A4.mod). */
export const POSIZIONI_CARTIGLIO: Record<keyof Cartiglio, PosizioneCampo> = {
  protocollo: { a4: [910, 58], a3: [1569, 98] },
  data: { a4: [1104, 58], a3: [1794, 97] },
  comune: { a4: [666, 100], a3: [1330, 148] },
  via: { a4: [530, 146], a3: [1189, 195] },
  civico: { a4: [1386, 146], a3: [2027, 196] },
  ufficio: { a4: [265, 242], a3: [881, 219] },
  compilatore: { a4: [1030, 228], a3: [2733, 123] },
  albo: { a4: [1034, 289], a3: [2731, 183] },
  provincia: { a4: [1109, 336], a3: [2806, 223] },
  numeroAlbo: { a4: [1434, 335], a3: [3104, 224] },
  sezione: { a4: [692, 243], a3: [2399, 134] },
  foglio: { a4: [692, 273], a3: [2399, 160] },
  particella: { a4: [692, 307], a3: [2399, 189] },
  subalterno: { a4: [691, 340], a3: [2401, 222] },
  scheda: { a4: [153, 360], a3: [215, 219] },
  scala: { a4: [381, 361], a3: [488, 218] },
};

/**
 * Scrive i valori del cartiglio sul modello. Per l'A3 il cartiglio è lungo il lato sinistro,
 * ruotato di 90° antiorari: le coordinate (u, v) del sistema ruotato diventano x = v,
 * y = altezza − 1 − u.
 */
export function scriviCartiglio(bm: Bitmap, formato: FormatoModello, c: Cartiglio): void {
  const scrivi = (campo: keyof typeof POSIZIONI_CARTIGLIO, valore: string | undefined, font: OpzioniTesto): void => {
    const v = (valore ?? '').trim();
    if (!v) return;
    const pos = POSIZIONI_CARTIGLIO[campo];
    if (formato === 'A4') {
      bm.testo(pos.a4[0], pos.a4[1], v, font);
    } else {
      const [u, w] = pos.a3;
      bm.testo(w, bm.height - 1 - u, v, { ...font, rotazione: 90 });
    }
  };
  scrivi('ufficio', c.ufficio, FONT_UFFICIO);
  scrivi('protocollo', c.protocollo, FONT_CARTIGLIO);
  scrivi('data', c.data, FONT_CARTIGLIO);
  scrivi('comune', c.comune, FONT_CARTIGLIO);
  scrivi('via', c.via, FONT_CARTIGLIO);
  scrivi('civico', c.civico, FONT_CARTIGLIO);
  scrivi('compilatore', c.compilatore, FONT_CARTIGLIO);
  scrivi('albo', c.albo, FONT_CARTIGLIO);
  scrivi('provincia', c.provincia, FONT_CARTIGLIO);
  scrivi('numeroAlbo', c.numeroAlbo, FONT_CARTIGLIO);
  scrivi('sezione', c.sezione, FONT_CARTIGLIO);
  scrivi('foglio', c.foglio, FONT_CARTIGLIO);
  scrivi('particella', c.particella, FONT_CARTIGLIO);
  scrivi('subalterno', c.subalterno, FONT_CARTIGLIO);
  scrivi('scheda', String(c.scheda), FONT_CARTIGLIO);
  scrivi('scala', String(c.scala), FONT_CARTIGLIO);
}

/** Pixel per metro del disegno alla scala del foglio (200 dpi). */
export function pxPerMetro(foglio: FoglioPlanimetria): number {
  return (1000 / foglio.scala) * (200 / 25.4);
}

/** Spessore in pixel di una penna di `spessoreM` metri (0 → linea sottile di 1 px). */
function spessorePx(spessoreM: number, pxPerM: number): number {
  if (spessoreM <= 0) return 1;
  return Math.max(1, Math.round(spessoreM * pxPerM));
}

/**
 * Disegna le entità del DXF sulla bitmap, trasformandole con dxfToPx (metri → pixel).
 * Gli spessori (thickness/larghezza) diventano larghezze di penna; i testi usano il font a tratti.
 */
export function disegnaEntita(bm: Bitmap, entita: Entita[], foglio: FoglioPlanimetria): void {
  const k = pxPerMetro(foglio);
  const P = (p: [number, number]): [number, number] => dxfToPx(p[0], p[1], foglio);
  for (const e of entita) {
    const sp = spessorePx(e.spessore, k);
    switch (e.tipo) {
      case 'linea': {
        const [x0, y0] = P(e.p1), [x1, y1] = P(e.p2);
        bm.linea(x0, y0, x1, y1, sp);
        break;
      }
      case 'polilinea':
        bm.polilinea(e.punti.map(P), sp, e.chiusa);
        break;
      case 'cerchio': {
        const [cx, cy] = P(e.centro);
        bm.cerchio(cx, cy, e.raggio * k, sp);
        break;
      }
      case 'arco': {
        const [cx, cy] = P(e.centro);
        bm.arco(cx, cy, e.raggio * k, e.inizio, e.fine, sp);
        break;
      }
      case 'testo': {
        const [x, y] = P(e.punto);
        bm.testo(x, y, e.testo, {
          altezza: e.altezza * k,
          rotazione: e.rotazione,
          allineamentoH: e.allineamentoH,
          allineamentoV: e.allineamentoV,
          // il simplex è più largo dell'Arial con cui Docfa rende i testi: lo stringiamo un po'
          larghezza: e.larghezza * FATTORE_LARGHEZZA_TESTI,
          spessore: e.altezza * k > 40 ? 2 : 1,
        });
        break;
      }
    }
  }
}

/**
 * Compone una scheda: modello + cartiglio + disegno, e restituisce bitmap, stream G4 e TIFF.
 * Il disegno viene ritagliato all'area del riquadro (che Docfa sbianca prima di disegnare).
 */
async function componiScheda(
  dxfIn: string | DxfLetto,
  foglioIn: FoglioPlanimetria | undefined,
  tipo: TipoModello,
  cartiglio: (bm: Bitmap, formato: FormatoModello, foglio: FoglioPlanimetria) => void,
  data?: Date,
): Promise<PlanimetriaComposta> {
  // dal testo si passa sempre dalle correzioni automatiche (le stesse dell'importazione)
  const dxf = typeof dxfIn === 'string' ? preparaDxf(dxfIn).letto : dxfIn;
  const foglio: FoglioPlanimetria = foglioIn ?? (() => { const f = rilevaFoglio(dxf); return { formato: f.formato, scala: f.scala }; })();
  const formato = foglio.formato;
  const modello = await caricaModello(formato, tipo);
  const info = FOGLI[formato];
  if (modello.width !== info.larghezzaPx || modello.height !== info.altezzaPx) {
    throw new Error(`Modello ${formato} di ${modello.width}x${modello.height} px, attesi ${info.larghezzaPx}x${info.altezzaPx}`);
  }
  const area = AREA_DISEGNO[formato];
  modello.rettangolo(area.x0, area.y0, area.x1, area.y1, false);
  cartiglio(modello, formato, foglio);

  // disegno su un livello separato, poi copiato solo dentro il riquadro
  const livello = new Bitmap(modello.width, modello.height);
  disegnaEntita(livello, dxf.entita, foglio);
  for (let y = area.y0; y <= area.y1; y++) {
    for (let x = area.x0; x <= area.x1; x++) {
      if (livello.getPixel(x, y)) modello.setPixel(x, y, true);
    }
  }

  const g4 = codificaG4(modello);
  const tiff = scriviTiffG4(modello, { data }, g4);
  return { bitmap: modello, tiff, g4, width: modello.width, height: modello.height, poligoni: dxf.poligoni, foglio };
}

/** Compone la scheda di planimetria di una u.i.u. */
export async function componiPlanimetria(opzioni: OpzioniPlanimetria): Promise<PlanimetriaComposta> {
  return componiScheda(opzioni.dxf, opzioni.foglio, 'planimetria',
    (bm, formato, foglio) => scriviCartiglio(bm, formato, { ...opzioni.cartiglio, scala: opzioni.cartiglio.scala || foglio.scala }), opzioni.data);
}

/** Cartiglio dell'elaborato planimetrico (modelli EP2_A4.mod / EP2_A3.mod). */
export interface CartiglioElaborato {
  ufficio: string;
  comune: string;
  sezione?: string;
  foglio: string;
  particella: string;
  compilatore: string;
  albo: string;
  provincia: string;
  numeroAlbo: string;
  protocollo?: string;
  data?: string;
  tipoMappale?: string;
  tipoMappaleData?: string;
  scala: number;
}

/**
 * Posizioni dei valori nel cartiglio dell'elaborato, in pixel. Misurate confrontando i TIFF di Docfa con
 * i modelli: A4 su NCV065/0000195.001, A3 su NCV081/0000217.001 (ricerca della posizione di massima
 * sovrapposizione del testo). Sezione, protocollo e tipo mappale non compaiono nei campioni: le loro
 * posizioni sono ricavate dalle etichette del modello con gli stessi scostamenti dei campi misurati.
 */
export const POSIZIONI_CARTIGLIO_ELABORATO: Record<keyof CartiglioElaborato, PosizioneCampo> = {
  compilatore: { a4: [29, 122], a3: [1576, 102] },
  albo: { a4: [29, 187], a3: [2343, 102] },
  provincia: { a4: [111, 227], a3: [2820, 102] },
  numeroAlbo: { a4: [434, 228], a3: [3138, 103] },
  comune: { a4: [161, 277], a3: [1056, 159] },
  sezione: { a4: [137, 313], a3: [1696, 160] },
  foglio: { a4: [323, 315], a3: [1894, 160] },
  particella: { a4: [672, 318], a3: [2242, 161] },
  protocollo: { a4: [1188, 279], a3: [2797, 161] },
  data: { a4: [1372, 279], a3: [3063, 161] },
  tipoMappale: { a4: [1189, 317], a3: [2606, 219] },
  tipoMappaleData: { a4: [1372, 319], a3: [2789, 219] },
  scala: { a4: [1439, 359], a3: [3090, 217] },
  // A4: centrato sotto "Ufficio Provinciale di"; A3: dopo l'etichetta, sulla stessa riga
  ufficio: { a4: [1023, 197], a3: [464, 196] },
};

export function scriviCartiglioElaborato(bm: Bitmap, formato: FormatoModello, c: CartiglioElaborato): void {
  const scrivi = (campo: keyof CartiglioElaborato, valore: string | undefined, font: OpzioniTesto): void => {
    const v = (valore ?? '').trim();
    if (!v) return;
    const pos = POSIZIONI_CARTIGLIO_ELABORATO[campo];
    if (formato === 'A4') bm.testo(pos.a4[0], pos.a4[1], v, font);
    else {
      const [u, w] = pos.a3;
      bm.testo(w, bm.height - 1 - u, v, { ...font, rotazione: 90 });
    }
  };
  scrivi('ufficio', c.ufficio, formato === 'A4' ? FONT_UFFICIO : { ...FONT_UFFICIO, allineamentoH: 'sinistra' });
  for (const campo of ['compilatore', 'albo', 'provincia', 'numeroAlbo', 'comune', 'sezione', 'foglio', 'particella', 'protocollo', 'data', 'tipoMappale', 'tipoMappaleData'] as const) {
    scrivi(campo, c[campo], FONT_CARTIGLIO);
  }
  scrivi('scala', String(c.scala), FONT_CARTIGLIO);
}

export interface OpzioniElaborato {
  dxf: string | DxfLetto;
  foglio?: FoglioPlanimetria;
  cartiglio: CartiglioElaborato;
  data?: Date;
}

/** Compone una scheda dell'elaborato planimetrico (dimostrazione grafica dei subalterni). */
export async function componiElaborato(opzioni: OpzioniElaborato): Promise<PlanimetriaComposta> {
  return componiScheda(opzioni.dxf, opzioni.foglio, 'elaborato',
    (bm, formato, foglio) => scriviCartiglioElaborato(bm, formato, { ...opzioni.cartiglio, scala: opzioni.cartiglio.scala || foglio.scala }), opzioni.data);
}
