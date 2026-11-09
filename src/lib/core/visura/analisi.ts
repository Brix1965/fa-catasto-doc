/**
 * Analisi del testo posizionato di una visura Sister: sezioni per comune, tabella degli immobili del Catasto
 * Fabbricati (colonne dalle intestazioni), intestati.
 *
 * Righe della tabella: un immobile inizia con il numero nella colonna "N." e comprende tutto il testo che segue
 * nel flusso del PDF fino al numero successivo (indirizzo sopra la riga, dati derivanti e superfici su più righe,
 * righe spezzate tra due pagine). Le colonne si assegnano per posizione orizzontale, con i confini cercati negli
 * spazi vuoti tra i centri delle intestazioni (le colonne di testo sono allineate a sinistra, le altre centrate).
 */
import type { ImmobileVisura, IntestatoVisura, TipoVisura, Visura } from './tipi';
import { righe as righeDi, testoCella, type ElementoTesto, type PaginaTesto, type Riga } from './testo';
import { leggiAnagrafica, leggiConsistenza, leggiDiritti, leggiIndirizzo, leggiRendita, leggiSuperficie } from './formati';

type ChiaveImm =
  | 'n' | 'sezione' | 'foglio' | 'numero' | 'sub' | 'zona' | 'micro' | 'categoria' | 'classe' | 'consistenza'
  | 'superficie' | 'rendita' | 'indirizzo' | 'derivanti' | 'indirizzoDerivanti' | 'ulteriori';
type ChiaveInt = 'n' | 'anagrafica' | 'cf' | 'diritti';

interface Colonna<K extends string> { chiave: K; sx: number; dx: number; c: number }
interface Parola { testo: string; x: number; w: number; y: number }

/** parole delle intestazioni della tabella immobili; null = parola d'intestazione senza colonna */
const PAROLE_IMM: Record<string, ChiaveImm | null | 'zona?'> = {
  'n.': 'n', n: 'n', sez: 'sezione', 'sez.': 'sezione', sezione: 'sezione', urbana: 'sezione', foglio: 'foglio',
  numero: 'numero', particella: 'numero', sub: 'sub', 'sub.': 'sub', zona: 'zona?', 'cens.': 'zona', cens: 'zona',
  micro: 'micro', categoria: 'categoria', classe: 'classe', consistenza: 'consistenza', superficie: 'superficie',
  catastale: 'superficie', rendita: 'rendita', indirizzo: 'indirizzo', derivanti: 'derivanti', ulteriori: 'ulteriori',
  dati: null, da: null, di: null, identificativi: null, classamento: null, altre: null, informazioni: null,
};
const PAROLE_INT: Record<string, ChiaveInt | null> = {
  'n.': 'n', n: 'n', dati: 'anagrafica', anagrafici: 'anagrafica', codice: 'cf', fiscale: 'cf',
  diritti: 'diritti', e: 'diritti', oneri: 'diritti', reali: 'diritti',
};

const RE_TESTATA = /^(Direzione Provinciale|Ufficio Provinciale|Servizi Catastali|Situazione degli atti informatizzati|Visura (n\.|attuale|storica|sintetica|per)|Data:|pag:)/i;
const RE_SEZIONE = /^(\d+)\.\s*Immobili siti nel Comune di\s+(.+?)\s*\(\s*Codice:?\s*([A-Z]\d{3})\s*\)\s*(.*)$/i;
const RE_COMUNE = /Comune di\s+(.+?)\s*\(\s*(?:Codice:?\s*)?([A-Z]\d{3})\s*\)/i;
const RE_DATA = /(\d{2}\/\d{2}\/\d{4})/;

/** Parole di un elemento con x stimata in proporzione ai caratteri (le intestazioni possono essere unite). */
function parole(e: ElementoTesto): Parola[] {
  const out: Parola[] = [];
  const n = e.testo.length || 1;
  for (const m of e.testo.matchAll(/\S+/g)) {
    out.push({ testo: m[0].toLowerCase(), x: e.x + (e.w * m.index) / n, w: (e.w * m[0].length) / n, y: e.y });
  }
  return out;
}

function eIntestazioneImm(r: Riga): boolean {
  return r.elementi.every((e) => parole(e).every((p) => p.testo in PAROLE_IMM));
}

function colonneImm(band: Riga[]): Colonna<ChiaveImm>[] {
  const pp = band.flatMap((r) => r.elementi.flatMap(parole));
  const per = new Map<ChiaveImm, Parola[]>();
  const add = (k: ChiaveImm, p: Parola) => per.set(k, [...(per.get(k) ?? []), p]);
  const zone: Parola[] = [];
  for (const p of pp) {
    const k = PAROLE_IMM[p.testo];
    if (k === 'zona?') zone.push(p);
    else if (k) add(k, p);
  }
  // "Zona" sopra "Cens." e sopra "Micro" (o sotto): alla colonna più vicina, altrimenti la prima è la zona censuaria
  const centro = (l: Parola[] | undefined) => (l?.length ? l.reduce((s, p) => s + p.x + p.w / 2, 0) / l.length : undefined);
  zone.sort((a, b) => a.x - b.x).forEach((p, i) => {
    const c = p.x + p.w / 2;
    const cz = centro(per.get('zona'));
    const cm = centro(per.get('micro'));
    if (cz !== undefined || cm !== undefined) add(Math.abs(c - (cz ?? Infinity)) <= Math.abs(c - (cm ?? Infinity)) ? 'zona' : 'micro', p);
    else add(i === 0 ? 'zona' : 'micro', p);
  });
  let col: Colonna<ChiaveImm>[] = [...per].map(([chiave, l]) => {
    const sx = Math.min(...l.map((p) => p.x));
    const dx = Math.max(...l.map((p) => p.x + p.w));
    return { chiave, sx, dx, c: (sx + dx) / 2 };
  });
  // sintetica: indirizzo e dati derivanti nella stessa colonna, su due righe
  const ind = col.find((c) => c.chiave === 'indirizzo');
  const der = col.find((c) => c.chiave === 'derivanti');
  if (ind && der && Math.abs(ind.c - der.c) < 20) {
    col = col.filter((c) => c !== ind && c !== der);
    const sx = Math.min(ind.sx, der.sx);
    const dx = Math.max(ind.dx, der.dx);
    col.push({ chiave: 'indirizzoDerivanti', sx, dx, c: (sx + dx) / 2 });
  }
  return col.sort((a, b) => a.c - b.c);
}

function colonneInt(r: Riga): Colonna<ChiaveInt>[] {
  const per = new Map<ChiaveInt, Parola[]>();
  for (const p of r.elementi.flatMap(parole)) {
    const k = PAROLE_INT[p.testo];
    if (k) per.set(k, [...(per.get(k) ?? []), p]);
  }
  return [...per]
    .map(([chiave, l]) => {
      const sx = Math.min(...l.map((p) => p.x));
      const dx = Math.max(...l.map((p) => p.x + p.w));
      return { chiave, sx, dx, c: (sx + dx) / 2 };
    })
    .sort((a, b) => a.c - b.c);
}

/** Confini tra colonne adiacenti: centro del più ampio tratto vuoto tra i due centri d'intestazione. */
function confini<K extends string>(col: Colonna<K>[], el: ElementoTesto[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < col.length; i++) {
    const a = col[i].c;
    const b = col[i + 1].c;
    const tratti = el
      .map((e) => [Math.max(a, e.x), Math.min(b, e.x + e.w)] as const)
      .filter(([da, al]) => al > da)
      .sort((p, q) => p[0] - q[0]);
    // vuoti prima del testo più a destra; quello finale (fino al centro di b) solo se non ce ne sono altri:
    // il testo allineato a sinistra di b può finire prima del centro della sua intestazione
    let meglio: [number, number] | undefined;
    let cur = a;
    for (const [da, al] of tratti) {
      if (da > cur && (!meglio || da - cur > meglio[1] - meglio[0])) meglio = [cur, da];
      cur = Math.max(cur, al);
    }
    if (!meglio && b > cur) meglio = [cur, b];
    out.push(meglio ? (meglio[0] + meglio[1]) / 2 : (col[i].dx + col[i + 1].sx) / 2);
  }
  return out;
}

function assegna<K extends string>(col: Colonna<K>[], el: ElementoTesto[]): Map<ElementoTesto, K> {
  const lim = confini(col, el);
  const out = new Map<ElementoTesto, K>();
  for (const e of el) {
    const cx = e.x + e.w / 2;
    let i = 0;
    while (i < lim.length && cx >= lim[i]) i++;
    out.set(e, col[i].chiave);
  }
  return out;
}

interface Segmento { colonne: Colonna<ChiaveImm>[]; elementi: ElementoTesto[] }
interface Sezione {
  gruppo: number;
  comune: { nome: string; codice: string };
  segmenti: Segmento[];
  /** "Immobile n: Annotazione: …" per numero d'ordine */
  annotazioni: Map<number, string[]>;
  /** righe fuori tabella della visura per immobile ("Indirizzo …"), per numero d'ordine */
  indirizzi: Map<number, string>;
  righe: number;
}
interface TabellaIntestati { gruppo: number; colonne: Colonna<ChiaveInt>[]; righe: Riga[] }

/** Toglie i campi non valorizzati. */
function pulisci<T extends object>(o: T): T {
  for (const k of Object.keys(o)) if ((o as Record<string, unknown>)[k] === undefined) delete (o as Record<string, unknown>)[k];
  return o;
}

function tipoDa(titolo: string | undefined): TipoVisura {
  if (!titolo) return 'altro';
  if (/per\s+immobile/i.test(titolo)) return 'immobile';
  if (/sintetica/i.test(titolo) && /per\s+soggetto/i.test(titolo)) return 'sintetica-soggetto';
  return 'altro';
}

/** Toglie la testata ripetuta in cima a ogni pagina (dopo averne letto titolo e date). */
function senzaTestata(p: PaginaTesto, v: Visura): ElementoTesto[] {
  const testata = p.elementi.filter((e) => e.y > p.altezza * 0.75 && RE_TESTATA.test(e.testo));
  for (const e of testata) {
    if (!v.titolo && /^Visura (attuale|storica|sintetica|per)/i.test(e.testo)) v.titolo = e.testo;
    if (!v.data && /^Data:/i.test(e.testo)) v.data = RE_DATA.exec(e.testo)?.[1];
    if (!v.situazioneAl && /^Situazione degli atti/i.test(e.testo)) v.situazioneAl = /(\d{2}\/\d{2}\/\d{4})\s*$/.exec(e.testo)?.[1];
  }
  if (!testata.length) return p.elementi;
  const taglio = Math.min(...testata.map((e) => e.y)) - 1;
  return p.elementi.filter((e) => e.y < taglio);
}

export function analizzaVisura(pagine: PaginaTesto[]): Visura {
  const v: Visura = { tipo: 'altro', storica: false, immobili: [], intestati: [], avvisi: [] };
  const avviso = (s: string) => { if (!v.avvisi.includes(s)) v.avvisi.push(s); };
  const linee = righeDi(pagine.flatMap((p) => senzaTestata(p, v)));
  v.tipo = tipoDa(v.titolo);
  v.storica = /storica/i.test(v.titolo ?? '');

  const sezioni: Sezione[] = [];
  const tabInt: TabellaIntestati[] = [];
  let sez: Sezione | undefined;
  let seg: Segmento | undefined;
  let ti: TabellaIntestati | undefined;
  let comune: { nome: string; codice: string } | undefined;
  let gruppoInt: number | undefined;
  let modo: 'libero' | 'fabbricati' | 'intestati' | 'annotazione' | 'ignora' = 'libero';
  let margine = 0;
  let annotazione: string[] | undefined;
  let storicoImm = false;
  let storicoInt = false;
  let dichiarate: number | undefined;
  let conTerreni = false;

  for (let i = 0; i < linee.length; i++) {
    const r = linee[i];
    const t = r.testo;
    const x0 = r.elementi[0].x;
    const parl = r.elementi.flatMap(parole).map((p) => p.testo);

    // intestazione della tabella immobili (anche ripetuta sulle pagine seguenti)
    if (eIntestazioneImm(r) && (parl.includes('identificativi') || (parl.includes('foglio') && parl.includes('categoria')))) {
      const band = [r];
      while (i + 1 < linee.length && linee[i + 1].pagina === r.pagina && r.y - linee[i + 1].y < 40 && eIntestazioneImm(linee[i + 1])) band.push(linee[++i]);
      const colonne = colonneImm(band);
      margine = Math.min(...colonne.map((c) => c.sx)) - 3;
      if (!colonne.some((c) => c.chiave === 'categoria')) {
        if (!conTerreni) avviso('Tabelle del Catasto Terreni non lette: si leggono solo i fabbricati');
        conTerreni = true;
        modo = 'ignora';
      } else if (storicoImm) {
        avviso('Visura storica: lette solo le situazioni attuali');
        modo = 'ignora';
      } else {
        if (!sez) {
          sez = { gruppo: 1, comune: comune ?? { nome: '', codice: '' }, segmenti: [], annotazioni: new Map(), indirizzi: new Map(), righe: 0 };
          sezioni.push(sez);
        }
        seg = { colonne, elementi: [] };
        sez.segmenti.push(seg);
        modo = 'fabbricati';
      }
      continue;
    }
    // intestazione della tabella intestati
    if (parl.includes('anagrafici') && parl.includes('fiscale')) {
      const colonne = colonneInt(r);
      margine = Math.min(...colonne.map((c) => c.sx)) - 3;
      if (storicoInt) {
        avviso('Visura storica: lette solo le situazioni attuali');
        modo = 'ignora';
      } else {
        // continuazione su una nuova pagina: stessa tabella
        if (!ti || ti.gruppo !== (gruppoInt ?? sez?.gruppo ?? 1) || modo !== 'intestati') {
          ti = { gruppo: gruppoInt ?? sez?.gruppo ?? 1, colonne, righe: [] };
          tabInt.push(ti);
        }
        modo = 'intestati';
      }
      continue;
    }

    // righe dentro le tabelle
    if (modo !== 'libero' && x0 >= margine) {
      if (modo === 'fabbricati' && seg && sez) {
        seg.elementi.push(...r.elementi);
        const n = seg.colonne.find((c) => c.chiave === 'n');
        if (n && r.elementi.some((e) => /^\d+$/.test(e.testo) && e.x >= n.sx - 8 && e.x + e.w <= n.dx + 8)) sez.righe++;
        continue;
      }
      if (modo === 'intestati' && ti) {
        ti.righe.push(r);
        continue;
      }
      if (modo === 'annotazione' && annotazione && !/^Immobile\s+\d+\s*:/i.test(t)) {
        annotazione[annotazione.length - 1] += ' ' + t;
        continue;
      }
      if (modo === 'ignora') continue;
    }
    modo = 'libero';

    let m: RegExpExecArray | null;
    if ((m = RE_SEZIONE.exec(t))) {
      comune = { nome: m[2].trim(), codice: m[3].toUpperCase() };
      sez = { gruppo: Number(m[1]), comune, segmenti: [], annotazioni: new Map(), indirizzi: new Map(), righe: 0 };
      sezioni.push(sez);
      seg = undefined;
      gruppoInt = undefined;
      continue;
    }
    if ((m = /^Intestazione degli immobili indicati al n\.?\s*(\d+)/i.exec(t))) {
      gruppoInt = Number(m[1]);
      continue;
    }
    if (/^INTESTAT[OI]\b/.test(t)) {
      gruppoInt = sez?.gruppo ?? 1;
      continue;
    }
    if ((m = /^Immobile\s+(\d+)\s*:\s*(?:Annotazion[ei]\s*:?\s*)?(.*)$/i.exec(t)) && sez) {
      const k = Number(m[1]);
      annotazione = sez.annotazioni.get(k) ?? [];
      annotazione.push(m[2].trim());
      sez.annotazioni.set(k, annotazione);
      margine = r.elementi[r.elementi.length - 1].x - 3;
      modo = 'annotazione';
      continue;
    }
    // visura per immobile: indirizzo e annotazioni sotto la tabella
    if ((m = /^Indirizzo\s*:?\s+(.+)$/.exec(t)) && sez && sez.righe > 0) {
      if (!sez.indirizzi.has(sez.righe)) sez.indirizzi.set(sez.righe, m[1]);
      continue;
    }
    if ((m = /^Annotazion[ei]\s*:?\s+(.+)$/i.exec(t)) && sez && sez.righe > 0) {
      sez.annotazioni.set(sez.righe, [...(sez.annotazioni.get(sez.righe) ?? []), m[1]]);
      continue;
    }
    if (v.tipo === 'immobile' && /^Situazione dell'unit/i.test(t) && sezioni.some((s) => s.righe > 0)) storicoImm = true;
    if (v.tipo === 'immobile' && /^Situazione degli intestati/i.test(t) && tabInt.some((x) => x.righe.length)) storicoInt = true;
    if ((m = /Unit[aà] immobiliari n\.\s*(\d+)/i.exec(t))) dichiarate = Number(m[1]);
    if (!sez && (m = RE_COMUNE.exec(t))) comune = { nome: m[1].trim(), codice: m[2].toUpperCase() };
  }

  for (const s of sezioni) v.immobili.push(...immobiliSezione(s, avviso));
  for (const x of tabInt) v.intestati.push(...intestatiTabella(x));

  if (!v.immobili.length) avviso('Nessun immobile del Catasto Fabbricati trovato');
  if (!v.intestati.length) avviso('Nessun intestato trovato');
  // il totale comprende anche i terreni: il confronto vale solo senza tabelle dei terreni
  if (dichiarate !== undefined && !conTerreni && dichiarate !== v.immobili.length) avviso(`La visura dichiara ${dichiarate} unità immobiliari, lette ${v.immobili.length}`);
  if (v.tipo === 'altro') avviso(v.titolo ? `Tipo di visura non riconosciuto: "${v.titolo}"` : 'Titolo della visura non trovato');
  return v;
}

function immobiliSezione(s: Sezione, avviso: (s: string) => void): ImmobileVisura[] {
  // colonna di ogni elemento, con i confini calcolati sulla pagina del suo segmento
  const col = new Map<ElementoTesto, ChiaveImm>();
  for (const g of s.segmenti) for (const [e, k] of assegna(g.colonne, g.elementi)) col.set(e, k);
  const tutti = s.segmenti.flatMap((g) => g.elementi).sort((a, b) => a.ordine - b.ordine);
  const ancora = s.segmenti.some((g) => g.colonne.some((c) => c.chiave === 'n')) ? 'n' : 'foglio';

  const gruppi: ElementoTesto[][] = [];
  for (const e of tutti) {
    if (col.get(e) === ancora && /^\d+$/.test(e.testo)) gruppi.push([e]);
    else if (gruppi.length) gruppi[gruppi.length - 1].push(e);
  }

  const out: ImmobileVisura[] = [];
  for (const g of gruppi) {
    const ancoraEl = g[0];
    const cella = (k: ChiaveImm) => g.filter((e) => col.get(e) === k);
    const txt = (k: ChiaveImm) => testoCella(cella(k));
    const progressivo = ancora === 'n' ? Number(ancoraEl.testo) : out.length + 1;
    // identificativi graffati: più particelle (e sub) una sotto l'altra nella stessa riga; la prima è la principale
    const righeNum = righeDi(cella('numero'));
    const allineata = (k: ChiaveImm, y: number, pagina: number) => righeDi(cella(k)).find((r) => r.pagina === pagina && Math.abs(r.y - y) <= 2)?.testo.trim();
    const ids = righeNum.map((r) => ({ numero: r.testo.trim(), foglio: allineata('foglio', r.y, r.pagina), sub: allineata('sub', r.y, r.pagina), sezione: allineata('sezione', r.y, r.pagina) })).filter((x) => /^\d+$/.test(x.numero));
    const foglio = ids[0]?.foglio || txt('foglio');
    const numero = ids.length > 1 ? ids[0].numero : txt('numero');
    const categoria = txt('categoria').replace(/\s+/g, '').toUpperCase();
    if (!foglio || !numero) {
      avviso(`Gruppo ${s.gruppo}, immobile ${progressivo}: foglio o numero non letti`);
      continue;
    }
    if (!/^[A-F]\/\d{1,2}$/.test(categoria)) avviso(`Gruppo ${s.gruppo}, immobile ${progressivo}: categoria non letta`);
    const imm: ImmobileVisura = { foglio, numero, categoria, comune: s.comune, gruppo: s.gruppo, progressivo };
    const opz = (k: ChiaveImm) => txt(k) || undefined;
    imm.sezione = opz('sezione');
    imm.subalterno = ids.length > 1 ? ids[0].sub || undefined : opz('sub');
    if (ids.length > 1) {
      imm.sezione = ids[0].sezione || imm.sezione;
      imm.graffati = ids.slice(1).map((x) => ({ sezione: x.sezione || imm.sezione, foglio: x.foglio || foglio, numero: x.numero, subalterno: x.sub || undefined }));
    }
    imm.zonaCensuaria = opz('zona');
    imm.microzona = opz('micro');
    imm.classe = opz('classe');
    const cons = leggiConsistenza(txt('consistenza'));
    if (cons) {
      imm.consistenza = cons.consistenza;
      imm.unitaConsistenza = cons.unita;
    } else if (txt('consistenza')) avviso(`Gruppo ${s.gruppo}, immobile ${progressivo}: consistenza non riconosciuta`);
    const sup = leggiSuperficie(txt('superficie'));
    imm.superficieCatastale = sup.totale;
    imm.superficieSenzaAree = sup.senzaAree;
    imm.rendita = leggiRendita(txt('rendita'));

    let indirizzo: string | undefined;
    let derivanti: string | undefined;
    const misto = cella('indirizzoDerivanti');
    if (misto.length) [indirizzo, derivanti] = dividiIndirizzo(misto, ancoraEl);
    else {
      indirizzo = opz('indirizzo');
      derivanti = testoCella(cella('derivanti'), true) || undefined;
    }
    indirizzo ??= s.indirizzi.get(progressivo);
    if (indirizzo) imm.indirizzo = leggiIndirizzo(indirizzo);
    imm.datiDerivanti = derivanti;
    imm.datiUlteriori = opz('ulteriori');
    const ann = s.annotazioni.get(progressivo);
    if (ann?.length) imm.annotazioni = ann;
    out.push(pulisci(imm));
  }
  return out;
}

/**
 * Colonna "Indirizzo / Dati derivanti da" della sintetica: l'indirizzo sta sopra la riga, staccato da un'interlinea
 * più ampia dai dati derivanti.
 */
function dividiIndirizzo(el: ElementoTesto[], ancora: ElementoTesto): [string | undefined, string | undefined] {
  const rr = righeDi(el);
  const blocchi: Riga[][] = [];
  for (const r of rr) {
    const prec = blocchi.at(-1)?.at(-1);
    const h = r.elementi[0].h || 8;
    if (prec && (prec.pagina !== r.pagina || prec.y - r.y <= h * 1.5)) blocchi.at(-1)!.push(r);
    else blocchi.push([r]);
  }
  const testo = (b: Riga[][], trattino: boolean) => testoCella(b.flat().flatMap((r) => r.elementi), trattino) || undefined;
  const primo = blocchi[0];
  const ultima = primo?.at(-1);
  const sopra = !!ultima && ultima.pagina === ancora.pagina && ultima.y > ancora.y + (ultima.elementi[0].h || 8) * 0.5;
  if (!sopra) return [undefined, testo(blocchi, true)];
  return [testo([primo], false), testo(blocchi.slice(1), true)];
}

function intestatiTabella(t: TabellaIntestati): IntestatoVisura[] {
  const el = t.righe.flatMap((r) => r.elementi);
  const col = assegna(t.colonne, el);
  const gruppi: Riga[][] = [];
  for (const r of t.righe) {
    if (r.elementi.some((e) => col.get(e) === 'n' && /^\d+$/.test(e.testo))) gruppi.push([r]);
    else if (gruppi.length) gruppi[gruppi.length - 1].push(r);
  }
  const out: IntestatoVisura[] = [];
  for (const g of gruppi) {
    const tutti = g.flatMap((r) => r.elementi);
    const txt = (k: ChiaveInt) => testoCella(tutti.filter((e) => col.get(e) === k));
    const it: IntestatoVisura = { gruppo: t.gruppo, progressivo: Number(txt('n')) || undefined };
    const anag = txt('anagrafica');
    if (anag) Object.assign(it, { testoAnagrafico: anag }, leggiAnagrafica(anag));
    const cf = /^([A-Z0-9]{11,16})(\*?)$/i.exec(txt('cf').replace(/\s+/g, ''));
    if (cf) {
      it.codiceFiscale = cf[1].toUpperCase();
      it.codiceFiscaleValidato = cf[2] === '*';
    }
    const dir = txt('diritti');
    if (dir) Object.assign(it, { testoDiritti: dir }, leggiDiritti(dir));
    out.push(pulisci(it));
  }
  return out;
}
