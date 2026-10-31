/**
 * Pipeline completa: dalla pratica al PDF/A da presentare.
 *   pratica → record (compile) → per ogni planimetria: TIFF dal DXF + NTF dai poligoni → PDF con annotazioni.
 */
import type { Pratica, Poligono, SchedaGrafica } from './model';
import { compilaDocumento, type Compilato } from './compile';
import { generaNtf } from './ntf';
import { sincronizzaDaPoligoni } from './superfici';
import { componiElaborato, componiPlanimetria } from './raster/planimetria';
import { renderDocumento, type ImmagineDocumento, type OpzioniDocumento } from './pdf/documento';
import { immagineDaTiff } from './pdf/tiff';
import { ALBI_TECNICO } from './regole-docfa';
import { letteraDocumento } from './compile';

export interface RisultatoEsportazione {
  pdf: Uint8Array;
  nomeFile: string;
  compilato: Compilato;
  immagini: ImmagineDocumento[];
  /** avvisi non bloccanti (es. planimetria senza poligoni) */
  avvisi: string[];
}

/** Albo come compare nel cartiglio della planimetria (plurale), per codice Docfa. */
export const ALBI: Record<string, string> = Object.fromEntries(ALBI_TECNICO.map((a) => [a.codice, a.dipendentePubblico ? a.descrizione : a.descrizione]));

function nomeProvincia(sigla: string): string {
  const nomi: Record<string, string> = { FI: 'Firenze', BO: 'Bologna', PO: 'Prato', PT: 'Pistoia', SI: 'Siena', AR: 'Arezzo', LU: 'Lucca', PI: 'Pisa', LI: 'Livorno', GR: 'Grosseto', MS: 'Massa-Carrara', RM: 'Roma', MI: 'Milano', TO: 'Torino', NA: 'Napoli' };
  return nomi[sigla.toUpperCase()] ?? sigla.toUpperCase();
}

/** Esporta la pratica nel PDF/A finale. */
export async function esportaPratica(p: Pratica, opzioni: OpzioniDocumento & { data?: Date } = {}): Promise<RisultatoEsportazione> {
  const avvisi: string[] = [];
  // dati metrici e superfici lorde del 1N parte II sempre allineati ai poligoni
  for (const u of p.unita) sincronizzaDaPoligoni(u);
  const compilato = compilaDocumento(p);
  const immagini: ImmagineDocumento[] = [];
  const provincia = nomeProvincia(p.comune.provincia);
  const nomeTecnico = `${capitalizza(p.tecnico.cognome)} ${capitalizza(p.tecnico.nome)}`;

  const nomeImmagine = (progressivo: number, scheda: number) => `${String(progressivo).padStart(7, '0')}.${String(scheda).padStart(3, '0')}`;

  // elaborato planimetrico: le sue schede vanno stampate prima delle planimetrie (come in Docfa: NCV065, NCV081)
  const ep = p.elaboratoPlanimetrico;
  if (ep) {
    const disegni = ep.disegni ?? [];
    if (!disegni.length) avvisi.push('Elaborato planimetrico senza disegno: nessuna scheda nel PDF');
    for (let k = 0; k < disegni.length; k++) {
      const d = disegni[k];
      const nome = nomeImmagine(ep.progressivoImmagine, k + 1);
      if (d.tiff) { immagini.push(immagineDaTiff(nome, d.tiff)); continue; }
      if (!d.dxf) { avvisi.push(`Elaborato planimetrico, scheda ${k + 1}: senza DXF, saltata`); continue; }
      const composta = await componiElaborato({
        dxf: d.dxf,
        foglio: { formato: d.formato, scala: d.scala },
        data: opzioni.data,
        cartiglio: {
          ufficio: provincia,
          comune: capitalizza(p.comune.nome),
          sezione: ep.identificativo.sezione,
          foglio: ep.identificativo.foglio,
          particella: ep.identificativo.numero,
          compilatore: nomeTecnico,
          albo: ALBI[p.tecnico.albo] ?? 'Tecnico',
          provincia: nomeProvincia(p.tecnico.provinciaAlbo),
          numeroAlbo: p.tecnico.numeroIscrizione.trim(),
          scala: d.scala,
        },
      });
      immagini.push({ nome, g4: composta.g4, width: composta.width, height: composta.height, formato: composta.foglio.formato });
    }
  }

  for (const u of p.unita) {
    const pl = u.planimetria;
    if (!pl) continue;
    const descr = descriviUiu(u.identificativo.foglio, u.identificativo.numero, u.identificativo.subalterno);
    // la scheda 1 è descritta dai campi della planimetria, le successive da altreSchede
    const schede: SchedaGrafica[] = [{ formato: pl.formato, scala: pl.scala, dxf: pl.dxf, tiff: pl.tiff, ntf: pl.ntf, poligoni: pl.poligoni }, ...(pl.altreSchede ?? [])];
    for (let k = 0; k < schede.length; k++) {
      const sc = schede[k];
      const nome = nomeImmagine(pl.progressivo, k + 1);
      const nomeNtf = `N${nome}`;
      if (sc.tiff) {
        // scheda importata da un documento esistente: la riusiamo tale e quale
        const ntf = sc.ntf?.length ? { dati: sc.ntf, nome: nomeNtf } : sc.poligoni.length ? { dati: generaNtf(pl.progressivo, k + 1, { formato: sc.formato, scala: sc.scala }, sc.poligoni), nome: nomeNtf } : undefined;
        immagini.push(immagineDaTiff(nome, sc.tiff, ntf));
        continue;
      }
      if (!sc.dxf) {
        avvisi.push(`Unità ${descr}: ${schede.length > 1 ? `scheda ${k + 1} della ` : ''}planimetria senza DXF, saltata`);
        continue;
      }
      const composta = await componiPlanimetria({
        dxf: sc.dxf,
        foglio: { formato: sc.formato, scala: sc.scala },
        data: opzioni.data,
        cartiglio: {
          ufficio: provincia,
          comune: capitalizza(p.comune.nome),
          via: u.indirizzo ? capitalizzaToponimo(u.indirizzo.toponimo) : '',
          civico: u.indirizzo?.civici[0] ?? '',
          sezione: u.identificativo.sezione,
          foglio: u.identificativo.foglio,
          particella: u.identificativo.numero,
          subalterno: u.identificativo.subalterno,
          compilatore: nomeTecnico,
          albo: ALBI[p.tecnico.albo] ?? 'Tecnico',
          provincia: nomeProvincia(p.tecnico.provinciaAlbo),
          numeroAlbo: p.tecnico.numeroIscrizione.trim(),
          scheda: k + 1,
          scala: sc.scala,
        },
      });
      const poligoni: Poligono[] = sc.poligoni.length ? sc.poligoni : composta.poligoni;
      if (!poligoni.length && k === 0 && !(pl.altreSchede ?? []).some((x) => x.poligoni.length)) avvisi.push(`Unità ${descr}: nessun poligono sul layer DOCFA_POLIGONI`);
      const ntf = poligoni.length ? generaNtf(pl.progressivo, k + 1, composta.foglio, poligoni) : undefined;
      // aggiorna la pratica con i poligoni letti dal DXF, così i record (ATT) sanno che ci sono
      if (!sc.poligoni.length && poligoni.length) {
        if (k === 0) pl.poligoni = poligoni;
        else pl.altreSchede![k - 1].poligoni = poligoni;
      }
      immagini.push({ nome, g4: composta.g4, width: composta.width, height: composta.height, ntf, nomeNtf: ntf ? nomeNtf : undefined, formato: composta.foglio.formato });
    }
  }
  // i poligoni letti dai DXF possono cambiare l'indice allegati: ricompila
  const finale = compilaDocumento(p);
  const pdf = await renderDocumento(p, finale, immagini, { ufficioProvinciale: provincia, ...opzioni });
  return { pdf, nomeFile: `NC${letteraDocumento(p)}${String(p.progressivo).padStart(3, '0')}.PDF`, compilato: finale, immagini, avvisi };
}

function descriviUiu(foglio: string, numero: string, sub?: string): string {
  return `fg. ${foglio} part. ${numero}${sub ? ` sub ${sub}` : ''}`;
}

export function capitalizza(s: string): string {
  return s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, sep: string, c: string) => sep + c.toUpperCase());
}

/** "via fiesolana" → "Via Fiesolana" (come nel cartiglio di Docfa). */
export function capitalizzaToponimo(s: string): string {
  return capitalizza(s);
}
