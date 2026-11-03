/**
 * Riquadro DXF di partenza: il rettangolo del modello dell'Agenzia (vertice in 0,0, misure del formato alla
 * scala scelta) sul layer RIQUADRO, il layer DOCFA_POLIGONI già spento e un piccolo esempio (layer ESEMPIO, da
 * cancellare) di come disegnare un locale perché il programma lo riconosca: muri continui con lo spessore, porta
 * fra due spalle, nome e altezza scritti dentro, poligono A. Le istruzioni sono sul layer ISTRUZIONI, spento.
 */
import type { Entita, Punto2 } from './dxf';
import { RIQUADRO_CM } from './dxf';
import { scriviDxf } from './dxf-scrivi';

export function riquadroDiPartenza(formato: 'A4' | 'A3', scala: 100 | 200 | 500): string {
  const [wcm, hcm] = RIQUADRO_CM[formato];
  const W = (wcm / 100) * scala, H = (hcm / 100) * scala;
  const k = scala / 200; // misure del foglio: 1 a 1:200
  const sp = Math.round(0.07 * k * 10000) / 10000; // spessore dei muri sezionati
  const ht = Math.round(0.45 * k * 100) / 100; // testi alti 2,25 mm sul foglio
  const es = (x: number, y: number): Punto2 => [Math.round((W * 0.08 + x) * 1000) / 1000, Math.round((H * 0.72 + y) * 1000) / 1000];
  const L = (a: Punto2, b: Punto2, spessore = sp): Entita => ({ tipo: 'linea', layer: 'ESEMPIO', colore: 7, spessore, p1: a, p2: b });
  const T = (testo: string, p: Punto2): Entita => ({ tipo: 'testo', layer: 'ESEMPIO', colore: 7, spessore: 0, testo, punto: p, altezza: ht, rotazione: 0, allineamentoH: 'centro', allineamentoV: 'medio', larghezza: 1 });
  // locale 4,00 × 3,50 netti, muri da 30 cm, porta da 90 cm sul lato in basso (spalle disegnate)
  const m = 0.3, a = 4, b = 3.5, p0 = 1.2, p1 = 2.1;
  const esempio: Entita[] = [
    // filo interno
    L(es(0, 0), es(p0, 0)), L(es(p1, 0), es(a, 0)), L(es(a, 0), es(a, b)), L(es(a, b), es(0, b)), L(es(0, b), es(0, 0)),
    // filo esterno
    L(es(-m, -m), es(p0, -m)), L(es(p1, -m), es(a + m, -m)), L(es(a + m, -m), es(a + m, b + m)), L(es(a + m, b + m), es(-m, b + m)), L(es(-m, b + m), es(-m, -m)),
    // spalle della porta
    L(es(p0, 0), es(p0, -m)), L(es(p1, 0), es(p1, -m)),
    T('camera', es(a / 2, b / 2 + ht)), T('h270', es(a / 2, b / 2 - ht)),
  ];
  const istruzioni = [
    'FA.CATASTO.DOC - RIQUADRO DI PARTENZA',
    'Disegna dentro il rettangolo del layer RIQUADRO (non spostarlo: vertice in 0,0).',
    'Muri: linee continue, le due facce del muro; i muri sezionati con spessore (39) ' + sp + '.',
    'Porte: muro interrotto fra due spalle, oppure un segmento tratteggiato nel vuoto del muro.',
    'Scrivi il nome dentro ogni locale (camera, bagno, ingresso, rip., cantina...) e l\'altezza (h270).',
    'Poligoni sul layer DOCFA_POLIGONI (spento): colore 1=A 2=B 3=C 4=D 5=E 6=F 7=G 8=A2.',
    'Il layer ESEMPIO e\' solo un esempio: cancellalo.',
  ].map((t, i): Entita => ({ tipo: 'testo', layer: 'ISTRUZIONI', colore: 7, spessore: 0, testo: t, punto: [W + 2 * k, H - (i + 1) * ht * 2], altezza: ht, rotazione: 0, allineamentoH: 'sinistra', allineamentoV: 'base', larghezza: 1 }));
  const poligonoEsempio = [es(-m, -m), es(a + m, -m), es(a + m, b + m), es(-m, b + m)];
  return scriviDxf({
    entita: [...esempio, ...istruzioni],
    poligoni: [{ tipo: 'A', vertici: poligonoEsempio, altezzaValida: true }],
    riquadro: [[0, 0], [W, 0], [W, H], [0, H]],
    layers: { ESEMPIO: { colore: 7 }, ISTRUZIONI: { colore: 7, spento: true } },
  });
}
