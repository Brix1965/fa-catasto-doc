// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
/** Cartelle delle pratiche col numero del documento (NCVnnn/NCAnnn), in ordine di redazione come Docfa. */
import { describe, it, expect } from 'vitest';
import { nomeCartellaPratica, nuovaPratica, tecnicoVuoto } from '../pratica-file';

describe('nome della cartella della pratica', () => {
  it('sigla del documento e titolo', () => {
    expect(nomeCartellaPratica(nuovaPratica(tecnicoVuoto(), 'variazione', 2), 'BANCO BPM BOLOGNA VIA MARCONI 3/A')).toBe('NCV002 BANCO BPM BOLOGNA VIA MARCONI 3 A');
    expect(nomeCartellaPratica(nuovaPratica(tecnicoVuoto(), 'accatastamento', 15), 'Accatastamento NCA015')).toBe('NCA015');
  });
  it('senza titolo resta la sigla; il titolo che comincia con la sigla non la ripete', () => {
    expect(nomeCartellaPratica(nuovaPratica(tecnicoVuoto(), 'variazione', 7), '  ')).toBe('NCV007');
    expect(nomeCartellaPratica(nuovaPratica(tecnicoVuoto(), 'variazione', 7), 'NCV007 rossi')).toBe('NCV007 rossi');
  });
});
