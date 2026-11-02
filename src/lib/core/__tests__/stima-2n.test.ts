/**
 * Modello 2N, quadro H: prospetto in euro, Va × saggio = rendita, coerenza col quadro U.
 * Unità dei record verificate su NCV081 (vedi stima-2n.ts).
 */
import { describe, it, expect } from 'vitest';
import type { Mod2N } from '../model';
import { controlli2N, leggiRighe, leggiStima, numeroItaliano, ricalcola2N, scriviRiga, scriviSaggio, valoreRiga } from '../stima-2n';

const vuoto = (): Mod2N => ({ recordM: {}, recordN: {}, stimaComparativa: [], corpi: [] });

describe('2N: stima e rendita', () => {
  it('NCV081: legge le righe e i totali come nel documento presentato', () => {
    const d = vuoto();
    d.stimaComparativa = [{
      stima1_corpo: '001', stima1_tipologia: 'C', stima1_destinazione: 'CAMERE', stima1_consistenza: 454, stima1_valore_unitario: 90000, stima1_valore: 4086000,
      stima2_corpo: '002', stima2_tipologia: 'C', stima2_destinazione: 'MENSA ETC', stima2_consistenza: 395, stima2_valore_unitario: 60000, stima2_valore: 237000,
    }];
    d.recordN = { valore_stima_comparativa: 432300000, valutazione_attribuita: 432300000, saggio_intero: 0, saggio_decimale: 200, rendita_catastale: 8646000, rendita_catastale_tonda: 8646000 };
    const r = leggiRighe(d);
    expect(r[1]).toMatchObject({ consistenza: 395, unitario: 600, valore: 237000 });
    expect(leggiStima(d)).toMatchObject({ comparativa: 4323000, attribuita: 4323000, saggio: 0.02, rendita: 86460 });
    // il ricalcolo non cambia nulla: il documento resta identico
    expect(ricalcola2N(d)).toBe(false);
    expect(controlli2N(d, 86460)).toEqual([]);
  });

  it('pratica BPM: 613 m², Va 730.000 €, saggio 2% → rendita 14.600 €', () => {
    const d = vuoto();
    scriviRiga(d, 0, { rif: '1', natura: 'C', descrizione: 'BANCA', consistenza: 613, unitario: 1190.86, valore: valoreRiga(613, 1190.86) });
    scriviSaggio(d.recordN, 0.02);
    ricalcola2N(d, { attribuitaDaTotale: true });
    expect(leggiStima(d).comparativa).toBe(729997);
    // il tecnico arrotonda Va a 730.000
    d.recordN.valutazione_attribuita = 730000 * 100;
    ricalcola2N(d);
    const s = leggiStima(d);
    expect(s.rendita).toBe(14600);
    expect(d.recordN).toMatchObject({ valutazione_attribuita: 73000000, saggio_intero: 0, saggio_decimale: 200, rendita_catastale: 1460000, rendita_catastale_tonda: 1460000 });
    expect(controlli2N(d, 14600)).toEqual([]);
    expect(controlli2N(d, 24520)[0]).toMatch(/quadro U/);
  });

  it('pratica salvata con importi incoerenti: il ricalcolo li riallinea', () => {
    // come la pratica BPM del 02/11/2026: Va in centesimi giusto, rendita scritta in euro nel campo in centesimi
    const d = vuoto();
    d.recordN = { valore_stima_comparativa: 73000, valutazione_attribuita: 73000000, saggio_intero: 0, saggio_decimale: 200, rendita_catastale: 14600, rendita_catastale_tonda: 14600 };
    expect(controlli2N(d).some((t) => t.startsWith('rendita'))).toBe(true);
    ricalcola2N(d);
    expect(leggiStima(d)).toMatchObject({ comparativa: 0, attribuita: 730000, rendita: 14600 });
  });

  it('numeri all\'italiana', () => {
    expect(numeroItaliano('730.000')).toBe(730000);
    expect(numeroItaliano('1.190,86')).toBe(1190.86);
    expect(numeroItaliano('1190.86')).toBe(1190.86);
    expect(numeroItaliano('2')).toBe(2);
    expect(numeroItaliano('€ 14.600,00')).toBe(14600);
  });
});
