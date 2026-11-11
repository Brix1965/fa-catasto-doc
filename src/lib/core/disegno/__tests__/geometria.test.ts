// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
import { describe, expect, it } from 'vitest';
import { agganciaAlDisegno, allineaAiVicini, area, direzionePrincipale, latiPoligono, ortogonaleDa, ruota, semplificaVertici, squadraPoligono, type P } from '../geometria';

const vicino = (a: P, b: P, t = 1e-6) => Math.hypot(a[0] - b[0], a[1] - b[1]) < t;

describe('strumenti per i poligoni', () => {
  it('semplifica: toglie vertici doppi e allineati', () => {
    const v: P[] = [[0, 0], [2, 0], [4, 0.004], [4, 0.0041], [4, 3], [0, 3]];
    const s = semplificaVertici(v, 0.01);
    expect(s.length).toBe(4);
    expect(area(s)).toBeCloseTo(12, 1);
  });
  it('squadra: rettangolo storto di un grado diventa un rettangolo', () => {
    const v: P[] = [[0, 0], [5, 0.05], [5.02, 4], [0, 3.97]];
    const s = squadraPoligono(v, 0);
    expect(s.length).toBe(4);
    for (const [a, b] of latiPoligono(s)) expect(Math.abs(a[0] - b[0]) < 1e-9 || Math.abs(a[1] - b[1]) < 1e-9).toBe(true);
  });
  it('squadra: edificio ruotato di 30°, lato obliquo conservato', () => {
    const ang = Math.PI / 6;
    const base: P[] = [[0, 0], [6, 0.06], [6, 2], [4, 4], [0.03, 4]]; // lato 6,2 → 4,4 obliquo
    const v = base.map((p) => ruota(p, ang));
    const a = direzionePrincipale(latiPoligono(v));
    expect(a).toBeCloseTo(ang, 1);
    const s = squadraPoligono(v).map((p) => ruota(p, -a));
    expect(s.length).toBe(5);
    expect(vicino(s[1], [s[2][0], s[1][1]], 1e-9)).toBe(true); // lato verticale esatto
    expect(Math.abs(s[2][1] - s[3][1])).toBeGreaterThan(1); // l'obliquo resta obliquo
  });
  it('ortogonale nel riferimento ruotato', () => {
    const ang = Math.PI / 6;
    const da: P = [0, 0];
    const p = ruota([3, 0.4], ang);
    const q = ruota(ortogonaleDa(p, da, ang), -ang);
    expect(q[1]).toBeCloseTo(0, 9);
    expect(q[0]).toBeCloseTo(3, 9);
  });
  it('allinea ai vicini entro la tolleranza', () => {
    const r = allineaAiVicini([1.02, 2.97], [[1, 0], [5, 3]], 0, 0.05);
    expect(r.allineato).toBe(true);
    expect(vicino(r.p, [1, 3])).toBe(true);
    expect(allineaAiVicini([1.5, 1.5], [[1, 0], [5, 3]], 0, 0.05).allineato).toBe(false);
  });
});

describe('aggancio al disegno senza ortogonale (edifici non squadrati)', () => {
  // due muri obliqui che nel disegno non si toccano del tutto (2 cm di distacco allo spigolo)
  const linee: [P, P][] = [[[0, 0], [4, 1]], [[4.02, 1.03], [3, 5]], [[10, 10], [12, 10]]];
  it("spigolo: l'estremo di una linea", () => {
    expect(agganciaAlDisegno([0.05, 0.03], linee, 0.1)).toEqual({ p: [0, 0], tipo: 'spigolo' });
  });
  it('incrocio di due muri che non si toccano', () => {
    const a = agganciaAlDisegno([4.06, 1.0], linee, 0.1)!;
    expect(a.tipo).toBe('spigolo'); // l'estremo più vicino vince
    // muri che si attraversano: lo spigolo non è l'estremo di nessuna linea
    const b = agganciaAlDisegno([4.05, 0.97], [[[0, 0], [5, 1.25]], [[4.5, -1], [3.5, 3]]], 0.15)!;
    expect(b.tipo).toBe('incrocio');
    expect(b.p[0]).toBeCloseTo(4, 9);
    expect(b.p[1]).toBeCloseTo(1, 9);
  });
  it('sulla linea, altrimenti niente', () => {
    const a = agganciaAlDisegno([2, 0.56], linee, 0.1)!;
    expect(a.tipo).toBe('linea');
    expect(a.p[1]).toBeCloseTo(a.p[0] / 4, 9);
    expect(agganciaAlDisegno([7, 7], linee, 0.1)).toBeNull();
  });
});
