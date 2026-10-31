/**
 * Regressioni dei difetti trovati nell'audit del 31/10/2026.
 */
import { describe, it, expect } from 'vitest';
import { compilaDocumento, ambientiDatiMetrici } from '../compile';
import { splitCRLF } from '../bytes';
import { leggiDxf } from '../raster/dxf';
import { preparaDxf } from '../raster/dxf-correzioni';
import { esportaPratica } from '../esporta';
import { importaPdfDocfa } from '../pdf/importa';
import { nuovaPratica, nuovaUnita } from '$lib/stato/pratica-file';
import type { Pratica } from '../model';

const TECNICO = { cognome: 'ROSSI', nome: 'MARIO', codiceFiscale: 'RSSMRA70A01D612X', albo: '03', numeroIscrizione: '1234', provinciaAlbo: 'FI' };

function dxf(entities: string[]): string {
  return ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1032', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'BLOCKS', '0', 'BLOCK', '8', '0', '2', 'PORTA', '70', '0', '10', '0', '20', '0',
    '0', 'ARC', '8', '0', '10', '0', '20', '0', '40', '1', '50', '0', '51', '90', '0', 'ENDBLK', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES', ...entities, '0', 'ENDSEC', '0', 'EOF'].join('\r\n');
}
const rett = (layer: string, x0: number, y0: number, w: number, h: number, extra: string[] = []) =>
  ['0', 'LWPOLYLINE', '8', layer, ...extra, '90', '4', '70', '1', '10', String(x0), '20', String(y0), '10', String(x0 + w), '20', String(y0), '10', String(x0 + w), '20', String(y0 + h), '10', String(x0), '20', String(y0 + h)];

function variazione(): Pratica {
  const p = nuovaPratica(TECNICO, 'variazione', 7);
  p.comune = { codice: 'D612', codiceAmministrativo: 'I1AA', nome: 'FIRENZE', provincia: 'FI' };
  const u = nuovaUnita('V');
  u.identificativo = { foglio: '12', numero: '345', subalterno: '1' };
  u.classamento = { zonaCensuaria: '1', categoria: 'A03', classe: '3', consistenza: '4,5', superficieCatastale: 80, rendita: 650.74, classamentoAutomatico: false };
  p.unita = [u];
  return p;
}

describe('regressioni audit 31/10/2026', () => {
  it('un a capo nelle note non finisce nei record a lunghezza fissa', () => {
    const p = variazione();
    p.annotazioni = 'riga uno\nriga due\r\nriga tre';
    p.unita[0].mod1NParteII!.osservazioni = 'prima\nseconda';
    const c = compilaDocumento(p);
    for (const r of splitCRLF(c.ncv.dati)) expect([...r].includes(0x0a) || [...r].includes(0x0d)).toBe(false);
  });

  it('superfici del 1N parte II con decimali: la compilazione non fallisce', () => {
    const p = variazione();
    const m = p.unita[0].mod1NParteII!;
    m.superficieLorda = 85.5;
    m.balconiSup = 4.4;
    expect(() => compilaDocumento(p)).not.toThrow();
  });

  it('dati metrici: per i gruppi A e B gli ambienti G non ci sono (né nel file né nella stampa)', () => {
    const u = variazione().unita[0];
    u.ambienti = [{ tipo: 'A', superficie: 80, altezzaMin: 0, altezzaMax: 0 }, { tipo: 'G', superficie: 6, altezzaMin: 0, altezzaMax: 0 }];
    expect(ambientiDatiMetrici(u).map((a) => a.tipo)).toEqual(['A']);
    u.classamento!.categoria = 'C02';
    expect(ambientiDatiMetrici(u).map((a) => a.tipo)).toEqual(['A', 'G']);
  });

  it('arco in un blocco specchiato (porta specchiata): angoli riflessi e verso invertito', () => {
    const ins = (sx: number, sy: number) => ['0', 'INSERT', '8', '0', '2', 'PORTA', '10', '5', '20', '5', '41', String(sx), '42', String(sy)];
    const arco = (sx: number, sy: number) => leggiDxf(dxf(ins(sx, sy))).entita.find((e) => e.tipo === 'arco')!;
    const norm = (a: number) => ((a % 360) + 360) % 360;
    const a = arco(-1, 1);
    expect(a.tipo === 'arco' && [norm(a.inizio), norm(a.fine)]).toEqual([90, 180]);
    const b = arco(1, -1);
    expect(b.tipo === 'arco' && [norm(b.inizio), norm(b.fine)]).toEqual([270, 0]);
    const c = arco(1, 1);
    expect(c.tipo === 'arco' && [norm(c.inizio), norm(c.fine)]).toEqual([0, 90]);
  });

  it('DXF in centimetri: anche lo spessore delle linee viene convertito in metri', () => {
    const { letto } = preparaDxf(dxf([...rett('RIQUADRO', 0, 0, 3900, 4700), ...rett('MURI', 100, 100, 500, 400, ['43', '30'])]));
    const muro = letto.entita.find((e) => e.layer !== 'RIQUADRO' && e.tipo === 'polilinea' && e.spessore > 0);
    expect(muro?.spessore).toBeCloseTo(0.3, 6);
  });

  it('un accatastamento esportato (NCA) si reimporta', async () => {
    const p = nuovaPratica(TECNICO, 'accatastamento', 10);
    p.comune = { codice: 'D612', codiceAmministrativo: 'I1AA', nome: 'FIRENZE', provincia: 'FI' };
    const d = p.quadroA!.ditte[0];
    d.tipoMappale = { numero: 123456, data: { gg: 3, mm: 4, aaaa: 2026 } };
    d.unitaOrdinarie = 1;
    d.intestati = [{ tipo: 'fisica', cognome: 'BIANCHI', nome: 'ANNA', sesso: 'F', nascita: { gg: 1, mm: 2, aaaa: 1970 }, provincia: 'FI', comune: 'FIRENZE', codiceFiscale: 'BNCNNA70B41D612Z', titolo: '01 ', quotaNumeratore: '1', quotaDenominatore: 1 }];
    const u = nuovaUnita('C');
    u.identificativo = { foglio: '12', numero: '345', subalterno: '1' };
    u.indirizzo = { toponimo: 'via fiesolana', civici: ['48'], piani: ['T'] };
    u.classamento = { zonaCensuaria: '1', categoria: 'A03', classe: '3', consistenza: '4,5', superficieCatastale: 80, rendita: 650.74, classamentoAutomatico: false };
    p.unita = [u];
    p.dichiarante = { cognome: 'BIANCHI', nome: 'ANNA', comune: 'FIRENZE', provincia: 'FI', indirizzo: 'VIA FIESOLANA', civico: 'SNC', cap: '50121' };
    const r = await esportaPratica(p);
    expect(r.nomeFile).toBe('NCA010.PDF');
    const imp = await importaPdfDocfa(r.pdf);
    expect(imp.pratica.tipoDocumento).toBe('accatastamento');
    expect(imp.pratica.unita[0].identificativo.subalterno).toBe('1');
  }, 60000);
});
