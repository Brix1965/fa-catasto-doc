// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/**
 * Scrittura di un DXF ASCII R12 (AC1009) dalle entità lette (già esplose): serve all'editor del disegno e al
 * riquadro di partenza. R12 è il formato più semplice (niente handle) e lo aprono tutti i CAD; il programma lo
 * rilegge con lo stesso lettore. Si scrivono: LINE, POLYLINE 2D, CIRCLE, ARC, TEXT con colore, layer, tipo di
 * linea e spessore (39); i poligoni sul layer DOCFA_POLIGONI (spento, colore = tipo come vuole Docfa) e il
 * riquadro sul layer RIQUADRO.
 */
import type { Poligono, TipoAmbientePoligono } from '../model';
import { LAYER_POLIGONI, LAYER_RIQUADRO, type Entita, type Punto2 } from './dxf';
import { encode1252 } from '../bytes';
import { CONTINUE, stileLinea } from './tipi-linea';

export interface DisegnoDxf {
  entita: Entita[];
  poligoni?: Poligono[];
  /** vertici del riquadro (rettangolo con vertice in 0,0) */
  riquadro?: Punto2[] | null;
  /** colori e tipi di linea dei layer (facoltativi) */
  layers?: Record<string, { colore?: number; tipoLinea?: string; spento?: boolean }>;
  /** schemi dei tipi di linea del DXF di partenza (tabella LTYPE): si riscrivono uguali */
  tipiLinea?: Record<string, number[]>;
}

const COLORE_TIPO: Record<TipoAmbientePoligono, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8 };

const n = (v: number): string => {
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 1e6) / 1e6;
  return Object.is(r, -0) ? '0' : String(r);
};

/** Nome di layer valido per il DXF (niente caratteri speciali). */
const nomeLayer = (s: string): string => (s || '0').replace(/[<>/\\":;?*|=,]/g, '_').slice(0, 31) || '0';

export function scriviDxf(d: DisegnoDxf): string {
  const r: string[] = [];
  const g = (codice: number, valore: string | number) => { r.push(String(codice).padStart(3, ' '), typeof valore === 'number' ? n(valore) : valore); };

  const layers = new Map<string, { colore: number; tipoLinea: string; spento: boolean }>();
  layers.set('0', { colore: 7, tipoLinea: 'CONTINUOUS', spento: false });
  for (const [k, v] of Object.entries(d.layers ?? {})) layers.set(nomeLayer(k), { colore: v.colore && v.colore > 0 && v.colore < 256 ? v.colore : 7, tipoLinea: (v.tipoLinea || 'CONTINUOUS').toUpperCase(), spento: !!v.spento });
  for (const e of d.entita) if (!layers.has(nomeLayer(e.layer))) layers.set(nomeLayer(e.layer), { colore: 7, tipoLinea: 'CONTINUOUS', spento: false });
  if (d.riquadro?.length) layers.set(LAYER_RIQUADRO, { colore: 7, tipoLinea: 'CONTINUOUS', spento: false });
  if (d.poligoni?.length) layers.set(LAYER_POLIGONI, { colore: 1, tipoLinea: 'CONTINUOUS', spento: true });

  const tipiLinea = new Set<string>(['CONTINUOUS']);
  for (const l of layers.values()) tipiLinea.add(l.tipoLinea);
  for (const e of d.entita) if (e.tipoLinea && !CONTINUE.has(e.tipoLinea)) tipiLinea.add(e.tipoLinea.toUpperCase());

  // ---- HEADER
  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$ACADVER'); g(1, 'AC1009');
  // i file salvati per il CAD si scrivono in Windows-1252 (dxfPerFile): così le accentate arrivano giuste
  g(9, '$DWGCODEPAGE'); g(3, 'ANSI_1252');
  g(9, '$INSUNITS'); g(70, 6);
  g(0, 'ENDSEC');
  // ---- TABLES: tipi di linea e layer
  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LTYPE'); g(70, tipiLinea.size);
  for (const t of tipiLinea) {
    g(0, 'LTYPE'); g(2, t); g(70, 0);
    if (t === 'CONTINUOUS') { g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, 0); }
    else {
      // schema originale se c'è, altrimenti uno standard secondo lo stile (tratteggio o tratto e punto, in metri a 1:200)
      const orig = d.tipiLinea?.[t];
      const el = orig && orig.length ? orig : stileLinea(t) === 'trattopunto' ? [1, -0.25, 0, -0.25] : [0.3, -0.15];
      g(3, el.some((x) => x === 0) ? '__ . __ .' : '__ __ __'); g(72, 65); g(73, el.length); g(40, el.reduce((a, x) => a + Math.abs(x), 0));
      for (const x of el) g(49, x);
    }
  }
  g(0, 'ENDTAB');
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, layers.size);
  for (const [nome, l] of layers) { g(0, 'LAYER'); g(2, nome); g(70, 0); g(62, l.spento ? -l.colore : l.colore); g(6, l.tipoLinea); }
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');

  // ---- ENTITIES
  g(0, 'SECTION'); g(2, 'ENTITIES');
  const comuni = (e: Pick<Entita, 'layer' | 'colore' | 'tipoLinea'>) => {
    g(8, nomeLayer(e.layer));
    if (e.tipoLinea && !CONTINUE.has(e.tipoLinea.toUpperCase())) g(6, e.tipoLinea.toUpperCase());
    else if (e.tipoLinea) g(6, 'CONTINUOUS');
    if (e.colore > 0 && e.colore < 256) g(62, e.colore);
  };
  const spessore = (s: number) => { if (s > 0) g(39, s); };
  const polilinea = (punti: Punto2[], chiusa: boolean, scrivi: () => void) => {
    g(0, 'POLYLINE'); scrivi(); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, chiusa ? 1 : 0);
    for (const [x, y] of punti) { g(0, 'VERTEX'); g(8, '0'); g(10, x); g(20, y); g(30, 0); }
    g(0, 'SEQEND');
  };
  for (const e of d.entita) {
    switch (e.tipo) {
      case 'linea':
        g(0, 'LINE'); comuni(e); spessore(e.spessore); g(10, e.p1[0]); g(20, e.p1[1]); g(30, 0); g(11, e.p2[0]); g(21, e.p2[1]); g(31, 0);
        break;
      case 'polilinea':
        if (e.punti.length >= 2) polilinea(e.punti, e.chiusa, () => { comuni(e); spessore(e.spessore); });
        break;
      case 'cerchio':
        g(0, 'CIRCLE'); comuni(e); spessore(e.spessore); g(10, e.centro[0]); g(20, e.centro[1]); g(30, 0); g(40, e.raggio);
        break;
      case 'arco':
        g(0, 'ARC'); comuni(e); spessore(e.spessore); g(10, e.centro[0]); g(20, e.centro[1]); g(30, 0); g(40, e.raggio); g(50, e.inizio); g(51, e.fine);
        break;
      case 'testo': {
        const h = { sinistra: 0, centro: 1, destra: 2 }[e.allineamentoH] ?? 0;
        const v = { base: 0, basso: 1, medio: 2, alto: 3 }[e.allineamentoV] ?? 0;
        g(0, 'TEXT'); comuni(e); g(10, e.punto[0]); g(20, e.punto[1]); g(30, 0); g(40, e.altezza || 0.25); g(1, e.testo.replace(/[\r\n]+/g, ' '));
        if (e.rotazione) g(50, e.rotazione);
        if (e.larghezza && e.larghezza !== 1) g(41, e.larghezza);
        if (h || v) { g(72, h); g(11, e.punto[0]); g(21, e.punto[1]); g(31, 0); g(73, v); }
        break;
      }
    }
  }
  if (d.riquadro?.length) polilinea(d.riquadro, true, () => { g(8, LAYER_RIQUADRO); });
  for (const p of d.poligoni ?? []) if (p.vertici.length >= 3) polilinea(p.vertici, true, () => { g(8, LAYER_POLIGONI); g(62, COLORE_TIPO[p.tipo] ?? 1); });
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return r.join('\r\n') + '\r\n';
}

/** Il DXF come byte da salvare su disco per il CAD: Windows-1252, come dichiarato in $DWGCODEPAGE. */
export function dxfPerFile(testo: string): Uint8Array {
  return encode1252(testo);
}
