/**
 * «Visura attuale per immobile» nel formato a voci (non a tabella): un riquadro iniziale «Informazioni riportate
 * negli atti del catasto al …» con identificativi, classamento, indirizzo e superficie, poi l'intestazione. A
 * sinistra i dati, a destra (x ≥ ~300) le causali di aggiornamento, che qui non servono.
 */
import { righe as righeDi, type PaginaTesto } from './testo';
import { leggiAnagrafica, leggiConsistenza, leggiDiritti, leggiIndirizzo, leggiRendita } from './formati';
import type { ImmobileVisura, IntestatoVisura, Visura } from './tipi';

/** il testo della colonna dei dati (a sinistra delle causali), riga per riga, senza note a piè di pagina */
function colonnaDati(pagine: PaginaTesto[]): string[] {
  const out: string[] = [];
  for (const p of pagine) {
    // la colonna delle causali comincia a metà pagina (x ≈ 310 su 595): una riga che ha lì un elemento lo ha
    // dalla colonna di destra in poi; le altre (es. «Totale escluse aree scoperte : 91 m²») restano intere
    const meta = (p.larghezza ?? 595) * 0.5;
    for (const r of righeDi(p.elementi)) {
      const ordinati = [...r.elementi].sort((x, y) => x.x - y.x);
      const taglio = ordinati.findIndex((e) => e.x >= meta && e.x < meta + 25);
      const t = (taglio < 0 ? ordinati : ordinati.slice(0, taglio)).map((e) => e.testo).join(' ').replace(/\s+/g, ' ').trim();
      // richiami di nota («a)», «b)») ed esponenti («2» di m²) stanno su righe a sé
      if (!t || /^([a-z]\)|\d)(\s+([a-z]\)|\d))*$/.test(t)) continue;
      out.push(t);
    }
  }
  return out;
}

export function eVisuraPerImmobile(pagine: PaginaTesto[]): boolean {
  const t = colonnaDati(pagine).join('\n');
  return /Visura (attuale|storica) per immobile/i.test(t) && /Informazioni riportate negli atti del catasto/i.test(t);
}

export function analizzaVisuraImmobile(pagine: PaginaTesto[]): Visura {
  const righe = colonnaDati(pagine);
  const tutto = righe.join('\n');
  const v: Visura = { tipo: 'immobile', storica: /storica per immobile/i.test(tutto), titolo: /Visura (attuale|storica) per immobile/i.exec(tutto)?.[0], immobili: [], intestati: [], avvisi: [] };
  v.situazioneAl = /Situazione degli atti informatizzati al (\d{2}\/\d{2}\/\d{4})/i.exec(tutto)?.[1];
  // riquadro iniziale: dalla prima «Informazioni riportate…» fino ad «Annotazioni» o alla sezione successiva
  const i0 = righe.findIndex((r) => /^Informazioni riportate negli atti/i.test(r));
  const i1 = righe.findIndex((r, k) => k > i0 && /^(Dati identificativi$|Intestazione|Mappali|Unit[aà] immobiliari)/i.test(r));
  const blocco = righe.slice(i0, i1 > i0 ? i1 : undefined).join(' ');
  if (i0 < 0 || !blocco) { v.avvisi.push('Visura per immobile: riquadro dei dati attuali non trovato'); return v; }

  const comune = /Comune di\s+(.+?)\s*\(\s*([A-Z]\d{3})\s*\)/.exec(blocco);
  const ids = [...blocco.matchAll(/(?:Sezione(?: Urbana)?\s+(\w+)\s+)?Foglio\s+(\w+)\s+Particella\s+(\d+)(?:\s*\/\s*(\d+))?(?:\s+Subalterno\s+(\w+))?/g)];
  if (!ids.length) { v.avvisi.push('Visura per immobile: foglio e particella non letti'); return v; }
  const [, sez, foglio, numero, , sub] = ids[0];
  const im: ImmobileVisura = { foglio, numero, categoria: '', comune: { nome: comune?.[1].trim() ?? '', codice: comune?.[2] ?? '' }, gruppo: 1, progressivo: 1 };
  if (sez) im.sezione = sez;
  if (sub) im.subalterno = sub;
  if (ids.length > 1) im.graffati = ids.slice(1).map(([, s, f, n, , b]) => ({ sezione: s || im.sezione, foglio: f, numero: n, subalterno: b || undefined }));
  const cat = /Categoria\s+([A-F])\s*\/\s*(\d{1,2})/.exec(blocco);
  if (cat) im.categoria = `${cat[1]}/${cat[2]}`;
  else v.avvisi.push('Visura per immobile: categoria non letta');
  const classe = /Classe\s+(\w+)/.exec(blocco);
  if (classe) im.classe = classe[1];
  const cons = /Consistenza\s+([\d.,]+\s*(?:vani|m\s*2|m\s*3|mq|mc|m²|m³))/i.exec(blocco);
  if (cons) {
    const c = leggiConsistenza(cons[1].replace(/m\s*2\b/i, 'm²').replace(/m\s*3\b/i, 'm³').replace(/\bmq\b/i, 'm²').replace(/\bmc\b/i, 'm³'));
    if (c) { im.consistenza = c.consistenza; im.unitaConsistenza = c.unita; }
  }
  const zona = /Zona censuaria\s+(\w+)/.exec(blocco);
  if (zona) im.zonaCensuaria = zona[1];
  const micro = /Micro\s*zona\s+(\w+)/i.exec(blocco);
  if (micro) im.microzona = micro[1];
  const rendita = /Rendita:\s*(Euro\s*[\d.,]+)/.exec(blocco);
  if (rendita) im.rendita = leggiRendita(rendita[1]);
  const ind = /Indirizzo:\s*(.+?)(?=\s+Dati di superficie|\s+Ultimo atto|\s+Annotazioni|$)/.exec(blocco);
  if (ind) im.indirizzo = leggiIndirizzo(ind[1]);
  const sup = /Totale:\s*(\d+)\s*m/.exec(blocco);
  if (sup) im.superficieCatastale = Number(sup[1]);
  const supSenza = /Totale escluse aree scoperte\D*?(\d+)\s*m/.exec(blocco);
  if (supSenza) im.superficieSenzaAree = Number(supSenza[1]);
  const ultimo = /Ultimo atto di aggiornamento:\s*(.+?)(?=\s+Annotazioni:|$)/.exec(blocco);
  if (ultimo) im.datiDerivanti = ultimo[1].trim();
  const ann = /Annotazioni:\s*(.+)$/.exec(blocco);
  if (ann) im.annotazioni = [ann[1].trim()];
  v.immobili.push(im);

  // intestazione attuale: «1. COGNOME Nome», «(CF …)», «nato a … il …», «Diritto di: Proprieta' per 1/1 …»
  const j0 = righe.findIndex((r) => /^Intestazione attuale dell'immobile/i.test(r));
  if (j0 >= 0) {
    let cur: string[] | null = null;
    const blocchi: string[][] = [];
    for (let k = j0 + 1; k < righe.length; k++) {
      const r = righe[k];
      if (/^(Visura telematica|Legenda|Unit[aà] immobiliari|Situazione)/i.test(r)) break;
      if (/^\d+\.\s/.test(r)) { cur = [r.replace(/^\d+\.\s*/, '')]; blocchi.push(cur); } else if (cur) cur.push(r);
    }
    blocchi.forEach((b, k) => {
      const t = b.join(' ');
      const cf = /\(\s*CF\s+([A-Z0-9]{11,16})\s*\)/i.exec(t);
      const dir = /Diritto di:\s*(.+?)(?:\s*\(deriva.*)?$/i.exec(t);
      const anag = t.replace(/\(\s*CF[^)]*\)/i, ' ').replace(/Diritto di:.*$/i, ' ').trim();
      const it: IntestatoVisura = { gruppo: 1, progressivo: k + 1, ...leggiAnagrafica(anag), testoAnagrafico: anag };
      if (cf) it.codiceFiscale = cf[1].toUpperCase();
      if (dir) Object.assign(it, leggiDiritti(dir[1]), { testoDiritti: dir[1] });
      v.intestati.push(it);
    });
  }
  if (!v.intestati.length) v.avvisi.push('Nessun intestato trovato');
  if (v.storica) v.avvisi.push('Visura storica: letta solo la situazione attuale');
  return v;
}
