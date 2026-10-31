/**
 * Pagine dei modelli 1N (parte I per il fabbricato, parte II per ogni u.i.u.) e 2N (parte I e, per
 * ogni corpo di fabbrica, parte II), disegnate dai layout JSON estratti dai PDF di Docfa e riempite
 * con i valori dei record compilati.
 */
import type { Pratica } from '../../model';
import type { Compilato } from '../../compile';
import type { FixedRecord } from '../../tracciati/record';
import { decode1252 } from '../../bytes';
import { Pagina } from '../pagina';
import { FORMATO, intestazione, type DatiCornice } from '../cornice';
import { disegnaCampi, disegnaFissi, type ContestoModulo, type Layout } from '../layout';
import lay1NI1 from '../layout/1N-I-1.json';
import lay1NI2 from '../layout/1N-I-2.json';
import lay1NII1 from '../layout/1N-II-1.json';
import lay1NII2 from '../layout/1N-II-2.json';
import lay2NI1 from '../layout/2N-I-1.json';
import lay2NI2 from '../layout/2N-I-2.json';
import lay2NII from '../layout/2N-II.json';

export const LAYOUT: Record<string, Layout> = {
  '1N-I-1': lay1NI1 as unknown as Layout,
  '1N-I-2': lay1NI2 as unknown as Layout,
  '1N-II-1': lay1NII1 as unknown as Layout,
  '1N-II-2': lay1NII2 as unknown as Layout,
  '2N-I-1': lay2NI1 as unknown as Layout,
  '2N-I-2': lay2NI2 as unknown as Layout,
  '2N-II': lay2NII as unknown as Layout,
};

function progressivo(r: FixedRecord): number {
  return Number(r.get('progressivo'));
}

/** Pagina di un modello: modulo fisso + valori. */
export function paginaModello(nome: string, ctx: ContestoModulo, cornice: DatiCornice): Pagina {
  const p = new Pagina(FORMATO.modello.larghezza, FORMATO.modello.altezza);
  intestazione(p, cornice);
  const layout = LAYOUT[nome];
  disegnaFissi(p, layout);
  disegnaCampi(p, layout, ctx);
  return p;
}

export function pagineModelli(pratica: Pratica, compilato: Compilato, cornice: DatiCornice): Pagina[] {
  const pagine: Pagina[] = [];
  const recs = compilato.records;
  const tipo = (t: string) => recs.filter((r) => r.schema.type === t);

  // modello 1N parte I (record B e C)
  const rB = tipo('B')[0];
  const rC = tipo('C')[0];
  if (rB && rC) {
    pagine.push(paginaModello('1N-I-1', { records: { B: rB } }, cornice));
    pagine.push(paginaModello('1N-I-2', { records: { C: rC } }, cornice));
  }

  // modello 1N parte II per ogni u.i.u. (record H, I, L)
  pratica.unita.forEach((u, idx) => {
    const n = idx + 1;
    const rH = tipo('H').find((r) => progressivo(r) === n);
    if (!rH) return;
    const rI = tipo('I').find((r) => progressivo(r) === n);
    const osservazioni = tipo('L').filter((r) => progressivo(r) === n).map((r) => r.get('osservazioni').trimEnd()).join('');
    const categoria = u.classamento?.categoria ?? rH.get('categoria');
    const ctx: ContestoModulo = {
      records: { H: rH, I: rI },
      testi: { osservazioni },
      gruppo: categoria.trim().startsWith('C') ? 'C' : 'AB',
    };
    pagine.push(paginaModello('1N-II-1', ctx, cornice));
    pagine.push(paginaModello('1N-II-2', ctx, cornice));
  });

  // modello 2N per ogni u.i.u. a destinazione speciale (record M, N, O e, per corpo, P, Q, R)
  pratica.unita.forEach((_u, idx) => {
    const n = idx + 1;
    const rM = tipo('M').find((r) => progressivo(r) === n);
    if (!rM) return;
    const rN = tipo('N').find((r) => progressivo(r) === n);
    const rO = tipo('O').filter((r) => progressivo(r) === n);
    const comparativa = rO.filter((r) => r.get('tipo_stima') === '0');
    const altro = rO.filter((r) => r.get('tipo_stima') === '1').map((r) => decode1252(r.buf.subarray(18, 318)).trimEnd()).join('');
    pagine.push(paginaModello('2N-I-1', { records: { M: rM, N: rN } }, cornice));
    pagine.push(paginaModello('2N-I-2', { records: { N: rN }, recordsO: comparativa, testi: { altro_tipo_stima: altro } }, cornice));
    for (const rP of tipo('P').filter((r) => progressivo(r) === n)) {
      const corpo = decode1252(rP.buf.subarray(11, 14));
      const stessoCorpo = (r: FixedRecord) => progressivo(r) === n && decode1252(r.buf.subarray(11, 14)) === corpo;
      const rQ = tipo('Q').find(stessoCorpo);
      const rR = tipo('R').find(stessoCorpo);
      pagine.push(paginaModello('2N-II', { records: { P: rP, Q: rQ, R: rR } }, cornice));
    }
  });
  return pagine;
}
