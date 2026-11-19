// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
import { describe, it, expect } from 'vitest';
import { testoCausaliD1 } from '../pagine/d1';
import type { Pratica } from '../../model';

const pratica = (p: Partial<Pratica>): Pratica => ({ causale: 'VAR', tipiVariazione: {}, ...p }) as Pratica;

describe('riga «Causali» del D1', () => {
  it('altre variazioni: la dicitura seguita dalla descrizione scritta dal tecnico', () => {
    expect(testoCausaliD1(pratica({ tipiVariazione: { VAR: true }, altreVariazioni: 'RETTIFICA DOCFA PROT. N. 2554/01' }))).toBe('altre variazioni - RETTIFICA DOCFA PROT. N. 2554/01');
  });
  it('altre variazioni insieme a un’altra causale', () => {
    expect(testoCausaliD1(pratica({ tipiVariazione: { VSI: true, VAR: true }, altreVariazioni: 'CAMBIO D\'USO' }))).toBe("diversa distribuzione degli spazi interni, altre variazioni - CAMBIO D'USO");
  });
  it('senza descrizione resta la dicitura generica', () => {
    expect(testoCausaliD1(pratica({ tipiVariazione: { VAR: true } }))).toBe('altre variazioni');
  });
});
