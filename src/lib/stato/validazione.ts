/**
 * Controllo formale della pratica, con le regole e i codici diagnostici di Docfa 4.00.5
 * (help in linea "Elenco errori formali", schermi del modello D e programma di controllo NZC000).
 * Gli errori bloccano l'esportazione, gli avvisi no. Ogni problema indica lo schermo in cui si corregge.
 */
import { poligoniPlanimetria, schedePlanimetria, type Intestato, type Pratica, type UnitaImmobiliare } from '$lib/core/model';
import { causaliBarrate } from '$lib/core/compile';
import {
  CAUSALI_VARIAZIONE, coppieIncompatibili, OPERAZIONI_CAUSALE, DESCRIZIONE_CAUSALE, TIPOLOGIE_PLANIMETRICHE,
  ALBI_TECNICO, pianoValido, civicoValido, CARATTERI_INDIRIZZO, normalizzaIndirizzo, type CodiceVariazione,
} from '$lib/core/regole-docfa';
import { TITOLI, DIAGNOSTICI } from '$lib/core/dati/docfa-tabelle.generated';
import { aCapo } from '$lib/core/pdf/formato';

/** Schermi della pratica, nell'ordine di Docfa. */
export type SezionePratica =
  | 'comune' | 'generali' | 'intestati' | 'unita' | 'quadroD' | 'dichiarante'
  | 'elaborati' | 'modelli' | 'classamento' | 'elenco' | 'controllo' | 'esporta';

export interface Problema {
  livello: 'errore' | 'avviso';
  sezione: SezionePratica;
  /** codice del diagnostico di Docfa, se esiste */
  codice?: string;
  /** indice della u.i.u. interessata (se pertinente) */
  unita?: number;
  testo: string;
}

export interface EsitoControlli {
  errori: Problema[];
  avvisi: Problema[];
  /** riepilogo dei conteggi che finiranno nel record di testata */
  conteggi: { costituite: number; variate: number; soppresse: number; planimetrie: number; mod1NParteII: number; derivate: { ordinarie: number; speciali: number; bcnc: number } };
}

export function descriviUnita(u: UnitaImmobiliare, i: number): string {
  const id = u.identificativo;
  const s = [id.foglio ? `fg. ${id.foglio}` : '', id.numero ? `p.lla ${id.numero}` : '', id.subalterno ? `sub ${id.subalterno}` : ''].filter(Boolean).join(' ');
  return `U.i.u. ${i + 1}${s ? ` (${s})` : ''}`;
}

const categoria = (u: UnitaImmobiliare) => (u.classamento?.categoria ?? '').trim().toUpperCase();
const isSpeciale = (u: UnitaImmobiliare) => /^[DE]/.test(categoria(u));
const isF = (u: UnitaImmobiliare) => /^F/.test(categoria(u));
const isOrdinaria = (u: UnitaImmobiliare) => /^[ABC]/.test(categoria(u));

export function derivateCalcolate(p: Pratica): { ordinarie: number; speciali: number; bcnc: number } {
  return {
    ordinarie: p.unita.filter((u) => u.operazione !== 'S' && !isSpeciale(u) && !isF(u) && u.partitaSpeciale !== 'A').length,
    // le unità di categoria F si contano tra le speciali o particolari
    speciali: p.unita.filter((u) => u.operazione !== 'S' && (isSpeciale(u) || isF(u)) && u.partitaSpeciale !== 'A').length,
    bcnc: p.unita.filter((u) => u.operazione !== 'S' && u.partitaSpeciale === 'A').length,
  };
}

const dataValida = (d?: { gg: number; mm: number; aaaa: number }) => {
  if (!d || !d.aaaa) return false;
  const x = new Date(d.aaaa, d.mm - 1, d.gg);
  return d.aaaa >= 1800 && x.getMonth() === d.mm - 1 && x.getDate() === d.gg;
};
const futura = (d: { gg: number; mm: number; aaaa: number }) => new Date(d.aaaa, d.mm - 1, d.gg).getTime() > Date.now();

/** Caratteri ammessi nei nomi: lettere, apostrofo e spazio (E0204). */
const NOME_VALIDO = /^[A-Za-zÀ-ÖØ-öø-ÿ' ]+$/;
const CF_PF = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;
const CF_PG = /^\d{11}$/;

/** Causali barrate che richiedono i modelli 1N/2N (se almeno una li richiede). */
/**
 * Casi in cui l'elaborato planimetrico con l'elenco subalterni è obbligatorio per il documento in lavorazione
 * (vademecum Docfa 3.1.1 e nota 117): due o più unità costituite, unità del gruppo F costituite o variate,
 * beni comuni non censibili costituiti o variati, causale "Altre" che riguarda l'elaborato o i BCNC.
 * Vuoto = non obbligatorio (si può comunque allegare, ad esempio se è già in atti e cambiano le geometrie).
 */
export function motiviElaboratoObbligatorio(p: Pratica): string[] {
  const acc = p.tipoDocumento === 'accatastamento';
  const derivate = p.unita.filter((u) => u.operazione !== 'S');
  const costituite = acc ? derivate.length : p.unita.filter((u) => u.operazione === 'C').length;
  const motivi: string[] = [];
  if (costituite >= 2) motivi.push(`sono costituite ${costituite} unità immobiliari`);
  const f = derivate.filter((u) => isF(u));
  if (f.length) motivi.push(`${f.length === 1 ? "un'unità è" : `${f.length} unità sono`} in categoria F (${[...new Set(f.map((u) => `${categoria(u).slice(0, 1)}/${Number(categoria(u).slice(1))}`))].join(', ')})`);
  const bcnc = acc ? (p.bcnc?.length ?? 0) : Math.max(derivate.filter((u) => u.partitaSpeciale === 'A').length, (p.derivate ?? derivateCalcolate(p)).bcnc);
  if (bcnc) motivi.push(acc ? 'sono dichiarati beni comuni non censibili nel quadro D' : 'sono costituiti o variati beni comuni non censibili');
  const altre = (p.altreVariazioni ?? '').toUpperCase();
  if (!acc && p.tipiVariazione.VAR && /ELABORATO|BCNC/.test(altre)) motivi.push(`causale "Altre": ${altre.trim()}`);
  return motivi;
}

export function richiedeModelli(p: Pratica): boolean {
  if (p.tipoDocumento === 'accatastamento') return true;
  if (p.presentazione === 'afferenti') return true;
  const c = causaliBarrate(p);
  return c.some((x) => OPERAZIONI_CAUSALE[x].modelli);
}

/** Tipo di classamento richiesto per la u.i.u. secondo la causale (help del quadro U). */
export function classamentoRichiesto(p: Pratica, u: UnitaImmobiliare): 'completo' | 'categoria' | 'nessuno' {
  if (u.operazione === 'S' || u.partitaSpeciale === 'A') return 'nessuno';
  if (p.tipoDocumento === 'accatastamento' || p.presentazione === 'afferenti') return isF(u) ? 'categoria' : 'completo';
  const c = causaliBarrate(p);
  if (c.some((x) => x === 'VMI' || x === 'RUR')) return 'nessuno';
  if (c.length === 1 && c[0] === 'VTO') return 'nessuno';
  if (c.includes('VRP')) return 'categoria';
  if (c.includes('DET') || isF(u)) return 'categoria';
  return 'completo';
}

export function controllaPratica(p: Pratica): EsitoControlli {
  const errori: Problema[] = [];
  const avvisi: Problema[] = [];
  const acc = p.tipoDocumento === 'accatastamento';
  const aggiungi = (livello: Problema['livello'], sezione: SezionePratica, testo: string, codice?: string, unita?: number) =>
    (livello === 'errore' ? errori : avvisi).push({ livello, sezione, testo: codice && DIAGNOSTICI[codice] && !testo ? DIAGNOSTICI[codice].t : testo, codice, unita });
  const err = (sezione: SezionePratica, testo: string, codice?: string, unita?: number) => aggiungi('errore', sezione, testo, codice, unita);
  const avv = (sezione: SezionePratica, testo: string, codice?: string, unita?: number) => aggiungi('avviso', sezione, testo, codice, unita);

  // ------------------------------------------------------------------ Scelta comune
  if (!p.comune.codiceAmministrativo) err('comune', 'Indicare il codice comune o selezionarne uno dalla lista');
  else if (!p.comune.nome) err('comune', 'Codice comune errato o non presente negli archivi');
  if (!(p.progressivo >= 1 && p.progressivo <= 999)) err('comune', 'Il numero del documento deve essere fra 1 e 999');

  const conteggi = { soppresse: p.unita.filter((u) => u.operazione === 'S').length, variate: p.unita.filter((u) => u.operazione === 'V').length, costituite: p.unita.filter((u) => u.operazione === 'C').length };

  // ------------------------------------------------------------------ Quadro A / Quadro B
  if (acc) {
    const qa = p.quadroA;
    if (!qa || !qa.ditte.length) err('generali', '', 'G0001');
    qa?.ditte.forEach((d, k) => {
      const dn = qa.ditte.length > 1 ? `Ditta ${k + 1}: ` : '';
      if (!d.tipoMappale?.numero) err('generali', `${dn}indicare il numero del tipo mappale`, 'G0175');
      if (!dataValida(d.tipoMappale?.data)) err('generali', `${dn}indicare la data del tipo mappale`, 'G0175');
      else if (futura(d.tipoMappale!.data)) err('generali', `${dn}data del tipo mappale posteriore alla data odierna`);
      const tot = d.unitaOrdinarie + d.unitaSpeciali;
      if (!tot) err('generali', `${dn}indicare il numero delle u.i.u. derivate a destinazione ordinaria e/o speciale`, 'G0116');
      if (tot > 999) err('generali', `${dn}numero complessivo delle u.i.u. superiore al massimo consentito (999)`, 'G0117');
      if (d.intestazione !== 'nuova') {
        const r = d.riferimento;
        if (!r?.comune) err('generali', `${dn}indicare il comune della ditta già in atti`);
        if (!r?.foglio) err('generali', `${dn}indicare il foglio dell'identificativo di riferimento`);
        if (!r?.numero) err('generali', `${dn}indicare il numero dell'identificativo di riferimento`);
        if (d.intestazione === 'ct' && r?.subalterno && !/^\d*$/.test(r.subalterno)) err('generali', `${dn}identificativo subalterno errato`);
      }
      // unità acquisite per ditta e per destinazione
      const uiu = p.unita.filter((u) => qa.ditte.length === 1 || (u.ditta ?? 0) === k);
      const ord = uiu.filter((u) => isOrdinaria(u)).length;
      const spe = uiu.filter((u) => isSpeciale(u) || isF(u)).length;
      if (uiu.length && uiu.length !== tot) err('unita', `${dn}unità acquisite (${uiu.length}) diverse da quelle dichiarate nel quadro A (${tot})`, 'G0035');
      if (ord > d.unitaOrdinarie) err('unita', `${dn}unità a destinazione ordinaria acquisite (${ord}) più di quelle dichiarate (${d.unitaOrdinarie})`, 'G0039');
      if (spe > d.unitaSpeciali) err('unita', `${dn}unità a destinazione speciale o particolare acquisite (${spe}) più di quelle dichiarate (${d.unitaSpeciali})`, 'G0040');
    });
    if (qa?.causale === 'AFF') {
      const a = qa.afferenti;
      if (!a?.identificativo.foglio || !a.identificativo.numero) err('generali', "Unità afferenti: indicare foglio e numero dell'identificativo di riferimento");
      if (!a || (!a.sopraelevazione && !a.areaCorte && !a.altro)) err('generali', 'Indicare una causale per unità afferente');
      if (a?.altro && !p.altreVariazioni?.trim()) err('generali', "Unità afferenti – Altro: specificare la dicitura (es. RECUPERO DI SITUAZIONE PREGRESSA)", 'W0153');
    }
    if (p.unita.some((u) => u.recuperata) && !(qa?.causale === 'AFF' && qa.afferenti?.altro && /RECUPERO PER ERRATA SOPPRESSIONE/i.test(p.altreVariazioni ?? '')))
      avv('generali', "L'operazione R – Recuperata si usa con la causale Unità afferenti – Altro: RECUPERO PER ERRATA SOPPRESSIONE (vademecum 2.2.1.4)");
    // data di ultimazione lavori (record 1, pos. 18-25)
    const du = p.dataVariazione;
    if (du && du.aaaa) {
      if (!dataValida(du)) err('generali', 'Data di ultimazione lavori errata');
      else if (futura(du)) err('generali', 'Data di ultimazione lavori posteriore alla data odierna');
      else if (p.tipologia === 7 && !(du.gg === 30 && du.mm === 11 && du.aaaa === 2012))
        avv('generali', 'Per la tipologia art. 13, comma 14 ter, DL 201/2011 la data va indicata al 30/11/2012 (vademecum 2.2.1.5)');
    } else if (p.unita.some((u) => categoria(u) && !isF(u))) avv('generali', 'Data di ultimazione lavori non dichiarata per unità di categoria diversa da F', 'W0100');
    if (p.tipologia === undefined) err('generali', 'Indicare la tipologia di documento');
  } else {
    const tm = p.tipoMappale;
    if (tm && (tm.numero || tm.data.aaaa) && (!tm.numero || !dataValida(tm.data))) err('generali', 'Tipo mappale: indicare sia il numero sia la data');
    const dich = p.dichiarate ?? conteggi;
    const totDich = dich.soppresse + dich.variate + dich.costituite;
    if (!totDich) err('generali', 'Indicare il numero delle u.i.u. soppresse, variate e/o costituite', 'G0116');
    if (totDich > 998) err('generali', 'Numero complessivo delle u.i.u. soppresse, variate e/o costituite superiore al massimo consentito (998)', 'G0059');
    const der = p.derivate ?? derivateCalcolate(p);
    const totDer = der.ordinarie + der.speciali + der.bcnc;
    if (!totDer) err('generali', 'Indicare il numero delle u.i.u. derivate', 'G0119');
    if (totDer !== dich.variate + dich.costituite) err('generali', 'Incongruenza tra le u.i. derivate e le u.i. oggetto della variazione (derivate = variate + costituite)', 'G0120');
    if (dich.soppresse !== conteggi.soppresse) err('unita', `Unità acquisite in soppressione (${conteggi.soppresse}) diverse da quelle dichiarate nel quadro B (${dich.soppresse})`, 'G0036');
    if (dich.variate !== conteggi.variate) err('unita', `Unità acquisite in variazione (${conteggi.variate}) diverse da quelle dichiarate nel quadro B (${dich.variate})`, 'G0037');
    if (dich.costituite !== conteggi.costituite) err('unita', `Unità acquisite in costituzione (${conteggi.costituite}) diverse da quelle dichiarate nel quadro B (${dich.costituite})`, 'G0038');

    if (p.presentazione === 'afferenti') {
      const a = p.afferentiVariazione;
      if (!a || (!a.areaUrbana && !a.lastricoSolare && !a.altro)) err('generali', 'Indicare una causale per unità afferente');
      if (a?.altro && !a.descrizione?.trim()) err('generali', 'Specificare il tipo di edificazione');
      if (conteggi.variate) err('unita', 'Per le unità afferenti sono ammesse solo unità soppresse e costituite', 'G1502');
    } else {
      const c = causaliBarrate(p);
      if (!c.length && ![8, 9].includes(p.tipologia ?? 0)) err('generali', 'Selezionare almeno una causale');
      // planimetrica senza tipologia: non può accadere (le tipologie sono le causali stesse)
      const soloSenzaData = c.length > 0 && c.every((x) => x === 'VTO' || x === 'VRP');
      if (soloSenzaData) {
        if (p.dataVariazione.aaaa) err('generali', `Per causale ${c.join('/')} la data variazione va omessa`);
      } else if ([8, 9].includes(p.tipologia ?? 0)) {
        if (p.dataVariazione.aaaa) err('generali', 'Per la tipologia di documento selezionata la data di variazione va omessa');
      } else if (!dataValida(p.dataVariazione)) err('generali', 'Indicare la data di realizzazione della variazione');
      else if (futura(p.dataVariazione)) err('generali', 'Data errata o posteriore alla data odierna');
      for (const [a, b] of coppieIncompatibili(c)) err('generali', `Causali incompatibili tra loro: ${a} (${DESCRIZIONE_CAUSALE[a].toLowerCase()}) e ${b} (${DESCRIZIONE_CAUSALE[b].toLowerCase()})`, 'G0154');
      if (c.includes('VDE')) {
        if (!p.variazioneDa?.trim()) err('generali', "Indicare il campo variazione di destinazione 'da'", 'W0152');
        if (!p.variazioneA?.trim()) err('generali', "Indicare il campo variazione di destinazione 'a'", 'W0152');
      } else if (p.variazioneDa?.trim() || p.variazioneA?.trim()) avv('generali', '', 'W0161');
      if (c.includes('VAR')) { if (!p.altreVariazioni?.trim()) err('generali', "Indicare il campo 'altre' variazioni", 'W0153'); }
      for (const [k, v] of [['da', p.variazioneDa], ['a', p.variazioneA], ['altre', p.altreVariazioni]] as const)
        if ((v ?? '').length > 35) err('generali', `Il testo "${k}" supera i 35 caratteri`);
      // tipologia di documento
      if (p.tipologia === 2 && !(c.length === 1 && c[0] === 'VRP')) err('generali', "Per la tipologia di documento indicata (comma 340) è ammessa soltanto la causale VRP", 'G0179');
      if (c.includes('RUR') && p.unita.some((u) => u.operazione !== 'S' && categoria(u) && categoria(u) !== 'D10')) err('unita', "Per la richiesta di ruralità l'unità derivata va censita in categoria D/10", 'G0347');
      if (p.tipologia === 7 && dataValida(p.dataVariazione) && !(p.dataVariazione.gg === 30 && p.dataVariazione.mm === 11 && p.dataVariazione.aaaa === 2012))
        avv('generali', 'Per la tipologia art. 13, comma 14 ter, DL 201/2011 la data di completamento va indicata al 30/11/2012 (vademecum 2.3.1.6)');
      if (c.length === 1 && c[0] === 'VTO') avv('generali', 'La variazione toponomastica va abbinata ad altre causali; la sola modifica di indirizzo si chiede all\'Ufficio con istanza (vademecum 2.3.1.5)');
      if (conteggi.variate && (conteggi.soppresse || conteggi.costituite)) avv('generali', 'Le unità in variazione non vanno dichiarate insieme a unità soppresse o costituite: servono documenti distinti (vademecum 2.3.1.2)');
      if (c.includes('RUR') && p.tipologia !== 6) err('generali', 'Per la causale RUR è ammessa soltanto la tipologia di documento relativa al DM 26/7/2012', 'G0349');
      if ([8, 9].includes(p.tipologia ?? 0)) {
        if (c.length) err('generali', 'Per la tipologia di documento indicata non è richiesta alcuna causale di variazione');
        if (conteggi.variate !== 1 || p.unita.length !== 1) err('generali', "Per la tipologia di documento indicata è ammessa solo una u.i.u. in variazione");
      }
      // beni comuni non censibili tra le derivate in alternativa con le altre (tranne VAR, DIV, FRF)
      if (der.bcnc && (der.ordinarie || der.speciali) && !c.some((x) => x === 'VAR' || x === 'DIV' || x === 'FRF'))
        err('generali', 'Beni comuni non censibili in alternativa con altre u.i. derivate tranne che per VAR, DIV o FRF', 'G0123');
      // operazioni ammesse dalle causali (unione) e quantità (se la causale è una sola)
      if (c.length) {
        const ammessa = (op: 'S' | 'V' | 'C') => c.some((x) => (op === 'S' ? OPERAZIONI_CAUSALE[x].soppressione : op === 'V' ? OPERAZIONI_CAUSALE[x].variazione : OPERAZIONI_CAUSALE[x].costituzione));
        for (const op of ['S', 'V', 'C'] as const) {
          const n = op === 'S' ? conteggi.soppresse : op === 'V' ? conteggi.variate : conteggi.costituite;
          if (n && !ammessa(op)) err('unita', `Incompatibilità tra unità immobiliari e causali di presentazione: le causali ${c.join(', ')} non ammettono unità ${op === 'S' ? 'soppresse' : op === 'V' ? 'variate' : 'costituite'}`);
        }
        if (c.length === 1 || (c.length === 2 && c.includes('VTO'))) {
          const x = c.find((y) => y !== 'VTO') ?? c[0];
          const r = OPERAZIONI_CAUSALE[x];
          const fuori = (n: number, lim?: [number, number]) => lim && (n < lim[0] || n > lim[1]);
          if (fuori(conteggi.soppresse, r.s) || fuori(conteggi.variate, r.v) || fuori(conteggi.costituite, r.c))
            err('unita', `La causale ${x} ammette: ${r.nota}`);
          if (x === 'VRP' && conteggi.variate !== 1) err('unita', '', 'G0049');
          if (x === 'DET' && p.unita.some((u) => u.operazione === 'C' && categoria(u) !== 'F01')) err('unita', "Per demolizione totale l'unità costituita deve essere un'area urbana (F/1)");
          if (x === 'FRZ' && p.unita.some((u) => u.operazione === 'C' && !isF(u))) err('unita', 'Il frazionamento per trasferimento di diritti si usa solo con unità del gruppo F');
        }
      }
    }
    if (p.tipologia === undefined) err('generali', 'Indicare la tipologia di documento');
  }

  // ------------------------------------------------------------------ Quadro I (intestati)
  if (acc) {
    p.quadroA?.ditte.forEach((d, k) => {
      if (d.intestazione !== 'nuova') return;
      const dn = (p.quadroA?.ditte.length ?? 0) > 1 ? `Ditta ${k + 1}, ` : '';
      if (!d.intestati.length) { err('intestati', `${dn}ditta da intestare mancante`, 'G0002'); return; }
      d.intestati.forEach((it, i) => controllaIntestato(it, i, d.intestati, `${dn}intestato ${i + 1}`, err, avv));
      controllaQuote(d.intestati, dn, err);
      const visti = new Set<string>();
      d.intestati.forEach((it, i) => {
        const chiave = [it.tipo, it.cognome, it.nome, it.denominazione, it.codiceFiscale, it.titolo].join('|').toUpperCase();
        if (visti.has(chiave)) err('intestati', `${dn}l'intestato nr. ${i + 1} è duplicato`, 'E0230');
        visti.add(chiave);
      });
    });
  }

  // ------------------------------------------------------------------ Quadro U
  if (!p.unita.length) err('unita', '', 'G0003');
  const ids = new Set<string>();
  const causali = acc ? [] : causaliBarrate(p);
  const det = causali.includes('DET');
  p.unita.forEach((u, i) => {
    const nome = descriviUnita(u, i);
    const id = u.identificativo;
    if (acc && !['C'].includes(u.operazione)) err('unita', `${nome}: in accatastamento il tipo operazione è C (costituita) o R (recuperata)`, undefined, i);
    if (!acc && p.presentazione === 'afferenti' && u.operazione === 'V') err('unita', `${nome}: per le unità afferenti l'operazione è S o C`, undefined, i);
    if (acc && u.partitaSpeciale) err('unita', `${nome}: partita speciale impostata in accatastamento`, 'W0399', i);
    if (!id.foglio.trim()) err('unita', `${nome}: indicare il foglio`, undefined, i);
    if (!id.numero.trim()) err('unita', `${nome}: indicare il numero`, undefined, i);
    if (id.foglio && !/^[0-9A-Z]{1,4}$/i.test(id.foglio.trim())) err('unita', `${nome}: foglio formalmente errato`, undefined, i);
    if (id.numero && !/^[0-9A-Z]{1,5}$/i.test(id.numero.trim())) err('unita', `${nome}: numero formalmente errato`, undefined, i);
    if (id.subalterno && !/^[0-9A-Z]{1,4}$/i.test(id.subalterno.trim())) err('unita', `${nome}: subalterno formalmente errato`, undefined, i);
    const tutti = [id, ...u.graffati];
    for (const x of tutti) {
      const chiave = `${u.operazione}|${x.sezione ?? ''}|${x.foglio}|${x.numero}|${x.denominatore ?? ''}|${x.subalterno ?? ''}`;
      if (ids.has(chiave)) err('unita', `${nome}: identificativo duplicato`, 'W0506', i);
      ids.add(chiave);
    }
    if (u.operazione === 'S') return;
    // ubicazione
    const ind = u.indirizzo;
    if (!ind?.toponimo.trim()) err('unita', `${nome}: indirizzo non dichiarato`, 'E0304', i);
    else {
      if (ind.toponimo.length > 38) err('unita', `${nome}: il toponimo supera i 38 caratteri`, undefined, i);
      if (!ind.civici.length) err('unita', `${nome}: numero civico non indicato (se manca scrivere SNC)`, 'W0305', i);
      for (const c of ind.civici) if (!civicoValido(c)) err('unita', `${nome}: numero civico errato (${c})`, 'W0305', i);
      if (new Set(ind.civici).size !== ind.civici.length) err('unita', `${nome}: numeri civici duplicati`, undefined, i);
      if (det) {
        if (ind.piani.length || ind.scala || ind.interno || ind.lotto || ind.edificio) err('unita', `${nome}: per demolizione totale si indica solo l'indirizzo`, 'E0398', i);
      } else {
        if (!ind.piani.length) err('unita', `${nome}: piano non dichiarato`, 'W0306', i);
        for (const x of ind.piani) if (!pianoValido(x)) err('unita', `${nome}: piano errato (${x}): numero, T, S seguita da numero o intervallo "1-3"`, 'W0307', i);
      }
    }
    const altri = (u.altriIndirizzi ?? []).filter((x) => x.toponimo.trim());
    if (altri.length > 3) err('unita', `${nome}: al massimo 4 indirizzi`, undefined, i);
    for (const x of altri) if (!x.civici.length) err('unita', `${nome}: numero civico mancante per ${x.toponimo}`, 'W0305', i);
    const tops = [ind?.toponimo ?? '', ...altri.map((x) => x.toponimo)].map((x) => x.trim().toUpperCase()).filter(Boolean);
    if (new Set(tops).size !== tops.length) err('unita', `${nome}: indirizzi duplicati`, undefined, i);
    // utilità comuni
    const uc = u.utilitaComuni ?? [];
    if (uc.length) {
      if (causali.includes('VTO') || causali.includes('VSI')) err('unita', `${nome}: utilità comuni non ammesse per VTO e VSI`, 'E0324', i);
      if (u.partitaSpeciale === 'A') err('unita', `${nome}: utilità comuni non ammesse per i beni comuni non censibili`, undefined, i);
      if (uc.length > 10) err('unita', `${nome}: al massimo 10 utilità comuni`, undefined, i);
      for (const x of uc) {
        if (!x.identificativo.foglio || !x.identificativo.numero) err('unita', `${nome}: utilità comune senza foglio o numero`, 'E0571', i);
        if ((acc || p.presentazione === 'afferenti' || u.operazione === 'C') && x.operazione !== 'I') err('unita', `${nome}: per le unità costituite l'operazione sulle utilità comuni è I (iscrizione)`, undefined, i);
        if (tutti.some((y) => y.foglio === x.identificativo.foglio && y.numero === x.identificativo.numero && (y.subalterno ?? '') === (x.identificativo.subalterno ?? '') && (y.sezione ?? '') === (x.identificativo.sezione ?? '')))
          err('unita', `${nome}: identificativo duplicato tra unità immobiliare e utilità comune`, 'E0390', i);
      }
    }
    // classamento
    const req = classamentoRichiesto(p, u);
    const cl = u.classamento;
    const cat = categoria(u);
    if (req === 'nessuno') {
      if (cat && cat !== '00' && u.partitaSpeciale === 'A') err('unita', `${nome}: per i beni comuni non censibili non sono ammessi i dati del classamento`, undefined, i);
      else if (cat && cat !== '00' && !(causali.length === 1 && causali[0] === 'VTO')) avv('unita', `${nome}: per la causale indicata i dati del classamento non vanno indicati`, undefined, i);
    } else {
      if (!cat) err('unita', `${nome}: indicare la categoria`, undefined, i);
      else if (!/^[A-F](\d{2})?$/.test(cat)) err('unita', `${nome}: categoria nel formato errato (es. A03, C02, F01)`, undefined, i);
      else if (cat.length === 1 && cat !== 'A') err('unita', `${nome}: per la categoria generica ${cat} scegliere la destinazione d'uso`, undefined, i);
      if (req === 'completo' && cl && cat && !isF(u)) {
        if (!cl.zonaCensuaria.trim()) err('unita', `${nome}: indicare la zona censuaria (U se unica)`, undefined, i);
        if (isOrdinaria(u) && cat !== 'A') {
          if (!cl.classe.trim()) err('unita', `${nome}: indicare la classe`, undefined, i);
          if (!cl.consistenza.trim()) err('unita', `${nome}: indicare la consistenza`, undefined, i);
          else if (/^A/.test(cat) ? !/^\d+(,[05])?$/.test(cl.consistenza.trim()) : !/^\d+$/.test(cl.consistenza.trim())) err('unita', `${nome}: consistenza non valida (${/^A/.test(cat) ? 'vani con mezzo vano, es. 4,5' : /^B/.test(cat) ? 'metri cubi' : 'metri quadri'})`, undefined, i);
        }
        if (isSpeciale(u)) {
          if (cl.classe.trim()) err('unita', `${nome}: la classe non va dichiarata per le categorie D ed E`, undefined, i);
          if (cl.consistenza.trim()) err('unita', `${nome}: la consistenza non va indicata per le categorie D ed E`, undefined, i);
          if (!u.destinazioneUsoDE) err('unita', `${nome}: indicare la destinazione d'uso della categoria ${cat}`, undefined, i);
        }
      }
      if (isF(u) && cl && (cl.zonaCensuaria.trim() || cl.classe.trim() || cl.consistenza.trim()) && !det)
        err('unita', `${nome}: per la categoria F si indica solo la categoria`, undefined, i);
      if (det && cl && !cl.zonaCensuaria.trim()) err('unita', `${nome}: per demolizione totale la zona censuaria è obbligatoria`, undefined, i);
    }
    // poligoni e planimetria
    const pl = u.planimetria;
    const serveSuperficie = req !== 'nessuno' && isOrdinaria(u) && u.partitaSpeciale !== 'A';
    if (serveSuperficie && !causali.includes('VTO')) {
      const conPoligoni = !!pl && (poligoniPlanimetria(pl).length > 0 || pl.ntf !== undefined || (pl.altreSchede ?? []).some((x) => x.ntf !== undefined));
      if (!pl) err('elaborati', `${nome}: planimetria non associata`, undefined, i);
      else if (!conPoligoni) err('elaborati', `${nome}: mancano i poligoni delle superfici`, 'G0212', i);
    }
    if (causali.includes('VMI') && pl) err('elaborati', `${nome}: per modifica d'identificativo non va acquisita la planimetria`, undefined, i);
    if (pl) {
      if (!pl.dxf && !pl.tiff) err('elaborati', `${nome}: planimetria senza disegno (DXF o immagine)`, undefined, i);
      if (!(pl.progressivo >= 1)) err('elaborati', `${nome}: numero immagine della planimetria non valido`, undefined, i);
      (pl.altreSchede ?? []).forEach((s, k) => {
        if (!s.dxf && !s.tiff) err('elaborati', `${nome}: scheda ${k + 2} della planimetria senza disegno (DXF o immagine)`, undefined, i);
      });
      if (schedePlanimetria(pl).length > 999) err('elaborati', `${nome}: troppe schede nella planimetria`, undefined, i);
    }
    // modelli
    if (richiedeModelli(p) && req === 'completo' && !isF(u) && u.partitaSpeciale !== 'A') {
      if (isOrdinaria(u) && !u.mod1NParteII) err('modelli', `${nome}: manca il modello 1N parte II`, 'G0011', i);
      if (isSpeciale(u) && !u.mod2N) err('modelli', `${nome}: manca il modello 2N`, 'G0006', i);
    }
    if (isSpeciale(u) && u.mod1NParteII) err('modelli', `${nome}: modello 1N per unità a destinazione speciale`, 'G0061', i);
    if (isOrdinaria(u) && u.mod2N) err('modelli', `${nome}: modello 2N per unità a destinazione ordinaria`, 'G0060', i);
    const m = u.mod1NParteII;
    if (m && isOrdinaria(u)) {
      if (u.spessoreMuri === undefined) avv('modelli', `${nome}: 1N parte II, quadro A: indicare lo spessore dei muri`, undefined, i);
      if (!m.annoCostruzione) err('modelli', `${nome}: 1N parte II, quadro B: indicare l'anno di costruzione`, undefined, i);
      if (typeof m.nAscensori !== 'number') avv('modelli', `${nome}: 1N parte II, quadro D: numero di ascensori non indicato`, 'W1036', i);
      if (!m.gruppoC && /^A/.test(cat)) {
        if (!(m.vaniPrincipaliN > 0) || !(m.vaniPrincipaliSup > 0)) err('modelli', `${nome}: 1N parte II, quadro C: indicare numero e superficie utile dei vani principali`, undefined, i);
      }
      const altezza = m.gruppoC ? m.gruppoC.altezzaMediaCm : m.altezzaMediaCm;
      if (!(altezza > 0)) avv('modelli', `${nome}: 1N parte II, quadro C: altezza media utile non dichiarata`, 'W1019', i);
      if (!m.destinazioneUso.trim()) err('modelli', `${nome}: 1N parte II, quadro F: indicare la destinazione d'uso`, undefined, i);
      // quadro E (pavimenti e infissi): Docfa lo chiede in fase di controllo per le unità abitative
      const segnalaE = m.gruppoC ? avv : err;
      if (!Object.values(m.pavimenti ?? {}).some(Boolean)) segnalaE('modelli', `${nome}: 1N parte II, quadro E1: indicare il tipo prevalente di pavimentazione`, undefined, i);
      if (!Object.values(m.infissi ?? {}).some(Boolean)) segnalaE('modelli', `${nome}: 1N parte II, quadro E2: indicare il tipo prevalente di infissi interni`, undefined, i);
      if (m.dotazioni.altro && !m.dotazioniAltre?.trim()) err('modelli', `${nome}: 1N parte II, quadro D: descrivere l'altra dotazione`, undefined, i);
      if (/^C/.test(cat) && !m.gruppoC) err('modelli', `${nome}: categoria del gruppo C: compilare i locali del quadro C`, 'G0013', i);
    }
    if (m && u.ambienti.some((a) => !(a.superficie > 0))) err('elaborati', `${nome}: ambiente con superficie nulla nei dati metrici`, undefined, i);
  });
  const prog = p.unita.map((u) => u.planimetria?.progressivo).filter((x): x is number => !!x);
  if (new Set(prog).size !== prog.length) err('elaborati', 'Due planimetrie hanno lo stesso numero immagine');

  // ------------------------------------------------------------------ Quadro D (b.c.n.c., note, estremi)
  const note = p.annotazioni ?? '';
  // l'help indica 380 caratteri; il record ne contiene 385 (68 + 317) e Docfa li accetta (NCV081)
  if (note.length > 385) err('quadroD', `Le note superano i 385 caratteri (${note.length})`);
  // nel modello D stampato le note hanno 4 righe da 100 caratteri: oltre non si vedono (restano nel file dati)
  if (aCapo(note.replace(/[\r\n\t]+/g, ' ').trim(), 100).length > 4) avv('quadroD', 'Le note occupano più di 4 righe: nel modello D stampato le ultime parole non compaiono. Accorciare il testo');
  if (acc) {
    const bc = p.bcnc ?? [];
    if (bc.length > 20) err('quadroD', 'Al massimo 20 beni comuni non censibili');
    bc.forEach((b, k) => {
      if (!b.identificativo.foglio || !b.identificativo.numero) err('quadroD', `Bene comune non censibile ${k + 1}: indicare foglio e numero`);
      for (const x of b.piani) if (!pianoValido(x)) err('quadroD', `Bene comune non censibile ${k + 1}: piano errato (${x})`);
      if (p.unita.some((u) => [u.identificativo, ...u.graffati].some((y) => y.foglio === b.identificativo.foglio && y.numero === b.identificativo.numero && (y.subalterno ?? '') === (b.identificativo.subalterno ?? ''))))
        err('quadroD', `Bene comune non censibile ${k + 1}: identificativo uguale a quello di un'unità del quadro U`, 'G0018');
    });
    (p.estremi ?? []).forEach((e, k) => {
      const n = `Estremi del titolo ${k + 1}`;
      if (!(e.uiuDa >= 1) || !(e.uiuA >= e.uiuDa) || e.uiuA > p.unita.length) err('quadroD', `${n}: numero U.I.U. da/a errato`);
      if (!e.causale) err('quadroD', `${n}: digitare la causale`);
      if (!dataValida(e.efficacia)) err('quadroD', `${n}: data efficacia errata`);
      if (!e.repertorio.trim()) err('quadroD', `${n}: digitare il repertorio`);
      if (!e.rogante.trim()) err('quadroD', `${n}: digitare il rogante od il de cuius`);
      if (!e.provincia.trim()) err('quadroD', `${n}: digitare la provincia`);
      if (!e.sede.trim()) err('quadroD', `${n}: inserire la sede`);
      if (e.causale === 'DEN') {
        if (!e.volume?.trim()) err('quadroD', `${n}: digitare il volume (denuncia di successione)`);
        if (!dataValida(e.dataRegistrazione)) err('quadroD', `${n}: digitare la data di registrazione (denuncia di successione)`);
      }
    });
    if ((p.estremi ?? []).length > 3) err('quadroD', 'Al massimo 3 estremi del titolo giustificativo');
  }

  // ------------------------------------------------------------------ Dati del dichiarante e del tecnico
  {
    const ind = p.dichiarante.indirizzo.toUpperCase();
    if (ind.trim() && !CARATTERI_INDIRIZZO.test(ind))
      avv('dichiarante', `Indirizzo del dichiarante con caratteri non ammessi da Docfa: sarà scritto «${normalizzaIndirizzo(ind)}»`, 'W0708');
  }
  const t = p.tecnico;
  const albo = ALBI_TECNICO.find((a) => a.codice === t.albo.padStart(2, '0'));
  if (!t.cognome.trim()) err('dichiarante', 'Indicare il COGNOME del tecnico');
  if (!t.nome.trim()) err('dichiarante', 'Indicare il NOME del tecnico');
  if (!CF_PF.test(t.codiceFiscale.trim().toUpperCase())) err('dichiarante', 'CODICE FISCALE del tecnico errato');
  if (!albo) err('dichiarante', "Indicare l'ALBO DI ISCRIZIONE");
  else if (albo.dipendentePubblico) {
    if (t.provinciaAlbo.trim()) err('dichiarante', "Non indicare la PROVINCIA DI ISCRIZIONE all'albo per i tecnici dipendenti pubblici");
    if (t.numeroIscrizione.trim()) err('dichiarante', "Non indicare il NUMERO DI ISCRIZIONE all'albo per i tecnici dipendenti pubblici");
  } else {
    if (!/^[A-Z]{2}$/i.test(t.provinciaAlbo.trim())) err('dichiarante', "Indicare la PROVINCIA DI ISCRIZIONE all'albo");
    if (!t.numeroIscrizione.trim()) err('dichiarante', "Indicare il NUMERO DI ISCRIZIONE all'albo");
  }
  const di = p.dichiarante;
  if (!di.cognome.trim()) err('dichiarante', 'Indicare il COGNOME del dichiarante', 'G0004');
  if (!di.nome.trim()) err('dichiarante', 'Indicare il NOME del dichiarante');
  if (!di.indirizzo.trim()) err('dichiarante', "Indicare l'INDIRIZZO del dichiarante");
  if (!di.civico.trim()) err('dichiarante', 'Indicare il CIVICO (SNC se assente)');
  else if (!/^(SNC|\d{1,5}[A-Z]?|[0-9A-Z/-]{1,5})$/i.test(di.civico.trim())) err('dichiarante', 'Il CIVICO contiene dei caratteri non ammessi');
  if (!di.provincia.trim()) err('dichiarante', 'Indicare la PROVINCIA di residenza del dichiarante');
  if (!di.comune.trim()) err('dichiarante', 'Indicare il COMUNE di residenza del dichiarante');
  if (!/^\d{5}$/.test(di.cap.trim())) err('dichiarante', 'Indicare il CAP di residenza del dichiarante (5 cifre)');
  if (di.cognome && !NOME_VALIDO.test(di.cognome)) err('dichiarante', 'Il COGNOME contiene dei caratteri non ammessi');
  if (di.nome && !NOME_VALIDO.test(di.nome)) err('dichiarante', 'Il NOME contiene dei caratteri non ammessi');

  // ------------------------------------------------------------------ Modello 1N parte I
  const con1NII = p.unita.some((u) => u.mod1NParteII && u.operazione !== 'S');
  if (con1NII && !p.mod1NParteI) err('modelli', 'Manca il modello 1N parte I (fabbricato)', 'G0005');
  if (p.mod1NParteI) controlla1NParteI(p, err);

  // ------------------------------------------------------------------ Elaborato planimetrico ed elenco subalterni
  const ep = p.elaboratoPlanimetrico;
  const unicaSuParticella = p.unita.filter((u) => u.operazione !== 'S').length === 1;
  const motiviEp = motiviElaboratoObbligatorio(p);
  if (!ep && motiviEp.length) err('elenco', `Elaborato planimetrico ed elenco subalterni obbligatori in questo documento: ${motiviEp.join('; ')}`);
  if (ep) {
    if (!ep.identificativo.foglio || !ep.identificativo.numero) err('elaborati', 'Elaborato planimetrico: indicare foglio e particella');
    if (!(ep.progressivoImmagine >= 1)) err('elaborati', 'Elaborato planimetrico: numero immagine non valido');
    if (!ep.subalterni.length) err('elenco', "Elenco subalterni vuoto: usare Aggiorna per riportare le unità del documento");
    if (acc && !unicaSuParticella) ep.subalterni.forEach((s, k) => {
      if (s.tipo === 'U' && !s.entita.length && s.categoria !== 'F01') err('elenco', `Elenco subalterni, riga ${k + 1} (sub ${s.identificativo.subalterno ?? ''}): indicare i corpi di fabbrica`);
    });
    const disegni = ep.disegni ?? [];
    if (!disegni.length) err('elaborati', "Elaborato planimetrico: caricare il DXF del disegno (almeno una scheda)");
    disegni.forEach((d, k) => { if (!d.dxf && !d.tiff) err('elaborati', `Elaborato planimetrico: scheda ${k + 1} senza disegno (DXF o immagine)`); });
  }

  return {
    errori, avvisi,
    conteggi: { ...conteggi, planimetrie: p.unita.filter((u) => u.planimetria).length, mod1NParteII: p.unita.filter((u) => u.mod1NParteII).length, derivate: p.derivate ?? derivateCalcolate(p) },
  };
}

type Segnala = (sezione: SezionePratica, testo: string, codice?: string, unita?: number) => void;

function controllaIntestato(it: Intestato, i: number, tutti: Intestato[], nome: string, err: Segnala, avv: Segnala): void {
  const titolo = TITOLI.find((x) => x.codice === it.titolo);
  if (it.tipo === 'bcc') {
    if (it.cognome || it.nome || it.codiceFiscale || it.nascita) err('intestati', `${nome}: per beni comuni censibili non vanno impostati i campi dell'intestato`, 'E0243');
    return;
  }
  if (it.tipo === 'fisica') {
    if (!it.cognome?.trim() && !it.nome?.trim()) err('intestati', `${nome}: intestazione mancante`, 'E0201');
    else if (!it.cognome?.trim() || !it.nome?.trim()) err('intestati', `${nome}: intestazione incompleta (cognome e nome)`, 'E0202');
    if ((it.cognome && !NOME_VALIDO.test(it.cognome)) || (it.nome && !NOME_VALIDO.test(it.nome))) err('intestati', `${nome}: caratteri speciali non ammessi nel cognome e/o nome`, 'E0204');
    if (!it.nascita?.aaaa) err('intestati', `${nome}: data di nascita non dichiarata`, 'E0206');
    else if (!dataValida(it.nascita) || futura(it.nascita)) err('intestati', `${nome}: data di nascita formalmente errata`, 'E0207');
    if (!it.sesso) err('intestati', `${nome}: indicare il sesso`, 'E0203');
    if (!it.codiceFiscale?.trim()) err('intestati', `${nome}: codice fiscale non dichiarato`, 'E0208');
    else if (!CF_PF.test(it.codiceFiscale.trim().toUpperCase())) err('intestati', `${nome}: codice fiscale formalmente errato`, 'E0210');
    if (!it.provincia?.trim()) err('intestati', `${nome}: provincia non dichiarata`, 'E0215');
    if (!it.comune?.trim()) err('intestati', `${nome}: campo comune non impostato`, 'E0226');
  } else {
    if (!it.denominazione?.trim()) err('intestati', `${nome}: denominazione mancante`, 'E0201');
    if (it.codiceFiscale?.trim() && !CF_PG.test(it.codiceFiscale.trim()) && !CF_PF.test(it.codiceFiscale.trim().toUpperCase())) err('intestati', `${nome}: partita IVA formalmente errata`, 'E0212');
    if (it.nascita?.aaaa) err('intestati', `${nome}: data di nascita impostata per persona non fisica`, 'E0232');
    if (!it.comune?.trim()) avv('intestati', `${nome}: sede legale non indicata`, 'E0226');
  }
  if (!it.titolo?.trim()) err('intestati', `${nome}: titolo non dichiarato`, 'E0219');
  else if (!titolo) err('intestati', `${nome}: titolo errato`, 'E0221');
  const q = quota(it);
  if (titolo?.quotaObbligatoria && q === undefined) err('intestati', `${nome}: quota obbligatoria per il titolo dichiarato`, 'E0229');
  if (titolo && !titolo.quotaObbligatoria && q !== undefined) err('intestati', `${nome}: quota non ammessa per il titolo dichiarato`, 'E0228');
  if (q !== undefined && (q > 1 || q <= 0)) err('intestati', `${nome}: quota titolo errata`, 'E0223');
  if (it.riferimento && it.regime !== 'C') err('intestati', `${nome}: il numero d'ordine dell'intestato di riferimento va indicato solo in comunione legale`, 'E0222');
  if (it.regime === 'C') {
    const r = it.riferimento ? tutti[it.riferimento - 1] : undefined;
    if (!r || it.riferimento === i + 1 || r.tipo !== 'fisica') err('intestati', `${nome}: numero d'ordine di riferimento inesistente o errato`, 'E0211');
  }
}

function quota(it: Intestato): number | undefined {
  if (!it.quotaNumeratore || !it.quotaDenominatore) return undefined;
  const n = Number(it.quotaNumeratore.replace(',', '.'));
  return Number.isFinite(n) ? n / it.quotaDenominatore : undefined;
}

/** Quadratura delle quote per i casi semplici (proprietà, nuda proprietà, usufrutto). */
function controllaQuote(intestati: Intestato[], dn: string, err: Segnala): void {
  const somma = (...codici: string[]) => intestati.filter((x) => codici.includes(x.titolo)).reduce((s, x) => s + (quota(x) ?? 0), 0);
  const titoli = new Set(intestati.map((x) => x.titolo));
  const semplici = [...titoli].every((t) => ['01 ', '02 ', '08 ', '08A'].includes(t));
  if (!semplici) return;
  const piena = somma('01 ');
  const nuda = somma('02 ');
  const usufrutto = somma('08 ', '08A');
  const uguale = (a: number, b: number) => Math.abs(a - b) < 0.0005;
  if (nuda > 0 && usufrutto === 0) err('intestati', `${dn}nella ditta mancano i diritti sul reddito`, 'E0400');
  if (usufrutto > 0 && nuda === 0 && piena < 1) err('intestati', `${dn}nella ditta mancano i diritti sulla proprietà`, 'E0401');
  if (!uguale(piena + nuda, 1)) err('intestati', `${dn}quote relative ai diritti sulla proprietà errate (${Math.round((piena + nuda) * 1000)}/1000)`, 'E0405');
  if ((usufrutto > 0 || nuda > 0) && !uguale(piena + usufrutto, 1)) err('intestati', `${dn}quote relative ai diritti sul reddito errate (${Math.round((piena + usufrutto) * 1000)}/1000)`, 'E0404');
}

/** Quadri obbligatori del modello 1N parte I (help "Modello 1NB - parte I"). */
function controlla1NParteI(p: Pratica, err: Segnala): void {
  const b = p.mod1NParteI!.recordB;
  const c = p.mod1NParteI!.recordC;
  const uno = (rec: Record<string, unknown>, prefisso: string) => Object.entries(rec).some(([k, v]) => k.startsWith(prefisso) && !k.endsWith('_descrizione') && (v === 1 || v === true));
  if (!b.anno_costruzione) err('modelli', '1N parte I, quadro B: indicare l\'anno di costruzione');
  if (![1, 2, 3].includes(Number(b.posizione_fabbricato))) err('modelli', '1N parte I, quadro C sez. 1.a: indicare la posizione rispetto ai fabbricati circostanti (isolato, contiguo, a schiera)', 'W0806');
  if (!['n_abitazioni', 'n_negozi', 'n_laboratori', 'n_magazzini', 'n_uffici', 'n_box', 'n_autorimesse', 'n_impianti_sportivi', 'n_uiu_cat_b'].some((k) => Number(b[k]) > 0))
    err('modelli', '1N parte I, quadro C sez. 2: indicare la destinazione e il numero di u.i. del fabbricato (almeno una)');
  const riga = (pre: string) => Number(b[pre]) > 0 || (Number(b[`${pre}_min`]) > 0 && Number(b[`${pre}_max`]) > 0);
  if (!riga('piani_fuori_terra') && !riga('piani_entro_terra')) err('modelli', '1N parte I, quadro C sez. 4: indicare i piani fuori o entro terra');
  if (!Object.keys(b).some((k) => /^facciata\d_/.test(k) && (b[k] === 1 || b[k] === true)))
    err('modelli', '1N parte I, quadro E: indicare almeno un tipo di affaccio');
  if (!uno(c, 'strutture_')) err('modelli', '1N parte I, quadro F: indicare le strutture portanti verticali');
  if (!uno(c, 'copertura_')) err('modelli', '1N parte I, quadro F: indicare la copertura');
  if (!uno(c, 'tamponature_')) err('modelli', '1N parte I, quadro F: indicare le tamponature');
  if (typeof c.n_ascensori !== 'number') err('modelli', '1N parte I, quadro G: numero di ascensori obbligatorio (anche 0)');
  if (!uno(c, 'fin_principale_') && !uno(c, 'fin_altre_')) err('modelli', '1N parte I, quadro I sez. 1: indicare il tipo prevalente di finitura esterna');
  if (!uno(c, 'portone_') && !uno(c, 'accessi_')) err('modelli', '1N parte I, quadro I sez. 2: indicare i serramenti esterni degli accessi');
  for (const [flag, descr, quadro] of [['strutture_altro', 'strutture_altro_descrizione', 'F'], ['tamponature_altro', 'tamponature_altro_descrizione', 'F'], ['imp_altro', 'imp_altro_descrizione', 'G'], ['imp_energie_alternative', 'energie_alternative_descrizione', 'G'], ['rec_altro', 'rec_altro_descrizione', 'H'], ['vincolo_storico', 'vincolo_descrizione', 'M']] as const)
    if ((c[flag] === 1 || c[flag] === true) && !String(c[descr] ?? '').trim()) err('modelli', `1N parte I, quadro ${quadro}: inserire la descrizione in chiaro`);
  for (const [flag, descr, quadro] of [['coperti_altro', 'coperti_altro_descrizione', 'D'], ['scoperti_altro', 'scoperti_altro_descrizione', 'D']] as const)
    if ((b[flag] === 1 || b[flag] === true) && !String(b[descr] ?? '').trim()) err('modelli', `1N parte I, quadro ${quadro}: inserire la descrizione dell'altra destinazione`);
}

/** Controlli di un singolo schermo (tasto OK di Docfa). */
export function controllaSchermo(p: Pratica, sezione: SezionePratica, unita?: number): Problema[] {
  const e = controllaPratica(p);
  return e.errori.filter((x) => x.sezione === sezione && (unita === undefined || x.unita === undefined || x.unita === unita));
}

/** Codici delle causali barrate, nell'ordine dei flag (per la stampa). */
export function causaliOrdinate(p: Pratica): CodiceVariazione[] {
  return CAUSALI_VARIAZIONE.filter((c) => causaliBarrate(p).includes(c));
}

export { TIPOLOGIE_PLANIMETRICHE };
