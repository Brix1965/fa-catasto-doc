/** Lettura dei valori stampati in visura e conversione nei formati dell'app (come Docfa). */
import type { ImmobileVisura, IndirizzoVisura, IntestatoVisura, UnitaConsistenza } from './tipi';

/** "A/2" → "A02", "D/10" → "D10"; stringa vuota se non è una categoria. */
export function categoriaDocfa(c: string): string {
  const m = /^\s*([A-F])\s*\/?\s*(\d{1,2})\s*$/i.exec(c);
  return m ? m[1].toUpperCase() + m[2].padStart(2, '0') : '';
}

/** "4" → "04", "U" → "U"; come la classe in atti del classamento automatico. */
export function classeDocfa(c: string | undefined): string {
  const s = (c ?? '').trim().toUpperCase();
  return /^\d$/.test(s) ? '0' + s : s;
}

/** Consistenza per l'app: virgola decimale, senza separatore delle migliaia ("6.642" → "6642", "14.5" → "14,5"). */
export function consistenzaDocfa(c: string | undefined): string {
  let s = (c ?? '').trim().replace(/\s+/g, '');
  if (!s) return '';
  if (s.includes(',')) s = s.replace(/\./g, '');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else s = s.replace('.', ',');
  return s;
}

/** Dati "in atti" di un'unità (`UnitaImmobiliare.inAtti`). */
export function inAttiDaVisura(i: ImmobileVisura): { categoria: string; classe: string; consistenza: string } {
  return { categoria: categoriaDocfa(i.categoria), classe: classeDocfa(i.classe), consistenza: consistenzaDocfa(i.consistenza) };
}

/** Peso della classe per il confronto: numeri in ordine, "U" (unica) e lettere dopo. */
function pesoClasse(c: string): number {
  return /^\d+$/.test(c) ? Number(c) : 1000 + c.charCodeAt(0);
}

/**
 * Categorie presenti con la classe più elevata (`Pratica.classiFabbricato`): una voce per categoria che ha una classe,
 * nell'ordine di prima comparsa; formati dell'app ("A02", "04").
 */
export function classiPiuElevate(immobili: Pick<ImmobileVisura, 'categoria' | 'classe'>[]): { categoria: string; classe: string }[] {
  const per = new Map<string, string>();
  for (const i of immobili) {
    const cat = categoriaDocfa(i.categoria);
    const cl = classeDocfa(i.classe);
    if (!cat || !cl) continue;
    const prima = per.get(cat);
    if (prima === undefined || pesoClasse(cl) > pesoClasse(prima)) per.set(cat, cl);
  }
  return [...per].map(([categoria, classe]) => ({ categoria, classe }));
}

/** Numero all'italiana ("2.705,72" → 2705.72, "7043" → 7043). */
export function numeroItaliano(s: string): number | undefined {
  const t = s.trim().replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  return Number(t);
}

/** "14,5 vani" | "155m²" | "6.642m³" → valore e unità. */
export function leggiConsistenza(s: string): { consistenza: string; unita?: UnitaConsistenza } | undefined {
  const m = /^\s*(\d[\d.,]*)\s*(vani|m²|m2|mq|m³|m3|mc)?\s*$/i.exec(s);
  if (!m) return undefined;
  const u = m[2]?.toLowerCase();
  const unita: UnitaConsistenza | undefined = !u ? undefined : u === 'vani' ? 'vani' : /^(m²|m2|mq)$/.test(u) ? 'm²' : 'm³';
  return { consistenza: m[1], unita };
}

/** "Totale: 246 m² Totale escluse aree scoperte**: 230 m²" */
export function leggiSuperficie(s: string): { totale?: number; senzaAree?: number } {
  const senza = /escluse\s+aree\s+scoperte\**\s*:?\s*([\d.]+)/i.exec(s);
  const tot = /Totale\s*:\s*([\d.]+)/i.exec(s);
  return { totale: tot ? numeroItaliano(tot[1]) : undefined, senzaAree: senza ? numeroItaliano(senza[1]) : undefined };
}

/** "Euro 2.705,72" → 2705.72 (eventuali importi in lire dopo vengono ignorati). */
export function leggiRendita(s: string): number | undefined {
  const m = /(?:Euro|€)\s*([\d.]+(?:,\d+)?)/i.exec(s);
  return m ? numeroItaliano(m[1]) : undefined;
}

const CHIAVI_INDIRIZZO = /(?:^|\s)(n\.|Scala|Interno|Piano|Lotto|Edificio)(?=\s|$)/g;

/** "VIA ROMA n. 1-3 Scala A Interno 4 Piano S1-T - 2" → toponimo, civici, piani… (parole chiave come le stampa Sister). */
export function leggiIndirizzo(testo: string): IndirizzoVisura {
  const t = testo.replace(/\s+/g, ' ').trim();
  const pezzi: { chiave: string; da: number; a: number }[] = [];
  for (const m of t.matchAll(CHIAVI_INDIRIZZO)) {
    const da = m.index + m[0].indexOf(m[1]);
    pezzi.push({ chiave: m[1], da, a: da + m[1].length });
  }
  const valore = (k: number) => t.slice(pezzi[k].a, k + 1 < pezzi.length ? pezzi[k + 1].da : t.length).trim();
  const ind: IndirizzoVisura = { toponimo: (pezzi.length ? t.slice(0, pezzi[0].da) : t).trim(), civici: [], piani: [], testo: t };
  pezzi.forEach((p, k) => {
    const v = valore(k);
    if (!v) return;
    if (p.chiave === 'n.') ind.civici = v.split(/\s*[-,]\s*|\s+/).filter(Boolean);
    else if (p.chiave === 'Piano') ind.piani = v.split(/\s+-\s+|\s*,\s*/).map((x) => x.replace(/\s+/g, '')).filter((x) => x && x !== '-');
    else if (p.chiave === 'Scala') ind.scala = v;
    else if (p.chiave === 'Interno') ind.interno = v;
    else if (p.chiave === 'Lotto') ind.lotto = v;
    else if (p.chiave === 'Edificio') ind.edificio = v;
  });
  return ind;
}

/** "(1) Proprieta' per 1/2 in regime di …" → codice, diritto, quota. */
export function leggiDiritti(testo: string): Pick<IntestatoVisura, 'codiceDiritto' | 'diritto' | 'quota'> {
  let t = testo.replace(/\s+/g, ' ').trim();
  const out: Pick<IntestatoVisura, 'codiceDiritto' | 'diritto' | 'quota'> = {};
  const cod = /^\(\s*(\d+)\s*\)\s*/.exec(t);
  if (cod) {
    out.codiceDiritto = cod[1];
    t = t.slice(cod[0].length);
  }
  const q = /^(.*?)(?:\s+per)?\s+(\d+\s*\/\s*\d+)(?=\s|$)/.exec(t);
  if (q) {
    out.diritto = q[1].trim() || undefined;
    out.quota = q[2].replace(/\s+/g, '');
  } else if (t) out.diritto = t;
  return out;
}

/**
 * Dati anagrafici: "ROSSI Mario nato a FIRENZE (FI) il 01/01/1950" (cognome in maiuscolo, nome no),
 * "DITTA S.R.L. con sede in ROMA (RM)".
 */
export function leggiAnagrafica(testo: string): Pick<IntestatoVisura, 'denominazione' | 'cognome' | 'nome' | 'luogoNascita' | 'dataNascita' | 'sede'> {
  let t = testo.replace(/\s+/g, ' ').trim();
  const out: ReturnType<typeof leggiAnagrafica> = {};
  const nato = /\s+nat[oa]\s+a\s+(.+?)(?:\s+il\s+(\d{2}\/\d{2}\/\d{4}))?\s*$/i.exec(t);
  const sede = /\s+(?:con\s+)?sede\s+in\s+(.+)$/i.exec(t);
  if (nato) {
    out.luogoNascita = nato[1].trim();
    if (nato[2]) out.dataNascita = nato[2];
    t = t.slice(0, nato.index).trim();
  } else if (sede) {
    out.sede = sede[1].trim();
    t = t.slice(0, sede.index).trim();
  }
  if (!t) return out;
  const parole = t.split(' ');
  const k = parole.findIndex((p) => /[a-zà-ÿ]/.test(p));
  if (k > 0 && parole.slice(k).every((p) => /[a-zà-ÿ]/.test(p) || !/[A-Z]/.test(p))) {
    out.cognome = parole.slice(0, k).join(' ');
    out.nome = parole.slice(k).join(' ');
  } else out.denominazione = t;
  return out;
}
