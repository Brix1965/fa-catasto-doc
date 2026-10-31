import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serializzaPratica, deserializzaPratica, nuovaPratica, nuovaUnita, clonaProfondo, titoloProposto, tecnicoVuoto, type FilePratica } from '../pratica-file';
import { decompilaDocumento } from '$lib/core/decompile';
import { compilaDocumento } from '$lib/core/compile';
import { controllaPratica } from '../validazione';

function fileDi(pratica: FilePratica['pratica']): FilePratica {
  return { formato: 'fa-catasto-doc', versione: 1, meta: { id: 'x', titolo: 't', stato: 'bozza', creata: '2026-01-01T00:00:00.000Z', modificata: '2026-01-01T00:00:00.000Z' }, pratica };
}

describe('serializzazione della pratica', () => {
  it('conserva i dati binari (TIFF/NTF) in base64 e li rilegge come Uint8Array', () => {
    const p = nuovaPratica({ cognome: 'ROSSI', nome: 'MARIO', codiceFiscale: 'RSSMRA70A01D612X', albo: '03', numeroIscrizione: '1', provinciaAlbo: 'FI' });
    const u = nuovaUnita();
    u.planimetria = { progressivo: 7, formato: 'A4', scala: 200, poligoni: [], tiff: new Uint8Array([0x49, 0x49, 42, 0, 255, 1, 2, 3]), ntf: new Uint8Array(0) };
    p.unita.push(u);
    const testo = serializzaPratica(fileDi(p));
    expect(testo).toContain('"$bytes"');
    expect(testo).not.toContain('"0": 73');
    const letto = deserializzaPratica(testo);
    const pl = letto.pratica.unita[0].planimetria!;
    expect(pl.tiff).toBeInstanceOf(Uint8Array);
    expect([...pl.tiff!]).toEqual([0x49, 0x49, 42, 0, 255, 1, 2, 3]);
    expect(pl.ntf).toBeInstanceOf(Uint8Array);
    expect(pl.ntf!.length).toBe(0);
    expect(letto.meta.titolo).toBe('t');
    // un secondo giro produce lo stesso testo
    expect(serializzaPratica(letto)).toBe(testo);
  });

  it('rifiuta file di altro formato o di versione futura', () => {
    expect(() => deserializzaPratica('{"a":1}')).toThrow(/non è una pratica/);
    expect(() => deserializzaPratica(JSON.stringify({ formato: 'fa-catasto-doc', versione: 99, meta: {}, pratica: {} }))).toThrow(/versione più recente/);
  });

  it('legge ancora le pratiche salvate col vecchio nome (Catasto Semplice)', () => {
    const p = nuovaPratica({ cognome: 'ROSSI', nome: 'MARIO', codiceFiscale: 'RSSMRA70A01D612X', albo: '03', numeroIscrizione: '1', provinciaAlbo: 'FI' });
    const vecchio = serializzaPratica(fileDi(p)).replace('"fa-catasto-doc"', '"catasto-semplice"');
    const letto = deserializzaPratica(vecchio);
    expect(letto.formato).toBe('fa-catasto-doc');
  });

  it('clona in profondità conservando gli Uint8Array', () => {
    const o = { a: [1, { b: new Uint8Array([1, 2]) }], c: 'x' };
    const k = clonaProfondo(o);
    expect(k).not.toBe(o);
    expect(k.a[1]).not.toBe(o.a[1]);
    expect((k.a[1] as { b: Uint8Array }).b).toBeInstanceOf(Uint8Array);
    expect([...(k.a[1] as { b: Uint8Array }).b]).toEqual([1, 2]);
  });

  it('titolo proposto', () => {
    const p = nuovaPratica(tecnicoVuoto());
    expect(titoloProposto(p)).toBe('Pratica 1');
    p.comune.nome = 'FIRENZE';
    p.unita.push({ ...nuovaUnita(), identificativo: { foglio: '10', numero: '20', subalterno: '2' } });
    expect(titoloProposto(p)).toBe('FIRENZE – fg. 10 p.lla 20 sub 2');
  });
});

describe('controlli di completezza', () => {
  it('una pratica vuota ha errori; il campione NCV002 nessuno', () => {
    const vuota = controllaPratica(nuovaPratica(tecnicoVuoto()));
    expect(vuota.errori.length).toBeGreaterThan(3);
    expect(vuota.errori.some((e) => e.sezione === 'generali')).toBe(true);
    const dir = join(process.cwd(), 'fixtures-private', 'NCV002');
    if (!existsSync(join(dir, 'NCV002.DAT'))) return;
    const rd = (f: string) => new Uint8Array(readFileSync(join(dir, f)));
    const { pratica } = decompilaDocumento(rd('NCV002.DAT'), rd('NMV002.DAT'), rd('NCV002.ATT'));
    pratica.comune.nome = 'FIRENZE';
    pratica.comune.provincia = 'FI';
    pratica.unita[0].planimetria!.tiff = rd('0000007.001');
    const esito = controllaPratica(pratica);
    expect(esito.errori).toEqual([]);
    expect(esito.conteggi.variate).toBe(1);
    // la serializzazione non altera i record prodotti
    const giro = deserializzaPratica(serializzaPratica(fileDi(pratica))).pratica;
    expect(Buffer.from(compilaDocumento(giro).ncv.dati).equals(Buffer.from(compilaDocumento(pratica).ncv.dati))).toBe(true);
  });
});
