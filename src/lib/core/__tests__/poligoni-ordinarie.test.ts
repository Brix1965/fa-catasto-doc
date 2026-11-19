// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/**
 * I poligoni delle superfici entrano nel documento solo per le unità a destinazione ordinaria (A, B, C):
 * per D, E, F restano nella pratica e servono al calcolo delle superfici del 2N.
 */
import { describe, it, expect } from 'vitest';
import { poligoniNelDocumento, type Poligono, type Pratica, type UnitaImmobiliare } from '../model';
import { compilaAtt } from '../compile';
import { riportaSuperficiNel2N, sincronizzaDaPoligoni, superficiPer2N } from '../superfici';

const quadrato = (tipo: Poligono['tipo'], lato: number): Poligono => ({ tipo, altezzaValida: true, vertici: [[0, 0], [lato, 0], [lato, lato], [0, lato]] }) as Poligono;
const unita = (categoria: string, poligoni: Poligono[]): UnitaImmobiliare => ({
  classamento: { categoria }, ambienti: [],
  planimetria: { progressivo: 9000001, formato: 'A4', scala: 200, poligoni },
}) as unknown as UnitaImmobiliare;

describe('poligoni solo per le unità ordinarie', () => {
  it('regola per categoria', () => {
    for (const c of ['A03', 'B05', 'C01']) expect(poligoniNelDocumento(unita(c, []))).toBe(true);
    for (const c of ['D05', 'E03', 'F01', '']) expect(poligoniNelDocumento(unita(c, []))).toBe(false);
    expect(poligoniNelDocumento({ ...unita('A03', []), partitaSpeciale: 'A' } as UnitaImmobiliare)).toBe(false);
  });

  it('indice allegati: «N» (poligoni presenti) solo per le ordinarie', () => {
    const att = (c: string) => new TextDecoder('latin1').decode(compilaAtt({ unita: [unita(c, [quadrato('A', 10)])] } as unknown as Pratica));
    expect(att('A03').endsWith('N0')).toBe(true);
    expect(att('D05').endsWith('N0')).toBe(false);
  });

  it('categoria D: niente dati metrici dai poligoni', () => {
    const u = unita('D05', [quadrato('A', 10)]);
    u.ambienti = [{ tipo: 'A', superficie: 100, altezzaMin: 150, altezzaMax: 0 }];
    sincronizzaDaPoligoni(u);
    expect(u.ambienti).toEqual([]);
  });

  it('superfici per il 2N dai poligoni', () => {
    const pol = [quadrato('A', 20), quadrato('B', 10), quadrato('F', 5)];
    expect(superficiPer2N(pol)).toEqual({ coperta: 500, scoperta: 25, totale: 525 });
    const u = unita('D05', pol);
    u.mod2N = { recordM: {}, recordN: {}, stimaComparativa: [], corpi: [{ recordP: {}, recordQ: {}, recordR: {} }] };
    expect(riportaSuperficiNel2N(u)).toBe(true);
    expect(u.mod2N.recordN).toMatchObject({ area_totale_lorda: 525, area_coperta: 500 });
    expect(u.mod2N.corpi[0].recordQ.superficie_sviluppata).toBe(500);
    expect(riportaSuperficiNel2N(u)).toBe(false);
  });
});
