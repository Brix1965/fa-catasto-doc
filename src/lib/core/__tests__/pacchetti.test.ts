// Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
// SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const conf = JSON.parse(readFileSync(join(__dirname, '../../../../src-tauri/tauri.conf.json'), 'utf8'));

describe('pacchetti di installazione', () => {
  it("identificativo e produttore non cambiano: l'installer Windows deve ritrovare la versione già installata", () => {
    // L'installer NSIS di Tauri cerca la cartella della versione installata nel registro sotto
    // Software\<produttore>\Fa.Catasto.Doc, dove il produttore è bundle.publisher o, se manca, la seconda parte
    // dell'identificativo («facatastodoc»). Nella 0.7.6 il publisher «Giacomo Lombardo Geometra» lo ha cambiato:
    // l'installer non trovava la cartella e la disinstallazione della versione precedente falliva
    // («NSIS Error - Error launching installer», «Unable to uninstall!»).
    expect(conf.identifier).toBe('it.facatastodoc.desktop');
    expect(conf.bundle.publisher).toBeUndefined();
    expect(conf.productName).toBe('Fa.Catasto.Doc');
  });
});
