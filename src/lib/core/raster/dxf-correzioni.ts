/**
 * Correzione automatica dei DXF all'importazione: risolve da solo i problemi tipici dei disegni che Docfa non
 * accetta e dice cosa ha fatto. Il disegno viene sempre portato a: metri, riquadro con vertice in (0,0),
 * niente oggetti fuori dal riquadro, poligoni chiusi con i colori di Docfa (1-8).
 *
 * Problemi gestiti (oltre a quelli che il lettore supera da sé: qualsiasi versione ASCII, quote Z, blocchi
 * annidati, spline, ellissi, testi multilinea, layer qualsiasi):
 *  - file binario o incompleto, codifica con BOM;
 *  - riquadro mancante sul layer RIQUADRO (cercato tra i rettangoli del disegno), fuori dall'origine;
 *  - disegno in centimetri o millimetri;
 *  - oggetti fuori dal riquadro;
 *  - poligoni aperti, fatti di linee separate, con colori fuori dalla tabella, duplicati o degeneri;
 *  - residui di altri programmi: tratteggi, immagini, oggetti proxy, layer spenti o congelati.
 */
import type { Poligono, TipoAmbientePoligono } from '../model';
import { leggiDxf, rilevaFoglio, RIQUADRO_CM, type DxfLetto, type Entita, type FoglioRilevato, type Punto2 } from './dxf';

export interface DxfPreparato {
  letto: DxfLetto;
  /** formato e scala dedotti dal riquadro (null se il riquadro non c'è o non corrisponde) */
  foglio: FoglioRilevato | null;
  /** correzioni fatte automaticamente */
  correzioni: string[];
  /** cose da verificare (non correggibili con certezza) */
  problemi: string[];
}

const TIPO_COLORE: Record<number, TipoAmbientePoligono> = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H' };
const NOME_TIPO: Record<TipoAmbientePoligono, string> = { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', H: 'A2' };
const EPS = 0.005; // 5 mm: tolleranza per unire estremi e chiudere poligoni

const NOMI_OGGETTI: Record<string, string> = {
  HATCH: 'tratteggi', IMAGE: 'immagini', ACAD_PROXY_ENTITY: 'oggetti proxy di altri programmi', OLE2FRAME: 'oggetti OLE', OLEFRAME: 'oggetti OLE',
  MLINE: 'multilinee', REGION: 'regioni', '3DFACE': 'facce 3D', '3DSOLID': 'solidi 3D', MESH: 'mesh', BODY: 'corpi 3D', WIPEOUT: 'mascherature',
  LEADER: 'direttrici', MULTILEADER: 'direttrici multiple', TOLERANCE: 'tolleranze', RAY: 'semirette', XLINE: 'linee di costruzione', LIGHT: 'luci',
  'BLOCCO MANCANTE': 'riferimenti a blocchi o file esterni non presenti',
};

/** Colore AutoCAD (ACI) → tipo di poligono più vicino per tinta; null se non determinabile. */
export function tipoDaColoreAci(c: number): TipoAmbientePoligono | null {
  if (TIPO_COLORE[c]) return TIPO_COLORE[c];
  if (c === 9 || (c >= 250 && c <= 254)) return 'H'; // grigi
  if (c === 255) return 'G';
  if (c >= 10 && c <= 249) {
    const tinta = Math.floor((c - 10) / 10) * 15; // 24 tinte da 15°
    const centri: [number, TipoAmbientePoligono][] = [[0, 'A'], [60, 'B'], [120, 'C'], [180, 'D'], [240, 'E'], [300, 'F'], [360, 'A']];
    let migliore = centri[0];
    for (const x of centri) if (Math.abs(x[0] - tinta) < Math.abs(migliore[0] - tinta)) migliore = x;
    return migliore[1];
  }
  return null;
}

function bboxPunti(punti: Punto2[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of punti) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
}

function puntiArco(c: Punto2, r: number, inizio: number, fine: number): Punto2[] {
  let a1 = fine;
  while (a1 <= inizio) a1 += 360;
  const n = Math.max(8, Math.ceil(((a1 - inizio) / 360) * 64));
  const out: Punto2[] = [];
  for (let k = 0; k <= n; k++) { const a = ((inizio + ((a1 - inizio) * k) / n) * Math.PI) / 180; out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  return out;
}

function puntiEntita(e: Entita): Punto2[] {
  switch (e.tipo) {
    case 'linea': return [e.p1, e.p2];
    case 'polilinea': return e.punti;
    case 'cerchio': return [[e.centro[0] - e.raggio, e.centro[1] - e.raggio], [e.centro[0] + e.raggio, e.centro[1] + e.raggio]];
    case 'arco': return puntiArco(e.centro, e.raggio, e.inizio, e.fine);
    case 'testo': return [e.punto];
  }
}

function trasforma(e: Entita, f: (p: Punto2) => Punto2, k: number): Entita {
  switch (e.tipo) {
    case 'linea': return { ...e, p1: f(e.p1), p2: f(e.p2) };
    case 'polilinea': return { ...e, punti: e.punti.map(f) };
    case 'cerchio': return { ...e, centro: f(e.centro), raggio: e.raggio * k };
    case 'arco': return { ...e, centro: f(e.centro), raggio: e.raggio * k };
    case 'testo': return { ...e, punto: f(e.punto), altezza: e.altezza * k };
  }
}

function area(v: Punto2[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) { const a = v[i], b = v[(i + 1) % v.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}

const vicini = (a: Punto2, b: Punto2) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;

/** Unisce segmenti (linee e archi) in anelli chiusi; restituisce gli anelli e i pezzi rimasti aperti. */
function uniscianelli(pezzi: { punti: Punto2[]; colore: number }[]): { anelli: { punti: Punto2[]; colore: number }[]; aperti: number } {
  const liberi = pezzi.map((p) => ({ ...p, usato: false }));
  const anelli: { punti: Punto2[]; colore: number }[] = [];
  let aperti = 0;
  for (const p of liberi) {
    if (p.usato) continue;
    p.usato = true;
    const catena = p.punti.slice();
    let chiuso = vicini(catena[0], catena[catena.length - 1]) && catena.length > 2;
    while (!chiuso) {
      const coda = catena[catena.length - 1];
      const prossimo = liberi.find((q) => !q.usato && (vicini(q.punti[0], coda) || vicini(q.punti[q.punti.length - 1], coda)));
      if (!prossimo) break;
      prossimo.usato = true;
      const seq = vicini(prossimo.punti[0], coda) ? prossimo.punti : prossimo.punti.slice().reverse();
      catena.push(...seq.slice(1));
      chiuso = vicini(catena[0], catena[catena.length - 1]);
    }
    if (chiuso) { catena.pop(); anelli.push({ punti: catena, colore: p.colore }); }
    else aperti++;
  }
  return { anelli, aperti };
}

/** Rettangoli chiusi del disegno che hanno le dimensioni di un riquadro Docfa (con un fattore di scala). */
function cercaRiquadro(entita: Entita[], fattore: number): Entita | null {
  for (const e of entita) {
    if (e.tipo !== 'polilinea') continue;
    const v = e.punti.slice();
    if (v.length > 4 && vicini(v[0], v[v.length - 1])) v.pop();
    if (v.length !== 4) continue;
    const [x0, y0, x1, y1] = bboxPunti(v);
    const w = (x1 - x0) * fattore, h = (y1 - y0) * fattore;
    for (const [wcm, hcm] of Object.values(RIQUADRO_CM)) {
      for (const scala of [50, 100, 200, 500, 1000, 2000]) {
        const W = (wcm / 100) * scala, H = (hcm / 100) * scala;
        if (Math.abs(w - W) / W < 0.02 && Math.abs(h - H) / H < 0.02) return e;
      }
    }
  }
  return null;
}

function provaFoglio(letto: DxfLetto): FoglioRilevato | null {
  try { return rilevaFoglio(letto); } catch { return null; }
}

/** Legge e corregge un DXF. Solleva un errore solo se il file non è proprio un DXF leggibile. */
export function preparaDxf(testoOriginale: string): DxfPreparato {
  const correzioni: string[] = [];
  const problemi: string[] = [];
  if (/^AutoCAD Binary DXF/.test(testoOriginale)) throw new Error('DXF in formato binario: salvarlo dal CAD come DXF ASCII (qualsiasi versione)');
  let testo = testoOriginale;
  if (testo.charCodeAt(0) === 0xfeff) { testo = testo.slice(1); correzioni.push('Codifica UTF-8 con BOM: letta correttamente'); }
  if (!/\bSECTION\b/.test(testo)) throw new Error('Il file non sembra un DXF ASCII (manca la sezione SECTION)');
  if (!/(^|\n)\s*EOF\s*$/.test(testo.trimEnd() + '\n')) correzioni.push('File incompleto o interrotto (manca la chiusura EOF): letto fino al punto disponibile');

  let letto = leggiDxf(testo);
  if (!/\bENTITIES\b/.test(testo)) problemi.push('Il file non contiene la sezione ENTITIES: nessun oggetto disegnato');

  // ---- riquadro: se manca sul layer RIQUADRO lo si cerca tra i rettangoli del disegno
  if (!letto.riquadro || letto.riquadro.length < 2) {
    for (const f of [1, 0.01, 0.001, 0.1]) {
      const r = cercaRiquadro(letto.entita, f);
      if (r && r.tipo === 'polilinea') {
        letto = { ...letto, riquadro: r.punti.slice(), entita: letto.entita.filter((x) => x !== r) };
        correzioni.push(`Riquadro trovato sul layer «${r.layer}» e usato come RIQUADRO`);
        break;
      }
    }
  }

  // ---- unità di misura: metri. Se il riquadro torna solo in cm o mm si converte tutto.
  let foglio = provaFoglio(letto);
  if (!foglio && letto.riquadro) {
    for (const [f, unita] of [[0.01, 'centimetri'], [0.001, 'millimetri'], [0.1, 'decimetri']] as const) {
      const scalato = scalaLetto(letto, f);
      const fs = provaFoglio(scalato);
      if (fs) { letto = scalato; foglio = fs; correzioni.push(`Disegno in ${unita}: convertito in metri`); break; }
    }
  }

  // ---- origine del riquadro in (0,0)
  if (foglio && !foglio.origineInZero) {
    const [ox, oy] = foglio.origine;
    letto = traslaLetto(letto, -ox, -oy);
    correzioni.push(`Riquadro spostato con il vertice in (0,0) (era in ${ox.toFixed(2)}; ${oy.toFixed(2)})`);
    foglio = provaFoglio(letto);
  }
  if (!foglio) problemi.push(letto.riquadro ? 'Il riquadro non corrisponde a nessun formato e scala di Docfa (A4 o A3; 1:100, 1:200, 1:500…)' : 'Riquadro non trovato: manca il layer RIQUADRO');

  // spessori (39) e larghezze (43): Docfa li accetta e li stampa come linee spesse (es. muri a 0,07 nel
  // campione NCV002), quindi restano come sono.

  // ---- oggetti fuori dal riquadro
  if (foglio) {
    const W = foglio.larghezza, H = foglio.altezza;
    let fuori = 0, aCavallo = 0;
    const dentro = letto.entita.filter((e) => {
      const [x0, y0, x1, y1] = bboxPunti(puntiEntita(e));
      if (x1 < -EPS || y1 < -EPS || x0 > W + EPS || y0 > H + EPS) { fuori++; return false; }
      if (x0 < -EPS || y0 < -EPS || x1 > W + EPS || y1 > H + EPS) aCavallo++;
      return true;
    });
    if (fuori) { letto = { ...letto, entita: dentro }; correzioni.push(`${fuori} ${fuori === 1 ? 'oggetto fuori' : 'oggetti fuori'} dal riquadro: eliminati`); }
    if (aCavallo) correzioni.push(`${aCavallo} ${aCavallo === 1 ? 'oggetto attraversa' : 'oggetti attraversano'} il bordo del riquadro: tagliati sul bordo`);
  }

  // ---- poligoni
  const { poligoni, note, avvisi } = costruisciPoligoni(letto, foglio);
  letto = { ...letto, poligoni };
  correzioni.push(...note);
  problemi.push(...avvisi);

  // ---- residui di altri programmi e layer
  const st = letto.statistiche;
  const residui = Object.entries(st.nonGestiti).map(([t, n]) => `${n} ${NOMI_OGGETTI[t] ?? t}`);
  if (residui.length) correzioni.push(`Ignorati oggetti non ammessi da Docfa: ${residui.join(', ')}`);
  if (st.suLayerNascosti) correzioni.push(`Ignorati ${st.suLayerNascosti} oggetti su layer spenti o congelati`);
  if (st.altriLayer.length) correzioni.push(`Disegno su layer diversi da 0 (${st.altriLayer.slice(0, 6).join(', ')}${st.altriLayer.length > 6 ? '…' : ''}): considerati come layer 0`);
  return { letto, foglio, correzioni, problemi };
}

function scalaLetto(l: DxfLetto, f: number): DxfLetto {
  const p = (q: Punto2): Punto2 => [q[0] * f, q[1] * f];
  return { ...l, entita: l.entita.map((e) => trasforma(e, p, f)), grezzePoligoni: l.grezzePoligoni.map((e) => trasforma(e, p, f)), riquadro: l.riquadro?.map(p) ?? null };
}

function traslaLetto(l: DxfLetto, dx: number, dy: number): DxfLetto {
  const p = (q: Punto2): Punto2 => [q[0] + dx, q[1] + dy];
  return { ...l, entita: l.entita.map((e) => trasforma(e, p, 1)), grezzePoligoni: l.grezzePoligoni.map((e) => trasforma(e, p, 1)), riquadro: l.riquadro?.map(p) ?? null };
}

/** Poligoni dal layer DOCFA_POLIGONI, con le correzioni possibili e le note per il resoconto. */
function costruisciPoligoni(l: DxfLetto, foglio: FoglioRilevato | null): { poligoni: Poligono[]; note: string[]; avvisi: string[] } {
  const note: string[] = [];
  const avvisi: string[] = [];
  const candidati: { punti: Punto2[]; colore: number }[] = [];
  const pezzi: { punti: Punto2[]; colore: number }[] = [];
  let chiusiAMano = 0;
  for (const e of l.grezzePoligoni) {
    if (e.tipo === 'polilinea') {
      const v = e.punti.slice();
      if (v.length > 1 && vicini(v[0], v[v.length - 1])) v.pop();
      if (e.chiusa || (e.punti.length > 2 && vicini(e.punti[0], e.punti[e.punti.length - 1]))) candidati.push({ punti: v, colore: e.colore });
      else if (v.length >= 3) { candidati.push({ punti: v, colore: e.colore }); chiusiAMano++; }
      else pezzi.push({ punti: e.punti, colore: e.colore });
    } else if (e.tipo === 'linea') pezzi.push({ punti: [e.p1, e.p2], colore: e.colore });
    else if (e.tipo === 'arco') pezzi.push({ punti: puntiArco(e.centro, e.raggio, e.inizio, e.fine), colore: e.colore });
    else if (e.tipo === 'cerchio') candidati.push({ punti: puntiArco(e.centro, e.raggio, 0, 360).slice(0, -1), colore: e.colore });
  }
  if (chiusiAMano) note.push(`${chiusiAMano} ${chiusiAMano === 1 ? 'poligono aperto chiuso' : 'poligoni aperti chiusi'} automaticamente`);
  if (pezzi.length) {
    const { anelli, aperti } = uniscianelli(pezzi);
    if (anelli.length) note.push(`${anelli.length} ${anelli.length === 1 ? 'poligono ricostruito' : 'poligoni ricostruiti'} unendo linee separate`);
    if (aperti) avvisi.push(`${aperti} ${aperti === 1 ? 'tratto' : 'tratti'} sul layer DOCFA_POLIGONI non ${aperti === 1 ? 'forma' : 'formano'} un poligono chiuso: ${aperti === 1 ? 'ignorato' : 'ignorati'}`);
    candidati.push(...anelli);
  }

  const poligoni: Poligono[] = [];
  const firme = new Set<string>();
  let degeneri = 0, doppi = 0, fuori = 0, aCavallo = 0;
  const colori = new Map<string, number>();
  for (const c of candidati) {
    // vertici consecutivi coincidenti
    const v = c.punti.filter((p, i, a) => i === 0 || !vicini(p, a[i - 1]));
    if (v.length < 3 || area(v) < 0.01) { degeneri++; continue; }
    let tipo = TIPO_COLORE[c.colore];
    if (!tipo) {
      const t = tipoDaColoreAci(c.colore);
      tipo = t ?? 'A';
      const chiave = `${c.colore >= 256 || c.colore === 0 ? 'non definito' : c.colore} → ${NOME_TIPO[tipo]}`;
      colori.set(chiave, (colori.get(chiave) ?? 0) + 1);
    }
    if (foglio) {
      const [x0, y0, x1, y1] = bboxPunti(v);
      if (x1 < -EPS || y1 < -EPS || x0 > foglio.larghezza + EPS || y0 > foglio.altezza + EPS) { fuori++; continue; }
      if (x0 < -EPS || y0 < -EPS || x1 > foglio.larghezza + EPS || y1 > foglio.altezza + EPS) aCavallo++;
    }
    const firma = tipo + v.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).sort().join(';');
    if (firme.has(firma)) { doppi++; continue; }
    firme.add(firma);
    poligoni.push({ tipo, vertici: v, altezzaValida: true });
  }
  if (colori.size) avvisi.push(`Poligoni con colore non previsto da Docfa, assegnati per tinta (verificare il tipo di ambiente): ${[...colori].map(([k, n]) => `colore ${k}${n > 1 ? ` (${n})` : ''}`).join(', ')}`);
  if (degeneri) note.push(`${degeneri} ${degeneri === 1 ? 'poligono senza area eliminato' : 'poligoni senza area eliminati'}`);
  if (doppi) note.push(`${doppi} ${doppi === 1 ? 'poligono doppio eliminato' : 'poligoni doppi eliminati'}`);
  if (fuori) note.push(`${fuori} ${fuori === 1 ? 'poligono fuori' : 'poligoni fuori'} dal riquadro: ${fuori === 1 ? 'eliminato' : 'eliminati'}`);
  if (aCavallo) avvisi.push(`${aCavallo} ${aCavallo === 1 ? 'poligono esce' : 'poligoni escono'} dal riquadro: verificare il disegno`);
  return { poligoni, note, avvisi };
}

