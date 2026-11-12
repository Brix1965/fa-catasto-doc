<!-- Fa.Catasto.Doc – Copyright (C) 2026 Giacomo Lombardo Geometra
     SPDX-License-Identifier: GPL-3.0-only (termini aggiuntivi nel file NOTICE) -->
<script lang="ts">
  /**
   * Proposta dei vani dalla planimetria (modulo SPERIMENTALE): finestra sopra il modello 1N parte II con la
   * planimetria a colori, un vano per riga. Il tecnico cambia il tipo di ogni vano (clic sul disegno o sulla
   * riga), corregge i m², esclude quello che non va, poi conferma: i totali passano nel quadro C, dove restano
   * modificabili a mano come sempre. Il disegno si ingrandisce con la rotella e si sposta trascinando; «Modifica la
   * forma» mostra i vertici del vano, che si spostano (con aggancio alle linee del disegno), si aggiungono e si tolgono:
   * i m² si ricalcolano.
   */
  import type { Mod1NParteII, PropostaVani, UnitaImmobiliare, VanoProposto } from '$lib/core/model';
  import { altezzeUnita, chiaveParola, m2Intero, parolaSconosciuta, tipoDaTesto, totaliVani, type ParolaVano, type RisultatoVani, type TipoVano, type VanoRiconosciuto } from '$lib/core/vani/riconosci';
  import { impostazioni } from '$lib/stato/impostazioni.svelte';
  import { riconosciInBackground, schedeConDxf } from '$lib/core/vani/esegui';
  import { consistenzaVani } from '$lib/core/vani/totali';
  import { agganciaAlDisegno, allineaAiVicini, direzionePrincipale, dist, distSegmento, type P, type TipoAggancioDisegno } from '$lib/core/disegno/geometria';
  import { areaContorni, centroContorni, dividiVano, unisciVani } from '$lib/core/vani/forme';
  import { conferma as chiedi } from '$lib/piattaforma';
  import Icona from './Icona.svelte';
  import { untrack } from 'svelte';

  let { unita = $bindable(), aperto = $bindable(), auto = false }: { unita: UnitaImmobiliare; aperto: boolean; auto?: boolean } = $props();
  const m = $derived(unita.mod1NParteII as Mod1NParteII);

  const TIPI: { tipo: TipoVano; nome: string; breve: string; colore: string }[] = [
    { tipo: 'principale', nome: 'Vano principale', breve: 'Principale', colore: '#e11d48' },
    { tipo: 'bagno', nome: 'Bagno', breve: 'Bagno', colore: '#2563eb' },
    { tipo: 'diretto', nome: 'Accessorio diretto', breve: 'Acc. diretto', colore: '#f59e0b' },
    { tipo: 'indiretto', nome: 'Accessorio indiretto', breve: 'Acc. indiretto', colore: '#16a34a' },
    { tipo: 'escluso', nome: 'Escluso (non è un vano)', breve: 'Escluso', colore: '#9ca3af' },
  ];
  const colore = (t: TipoVano) => TIPI.find((x) => x.tipo === t)?.colore ?? '#9ca3af';

  let stato = $state<'calcolo' | 'pronto' | 'errore'>('calcolo');
  let errore = $state('');
  let risultati = $state<RisultatoVani[]>([]);
  let vani = $state<VanoRiconosciuto[][]>([]);
  let scheda = $state(0);
  let selezionato = $state<{ s: number; id: number } | null>(null);
  let evidenziato = $state<number | null>(null);

  const tutti = $derived(vani.flat());
  const totali = $derived(totaliVani(tutti));
  /** altezza media utile e superficie con h < 2,30 dai testi «h…» del disegno */
  const altezze = $derived(altezzeUnita(tutti));
  /** consistenza indicativa del gruppo A: principali + accessori diretti 1/3 + indiretti 1/4, al mezzo vano */
  const consistenza = $derived(consistenzaVani(totali));
  const verificare = (v: VanoRiconosciuto) => !!v.nota?.includes('verificare') && v.tipo !== 'escluso' && v.tipo === v.tipoProposto;
  const daVerificare = $derived(tutti.filter(verificare).length);

  /** richiesta in corso: chiudendo e riaprendo, il risultato di un calcolo vecchio non sovrascrive quello nuovo */
  let richiesta = 0;
  async function calcola(forza = false): Promise<void> {
    // proposta corretta a mano nella forma (vani divisi, uniti, disegnati): ricalcolare la cancella
    if (forza && (modificata || m.propostaVani?.modificata) && !(await chiedi('Ricalcolando dal disegno si perdono le modifiche fatte a mano alla forma dei vani. Continuare?'))) return;
    const mia = ++richiesta;
    stato = 'calcolo';
    errore = '';
    try {
      const schede = schedeConDxf($state.snapshot(unita.planimetria) as UnitaImmobiliare['planimetria']);
      if (!schede.length) throw new Error('La planimetria di questa unità non ha un DXF: il riconoscimento dei vani parte dal disegno DXF.');
      const r = await riconosciInBackground({ schede });
      if (mia !== richiesta || !aperto) return;
      risultati = r;
      // scelte già confermate in precedenza: si riapplicano ai vani nella stessa posizione
      const prima = m.propostaVani?.schede ?? [];
      // forme corrette a mano: la proposta confermata si riprende così com'è (il disegno serve solo per lo sfondo)
      if (!forza && m.propostaVani?.modificata && prima.length === risultati.length) {
        vani = prima.map((x) => $state.snapshot(x.vani) as unknown as VanoRiconosciuto[]);
        modificata = true;
      } else { modificata = false; vani = risultati.map((r, s) => r.vani.map((v) => {
        // il vano di allora com'era proposto (prima delle correzioni della forma)
        const p = prima[s]?.vani.find((x) => { const o = x.originale ?? x; return Math.hypot(o.centro[0] - v.centro[0], o.centro[1] - v.centro[1]) < 0.3 && Math.abs(o.superficie - v.superficie) < 0.5; });
        // si riapplicano solo le scelte del tecnico (tipo, m², forma diversi dalla proposta di allora): se il disegno è
        // cambiato, il resto segue la proposta nuova
        if (!p) return v;
        const conForma = p.forma && p.originale ? { forma: true, originale: v.originale ?? { superficie: v.superficie, centro: v.centro, contorni: v.contorni }, contorni: p.contorni, superficie: p.superficie, centro: p.centro } : {};
        const sup = p.forma ? p.superficie : v.superficie;
        return { ...v, ...conForma, tipo: p.tipo !== p.tipoProposto ? (p.tipo as TipoVano) : v.tipo, m2: p.m2 !== m2Intero(p.superficie) ? p.m2 : m2Intero(sup) };
      })); }
      storia = []; nStoria = 0;
      scheda = 0;
      modifica = null; modoForme = false; punti = [];
      stato = 'pronto';
      adatta();
    } catch (e) {
      errore = e instanceof Error ? e.message : String(e);
      stato = 'errore';
    }
  }

  $effect(() => { if (aperto) untrack(() => void calcola()); });

  // ---- parole che il programma non conosce: il tecnico le insegna una volta (dizionario personale, per tutte le pratiche)
  const sconosciute = $derived.by(() => {
    const diz = impostazioni.dati.paroleVani ?? {};
    const out = new Map<string, { testo: string; vani: number[] }>();
    for (const v of vani[scheda] ?? []) for (const t of v.testi ?? []) {
      if (!parolaSconosciuta(t, diz)) continue;
      const k = chiaveParola(t);
      if (!out.has(k)) out.set(k, { testo: t.trim(), vani: [] });
      if (!out.get(k)!.vani.includes(v.id)) out.get(k)!.vani.push(v.id);
    }
    return [...out.values()];
  });
  let msgParole = $state('');
  async function insegna(testo: string, tipo: ParolaVano): Promise<void> {
    await impostazioni.impostaParolaVano(testo, tipo);
    const k = chiaveParola(testo);
    // i vani con quella parola e senza altri nomi riconosciuti prendono subito il tipo
    if (tipo !== 'ignora') for (const v of vani[scheda] ?? []) {
      const testi = v.testi ?? [];
      if (!testi.some((t) => chiaveParola(t) === k)) continue;
      if (testi.some((t) => chiaveParola(t) !== k && tipoDaTesto(t))) continue;
      v.tipo = tipo;
    }
    msgParole = tipo === 'ignora' ? `«${testo}» non è un nome di vano: d'ora in poi non lo chiedo più.` : `«${testo}» = ${TIPI.find((x) => x.tipo === tipo)?.breve ?? tipo}: lo ricordo per tutte le pratiche (Impostazioni → Parole dei vani).`;
  }

  function scegli(s: number, id: number, tipo: TipoVano): void {
    const v = vani[s].find((x) => x.id === id);
    if (v) v.tipo = tipo;
  }
  function cambiaM2(s: number, id: number, valore: string): void {
    const v = vani[s].find((x) => x.id === id);
    const n = Math.max(0, Math.round(Number(valore.replace(',', '.'))));
    if (v && Number.isFinite(n)) v.m2 = n;
  }
  function ripristina(s: number, id: number): void {
    const v = vani[s].find((x) => x.id === id);
    if (!v) return;
    if (v.originale) memorizza();
    if (v.originale) { v.contorni = v.originale.contorni; v.superficie = v.originale.superficie; v.centro = v.originale.centro; v.forma = false; v.originale = undefined; }
    v.tipo = v.tipoProposto; v.m2 = m2Intero(v.superficie);
    if (modifica?.s === s && modifica.id === id) vSel = null;
  }

  function conferma(): void {
    const t = totali;
    m.vaniPrincipaliN = t.principaliN; m.vaniPrincipaliSup = t.principaliSup;
    m.bagniN = t.bagniN; m.bagniSup = t.bagniSup;
    m.accessoriDirettiN = t.direttiN; m.accessoriDirettiSup = t.direttiSup;
    m.accessoriIndirettiN = t.indirettiN;
    // la superficie degli accessori indiretti, se ci sono i poligoni, la calcola il programma dai poligoni B/C
    if (!auto) m.accessoriIndirettiSup = t.indirettiSup;
    // dati metrici: solo se il disegno ha le altezze scritte
    if (altezze) { m.altezzaMediaCm = altezze.altezzaMediaCm; m.supAltezzaInferiore230 = altezze.supInferiore230; }
    const proposta: PropostaVani = { confermata: new Date().toISOString(), modificata: modificata || undefined, schede: $state.snapshot(vani).map((vs) => ({ vani: vs.map(({ contorniLordi: _, ...v }) => v) as VanoProposto[] })) };
    m.propostaVani = proposta;
    aperto = false;
  }

  // ---- disegno: vista (zoom con la rotella, spostamento trascinando)
  const limiti = $derived(risultati[scheda]?.limiti);
  let vista = $state({ x: 0, y: 0, w: 1, h: 1 });
  const viewBox = $derived(`${vista.x} ${vista.y} ${vista.w} ${vista.h}`);
  let svgEl = $state<SVGSVGElement | null>(null);
  /** inquadra i vani della scheda (o, se non ce ne sono, tutto il disegno) */
  function adatta(): void {
    const pts = (vani[scheda] ?? []).flatMap((v) => v.contorni.flat());
    if (pts.length) { inquadra(pts as P[], 0.08); return; }
    const l = risultati[scheda]?.limiti;
    if (l) vista = { x: l.x0 - 0.5, y: -l.y1 - 0.5, w: l.x1 - l.x0 + 1, h: l.y1 - l.y0 + 1 };
    requestAnimationFrame(() => (upp = perPixel()));
  }
  $effect(() => { void scheda; untrack(adatta); });
  function inquadra(pts: P[], margine: number): void {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const m = Math.max(0.5, margine * Math.max(x1 - x0, y1 - y0));
    vista = { x: x0 - m, y: -y1 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
    requestAnimationFrame(() => (upp = perPixel()));
  }
  /** coordinate SVG (y verso il basso) del puntatore */
  function puntoSvg(e: MouseEvent): [number, number] {
    const m = svgEl?.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  }
  /** unità del disegno per pixel dello schermo */
  function perPixel(): number { const m = svgEl?.getScreenCTM(); return m ? 1 / m.a : 0.01; }
  let upp = $state(0.01);
  let largArea = $state(0);
  $effect(() => { void largArea; void vista; requestAnimationFrame(() => (upp = perPixel())); });
  function zoomA(f: number, c?: [number, number]): void {
    const [cx, cy] = c ?? [vista.x + vista.w / 2, vista.y + vista.h / 2];
    const l = risultati[scheda]?.limiti;
    const max = l ? Math.max(l.x1 - l.x0, l.y1 - l.y0) * 3 : 1000;
    const w = Math.max(0.5, Math.min(max, vista.w * f)), k = w / vista.w;
    vista = { x: cx - (cx - vista.x) * k, y: cy - (cy - vista.y) * k, w, h: vista.h * k };
    requestAnimationFrame(() => (upp = perPixel()));
  }
  function rotella(e: WheelEvent): void {
    e.preventDefault();
    zoomA(Math.exp(e.deltaY * 0.0015), puntoSvg(e));
  }
  let spinta = $state.raw<{ x: number; y: number; vx: number; vy: number; id: number } | null>(null);
  let trascinato = $state(false);
  function giu(e: PointerEvent): void {
    if (e.button !== 0 && e.button !== 1) return;
    trascinato = false;
    if (e.button === 0 && modoForme && strumento === 'aggiungi' && modifica && aggiungiVertice(e)) return;
    spinta = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y, id: e.pointerId };
  }
  function muovi(e: PointerEvent): void {
    if (trascinaV) { muoviVertice(e); return; }
    muoviCursore(e);
    if (!spinta) return;
    const dx = e.clientX - spinta.x, dy = e.clientY - spinta.y;
    if (!trascinato && Math.hypot(dx, dy) < 4) return;
    if (!trascinato) { trascinato = true; svgEl?.setPointerCapture(spinta.id); }
    const u = perPixel();
    vista = { ...vista, x: spinta.vx - dx * u, y: spinta.vy - dy * u };
  }
  function su(): void {
    spinta = null;
    if (trascinaV) { trascinaV = null; }
    agganciato = null;
  }

  // ---- «Modifica le forme»: pulsante sempre visibile; strumenti con il loro nome, uno alla volta, senza tasto destro
  type Strumento = 'sposta' | 'aggiungi' | 'togli' | 'dividi' | 'unisci' | 'nuovo';
  const STRUMENTI: { s: Strumento; nome: string; aiuto: string }[] = [
    { s: 'sposta', nome: 'Sposta vertici', aiuto: 'Clic su un vano: compaiono i suoi vertici (quadratini). Trascina un quadratino per spostarlo: si aggancia da solo agli spigoli, agli incroci e alle linee dei muri (segno arancione).' },
    { s: 'aggiungi', nome: 'Aggiungi vertice', aiuto: 'Clic su un vano, poi clic sul suo bordo dove vuoi il vertice nuovo (lo puoi subito trascinare).' },
    { s: 'togli', nome: 'Togli vertice', aiuto: 'Clic su un vano, poi clic sul quadratino del vertice da togliere.' },
    { s: 'dividi', nome: 'Dividi vano', aiuto: 'Clic su un vano, poi clic su un punto del bordo e su un punto del bordo opposto: il vano diventa due.' },
    { s: 'unisci', nome: 'Unisci vani', aiuto: 'Clic sul primo vano, poi clic sul vano da unire: diventano un vano solo.' },
    { s: 'nuovo', nome: 'Nuovo vano', aiuto: 'Clic sui vertici del vano nuovo, uno dopo l\'altro; per finire clic sul primo vertice o «Chiudi il vano».' },
  ];
  let modoForme = $state(false);
  let strumento = $state<Strumento>('sposta');
  /** vano scelto per le modifiche (scheda e numero) */
  let modifica = $state<{ s: number; id: number } | null>(null);
  let vSel = $state<{ r: number; k: number } | null>(null);
  let ortogonale = $state(false);
  /** punti del taglio (dividi) o del vano nuovo, e posizione del puntatore per l'anteprima */
  let punti = $state<P[]>([]);
  let cursore = $state<P | null>(null);
  let msgForme = $state('');
  /** la proposta è stata cambiata a mano nella forma: riaprendo si ritrova così com'è */
  let modificata = $state(false);
  let trascinaV: { r: number; k: number; mosso: boolean } | null = null;
  const vanoInModifica = $derived(modifica ? vani[modifica.s]?.find((x) => x.id === modifica!.id) : undefined);
  /** orientamento dei muri, per l'ortogonale */
  const angolo = $derived(direzionePrincipale((risultati[scheda]?.linee ?? []).filter((l) => !l.tratteggiata).map((l) => [l.a, l.b] as [P, P])));
  /** linee del disegno (muri), per l'aggancio anche senza ortogonale: spigoli, incroci, linee */
  const lineeDisegno = $derived((risultati[scheda]?.linee ?? []).map((l) => [l.a, l.b] as [P, P]));
  /** aggancio in corso, mostrato con un segno sul disegno */
  let agganciato = $state<{ p: P; tipo: TipoAggancioDisegno } | null>(null);
  const NOME_AGGANCIO: Record<TipoAggancioDisegno, string> = { spigolo: 'spigolo', incrocio: 'incrocio dei muri', linea: 'sulla linea' };

  // annulla: istantanee di tutti i vani
  let storia: string[] = [];
  let nStoria = $state(0);
  function memorizza(): void { storia.push(JSON.stringify($state.snapshot(vani))); if (storia.length > 60) storia.shift(); nStoria = storia.length; }
  function annulla(): void {
    const s = storia.pop(); nStoria = storia.length;
    if (!s) return;
    vani = JSON.parse(s); vSel = null; punti = [];
    if (modifica && !vani[modifica.s]?.some((x) => x.id === modifica!.id)) modifica = null;
  }

  function apriForme(): void { modoForme = true; strumento = 'sposta'; punti = []; msgForme = ''; requestAnimationFrame(() => (upp = perPixel())); }
  function chiudiForme(): void { modoForme = false; modifica = null; vSel = null; punti = []; msgForme = ''; }
  function scegliStrumento(x: Strumento): void {
    strumento = x; punti = []; vSel = null; msgForme = '';
    // si comincia dal primo vano da unire; il vano nuovo non parte da un vano scelto
    if (x === 'unisci' || x === 'nuovo') modifica = null;
  }
  /** dalla tabella: «Modifica le forme» con quel vano scelto e la vista portata sul vano */
  function iniziaModifica(s: number, id: number): void {
    if (scheda !== s) scheda = s;
    if (!modoForme) apriForme();
    modifica = { s, id }; vSel = null; selezionato = { s, id };
    const v = vani[s]?.find((x) => x.id === id);
    const pts = (v?.contorni.flat() ?? []) as P[];
    if (pts.length) inquadra(pts, 0.4);
  }
  /** scelto un vano mentre si modificano le forme: se sullo schermo è piccolo la vista si avvicina */
  function avvicina(id: number): void {
    const v = vani[scheda]?.find((x) => x.id === id);
    const pts = (v?.contorni.flat() ?? []) as P[];
    if (!pts.length) return;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const lato = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / (perPixel() || 1);
    if (lato < 220) inquadra(pts, 0.5);
  }
  /** la forma è cambiata: m² ricalcolati (quelli scritti a mano restano) */
  function aggiornaForma(v: VanoRiconosciuto): void {
    if (!v.originale) v.originale = { superficie: v.superficie, centro: v.centro, contorni: $state.snapshot(v.contorni) as P[][] };
    const manuale = v.m2 !== m2Intero(v.superficie);
    v.superficie = Math.round(areaContorni(v.contorni) * 100) / 100;
    if (!manuale) v.m2 = m2Intero(v.superficie);
    v.centro = centroContorni(v.contorni);
    v.forma = true;
    modificata = true;
  }
  /** punto del puntatore con l'aggancio: vertici del vano scelto, spigoli del disegno, bordo del vano */
  function puntoAgganciato(e: MouseEvent, conBordo = true): P {
    const [sx, sy] = puntoSvg(e);
    const p: P = [sx, -sy];
    const t = upp * 10;
    let best: P | null = null, d = t;
    const t2 = upp * 8;
    const vs = (conBordo ? vanoInModifica?.contorni.flat() ?? [] : []) as P[];
    d = t2;
    agganciato = null;
    for (const q of [...vs, ...punti]) { const x = dist(q, p); if (x < d) { d = x; best = q; } }
    if (best) { agganciato = { p: [best[0], best[1]], tipo: 'spigolo' }; return [best[0], best[1]]; }
    const ag = agganciaAlDisegno(p, lineeDisegno, t2);
    if (ag && ag.tipo !== 'linea') { agganciato = ag; return ag.p; }
    if (conBordo && vanoInModifica) {
      let bp: P | null = null; d = t;
      for (const c of vanoInModifica.contorni) for (let k = 0; k < c.length; k++) {
        const a = c[k] as P, b = c[(k + 1) % c.length] as P;
        const x = distSegmento(p, a, b);
        if (x < d) { d = x; const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)); bp = [a[0] + u * dx, a[1] + u * dy]; }
      }
      if (bp) return bp;
    }
    if ((ortogonale || e.shiftKey) && punti.length) return allineaAiVicini(p, [punti[punti.length - 1]], angolo, upp * 14).p;
    if (ag) { agganciato = ag; return ag.p; }
    return p;
  }
  function giuVertice(e: PointerEvent, r: number, k: number): void {
    e.stopPropagation();
    if (e.button !== 0) return;
    const v = vanoInModifica;
    if (!v) return;
    if (strumento === 'togli') {
      const c = v.contorni[r];
      if (!c || c.length <= 3) { msgForme = 'Un vano deve avere almeno 3 vertici: per toglierlo tutto usa «Elimina vano».'; return; }
      memorizza(); c.splice(k, 1); vSel = null; aggiornaForma(v); msgForme = 'Vertice tolto.';
      return;
    }
    if (strumento !== 'sposta' && strumento !== 'aggiungi') return;
    vSel = { r, k };
    trascinaV = { r, k, mosso: false };
    svgEl?.setPointerCapture(e.pointerId);
  }
  function muoviVertice(e: PointerEvent): void {
    const v = vanoInModifica;
    if (!v || !trascinaV) return;
    const [sx, sy] = puntoSvg(e);
    let p: P = [sx, -sy];
    // aggancio al disegno sempre attivo (anche per gli edifici non squadrati): spigoli e incroci dei muri, poi
    // con l'ortogonale l'allineamento ai vertici vicini, altrimenti il punto più vicino sulla linea del muro
    const ag = agganciaAlDisegno(p, lineeDisegno, upp * 10);
    agganciato = null;
    if (ag && ag.tipo !== 'linea') { p = ag.p; agganciato = ag; }
    else if (ortogonale || e.shiftKey) {
      const c = v.contorni[trascinaV.r];
      const n = c.length;
      p = allineaAiVicini(p, [c[(trascinaV.k - 1 + n) % n] as P, c[(trascinaV.k + 1) % n] as P], angolo, upp * 14).p;
    } else if (ag) { p = ag.p; agganciato = ag; }
    if (!trascinaV.mosso) memorizza();
    v.contorni[trascinaV.r][trascinaV.k] = p;
    trascinaV.mosso = true;
    aggiornaForma(v);
  }
  function aggiungiVertice(e: PointerEvent): boolean {
    const v = vanoInModifica;
    if (!v) return false;
    const [sx, sy] = puntoSvg(e);
    const p: P = [sx, -sy];
    let br = -1, bk = -1, d = upp * 9;
    v.contorni.forEach((c, r) => { for (let k = 0; k < c.length; k++) { const x = distSegmento(p, c[k] as P, c[(k + 1) % c.length] as P); if (x < d) { d = x; br = r; bk = k; } } });
    if (br < 0) return false;
    memorizza();
    v.contorni[br].splice(bk + 1, 0, p);
    vSel = { r: br, k: bk + 1 };
    trascinaV = { r: br, k: bk + 1, mosso: true };
    svgEl?.setPointerCapture(e.pointerId);
    aggiornaForma(v);
    msgForme = 'Vertice aggiunto: trascinalo dove serve.';
    return true;
  }
  const nuovoId = (s: number) => Math.max(0, ...(vani[s] ?? []).map((x) => x.id)) + 1;
  function vanoDa(s: number, contorni: P[][], base: Partial<VanoRiconosciuto>): VanoRiconosciuto {
    const sup = Math.round(areaContorni(contorni) * 100) / 100;
    return { id: nuovoId(s), tipo: 'principale', tipoProposto: 'principale', superficie: sup, m2: m2Intero(sup), testi: [], altezze: [], contorni, centro: centroContorni(contorni), forma: true, ...base } as VanoRiconosciuto;
  }
  function dividi(a: P, b: P): void {
    const v = vanoInModifica;
    if (!v || !modifica) return;
    const pezzi = dividiVano(v.contorni as P[][], a, b);
    if (!pezzi) { msgForme = 'Il segmento non attraversa il vano da un bordo all\'altro: riprova cliccando proprio sui due bordi.'; return; }
    memorizza();
    const s = modifica.s;
    v.contorni = pezzi[0];
    aggiornaForma(v);
    for (const pz of pezzi.slice(1)) vani[s].push(vanoDa(s, pz, { tipo: v.tipo, tipoProposto: v.tipo, nota: `diviso a mano dal vano ${v.id}` }));
    msgForme = `Vano ${v.id} diviso in ${pezzi.length}: ora scegli il tipo di ogni pezzo.`;
  }
  function unisci(a: number, b: number): void {
    if (!modifica) return;
    const s = modifica.s;
    const va = vani[s].find((x) => x.id === a), vb = vani[s].find((x) => x.id === b);
    if (!va || !vb) return;
    memorizza();
    va.contorni = unisciVani(va.contorni as P[][], vb.contorni as P[][]);
    va.testi = [...va.testi, ...vb.testi];
    va.altezze = [...va.altezze, ...vb.altezze];
    vani[s] = vani[s].filter((x) => x.id !== b);
    aggiornaForma(va);
    va.m2 = m2Intero(va.superficie);
    msgForme = `Vani ${a} e ${b} uniti: ora sono il vano ${a}.`;
  }
  function chiudiNuovo(): void {
    if (punti.length < 3) { msgForme = 'Servono almeno 3 vertici.'; return; }
    if (areaContorni([punti]) < 0.1) { msgForme = 'Il vano disegnato non ha superficie: ingrandisci il disegno e rimetti i vertici.'; punti = []; return; }
    memorizza();
    const v = vanoDa(scheda, [punti.map((p) => [p[0], p[1]] as P)], { nota: 'vano disegnato a mano' });
    vani[scheda].push(v);
    modificata = true;
    punti = [];
    modifica = { s: scheda, id: v.id }; selezionato = modifica;
    msgForme = `Vano ${v.id} aggiunto (${v.m2} m²): scegline il tipo qui sopra.`;
  }
  function eliminaVano(): void {
    if (!modifica) return;
    const { s, id } = modifica;
    memorizza();
    vani[s] = vani[s].filter((x) => x.id !== id);
    modificata = true;
    modifica = null; vSel = null;
    msgForme = `Vano ${id} eliminato (Annulla per riaverlo).`;
  }
  /** clic sul disegno: nel modo normale sceglie il vano; in «Modifica le forme» fa quello che dice lo strumento */
  function clic(e: MouseEvent): void {
    if (trascinato) return;
    const el = (e.target as Element).closest('[data-vano]');
    const id = el ? Number(el.getAttribute('data-vano')) : null;
    if (!modoForme) { if (id !== null) selezionato = { s: scheda, id }; else selezionato = null; return; }
    if (strumento === 'nuovo') {
      const p = puntoAgganciato(e, false);
      if (punti.length >= 3 && dist(p, punti[0]) < upp * 10) { chiudiNuovo(); return; }
      punti = [...punti, p];
      return;
    }
    if (strumento === 'dividi' && vanoInModifica) {
      const p = puntoAgganciato(e);
      if (!punti.length) { punti = [p]; return; }
      const a = punti[0];
      punti = [];
      dividi(a, p);
      return;
    }
    if (id === null) return;
    if (strumento === 'unisci' && modifica && modifica.id !== id) { unisci(modifica.id, id); modifica = null; return; }
    modifica = { s: scheda, id }; selezionato = modifica; vSel = null; punti = [];
    if (strumento === 'unisci') { msgForme = `Vano ${id} scelto: ora clic sul vano da unire.`; return; }
    avvicina(id);
  }
  function muoviCursore(e: PointerEvent): void {
    if (modoForme && (strumento === 'dividi' || strumento === 'nuovo') && punti.length) cursore = puntoAgganciato(e, strumento === 'dividi');
  }
  const percorso = (c: [number, number][][]) => c.map((r) => 'M' + r.map(([x, y]) => `${x.toFixed(3)},${(-y).toFixed(3)}`).join('L') + 'Z').join(' ');
  const aiutoStrumento = $derived(STRUMENTI.find((x) => x.s === strumento)?.aiuto ?? '');

  function tasti(e: KeyboardEvent): void {
    if (!aperto) return;
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (punti.length) punti = []; else if (modoForme) chiudiForme(); else aperto = false;
      return;
    }
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); annulla(); return; }
    if (modoForme && e.key === 'Enter' && strumento === 'nuovo') { chiudiNuovo(); return; }
    if (e.key === 'f') adatta();
  }
  const nomeVano = (v: VanoRiconosciuto) => v.testi.filter((t) => t.length > 1).join(', ') || (v.scala ? 'scala' : '—');
</script>

<svelte:window onkeydowncapture={tasti} />

{#if aperto}
  <div class="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Proposta dei vani dalla planimetria">
    <div class="flex w-full max-w-7xl flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xl">
      <header class="flex items-start justify-between gap-4 border-b border-line px-5 py-3">
        <div>
          <h2 class="text-base font-semibold">Vani dalla planimetria <span class="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">sperimentale</span></h2>
          <p class="mt-0.5 text-xs text-fg-muted">Proposta calcolata dal DXF (superfici fra i muri, senza sguinci e soglie): controlla ogni vano. Clic su un vano per cambiarne il tipo; «Modifica le forme» per correggere i contorni (vertici, dividere, unire, disegnare); i m² si correggono anche nella tabella. Dopo la conferma tutti i valori restano modificabili nel quadro C.</p>
        </div>
        <button type="button" class="btn btn-piccolo" onclick={() => (aperto = false)} title="Chiudi (Esc)"><Icona nome="x" /></button>
      </header>

      {#if stato === 'calcolo'}
        <div class="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-sm text-fg-muted">
          <span class="size-6 animate-spin rounded-full border-2 border-line border-t-accent-600"></span>
          Riconoscimento dei vani in corso (qualche secondo per foglio)…
        </div>
      {:else if stato === 'errore'}
        <div class="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-sm">
          <p class="flex items-start gap-2 text-red-700 dark:text-red-300"><Icona nome="errore" classe="mt-0.5 size-4 shrink-0" /> {errore}</p>
          <button type="button" class="btn btn-piccolo" onclick={() => calcola()}><Icona nome="ricarica" /> Riprova</button>
        </div>
      {:else}
        <div class="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
          <!-- disegno -->
          <div class="flex min-h-0 flex-col border-b border-line md:border-r md:border-b-0">
            <div class="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2">
              {#if risultati.length > 1}
                {#each risultati as _, s (s)}
                  <button type="button" class="btn btn-piccolo {scheda === s ? 'btn-primario' : ''}" onclick={() => { scheda = s; modifica = null; punti = []; }}>Scheda {s + 1}</button>
                {/each}
                <span class="mx-1 h-5 w-px bg-line"></span>
              {/if}
              <button type="button" class="btn btn-piccolo" title="Ingrandisci (anche con la rotella del mouse)" aria-label="Ingrandisci" onclick={() => zoomA(0.7)}><Icona nome="piu" /></button>
              <button type="button" class="btn btn-piccolo" title="Riduci" aria-label="Riduci" onclick={() => zoomA(1 / 0.7)}><span class="px-0.5 font-semibold">−</span></button>
              <button type="button" class="btn btn-piccolo" title="Tutto il disegno" aria-label="Tutto il disegno" onclick={adatta}><Icona nome="adatta" /></button>
              <span class="mx-1 h-5 w-px bg-line"></span>
              {#if !modoForme}
                <button type="button" class="btn btn-primario" onclick={apriForme}><Icona nome="modifica" /> Modifica le forme</button>
              {:else}
                <button type="button" class="btn btn-piccolo" onclick={annulla} disabled={!nStoria} title="Annulla l'ultima modifica (Ctrl+Z)"><Icona nome="annulla" /> Annulla</button>
                <button type="button" class="btn btn-primario" onclick={chiudiForme}><Icona nome="spunta" /> Fine modifiche</button>
              {/if}
            </div>
            {#if modoForme}
              <div class="space-y-2 border-b border-line bg-accent-50/60 px-3 py-2 dark:bg-accent-950/40">
                <div class="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Strumenti per la forma dei vani">
                  {#each STRUMENTI as x (x.s)}
                    <button type="button" class="btn btn-piccolo {strumento === x.s ? 'btn-primario' : ''}" onclick={() => scegliStrumento(x.s)}>{x.nome}</button>
                  {/each}
                  <span class="mx-1 h-5 w-px bg-line"></span>
                  <button type="button" class="btn btn-piccolo btn-pericolo" onclick={eliminaVano} disabled={!vanoInModifica}><Icona nome="cestino" /> Elimina vano</button>
                  <label class="ml-1 flex items-center gap-1 text-xs" title="I vertici si allineano a quelli vicini, parallelamente ai muri"><input type="checkbox" class="check" bind:checked={ortogonale} /> Ortogonale</label>
                </div>
                <p class="text-sm"><strong>{STRUMENTI.find((x) => x.s === strumento)?.nome}:</strong> {aiutoStrumento}</p>
                {#if strumento === 'nuovo' && punti.length}
                  <div class="flex gap-2">
                    <button type="button" class="btn btn-piccolo btn-primario" onclick={chiudiNuovo} disabled={punti.length < 3}><Icona nome="spunta" /> Chiudi il vano ({punti.length} vertici)</button>
                    <button type="button" class="btn btn-piccolo" onclick={() => (punti = [])}>Ricomincia</button>
                  </div>
                {/if}
                {#if strumento === 'dividi' && punti.length}<p class="text-xs text-fg-muted">Primo punto messo: ora clic sul bordo opposto. <button type="button" class="text-accent-700 underline dark:text-accent-300" onclick={() => (punti = [])}>Ricomincia</button></p>{/if}
                {#if msgForme}<p class="text-xs font-medium text-accent-800 dark:text-accent-200">{msgForme}</p>{/if}
              </div>
            {/if}
            {#if selezionato && vani[selezionato.s]?.find((x) => x.id === selezionato!.id)}
              {@const v = vani[selezionato.s].find((x) => x.id === selezionato!.id)!}
              <div class="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2 text-sm">
                <span class="mr-1 font-semibold">Vano {v.id}</span><span class="mr-2 text-fg-muted">{nomeVano(v) !== '—' ? `${nomeVano(v)} · ` : ''}{v.superficie.toLocaleString('it-IT', { minimumFractionDigits: 2 })} m²</span>
                {#each TIPI as t (t.tipo)}
                  <button type="button" class="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs {v.tipo === t.tipo ? 'border-fg font-semibold' : 'border-line hover:bg-surface-2'}" onclick={() => scegli(selezionato!.s, v.id, t.tipo)}><span class="size-3 rounded-sm" style={`background:${t.colore}`}></span>{t.breve}</button>
                {/each}
              </div>
            {/if}
            <div class="area-disegno relative min-h-[22rem] flex-1 overflow-hidden bg-white dark:bg-neutral-950" bind:clientWidth={largArea}>
              <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
              <svg bind:this={svgEl} class="h-full w-full touch-none select-none {modoForme && strumento !== 'sposta' ? 'cursor-crosshair' : spinta && trascinato ? 'cursor-grabbing' : ''}" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Planimetria con i vani colorati" onwheel={rotella} onpointerdown={giu} onpointermove={muovi} onpointerup={su} onpointercancel={su} onclick={clic} onpointerleave={() => { cursore = null; if (!trascinaV) agganciato = null; }}>
                {#each risultati[scheda]?.linee ?? [] as l, i (i)}
                  <line x1={l.a[0]} y1={-l.a[1]} x2={l.b[0]} y2={-l.b[1]} stroke="currentColor" class="text-neutral-500" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray={l.tratteggiata ? '5 3' : undefined} />
                {/each}
                {#each vani[scheda] ?? [] as v (v.id)}
                  {@const sel = (selezionato?.s === scheda && selezionato.id === v.id) || evidenziato === v.id}
                  <path data-vano={v.id} d={percorso(v.contorni)} fill={colore(v.tipo)} fill-opacity={v.tipo === 'escluso' ? 0.12 : sel ? 0.6 : 0.38} stroke={colore(v.tipo)} stroke-width={sel ? 3 : 1.2} vector-effect="non-scaling-stroke" stroke-dasharray={verificare(v) ? '6 4' : undefined} class="cursor-pointer" aria-label={`Vano ${v.id}`} onmouseenter={() => (evidenziato = v.id)} onmouseleave={() => (evidenziato = null)} />
                {/each}
                {#if modoForme && vanoInModifica && modifica?.s === scheda}
                  {#each vanoInModifica.contorni as c, r (r)}
                    {#each c as q, k (k)}
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <rect x={q[0] - upp * 6} y={-q[1] - upp * 6} width={upp * 12} height={upp * 12} fill={strumento === 'togli' ? '#fee2e2' : vSel?.r === r && vSel.k === k ? '#2563eb' : '#fff'} stroke={strumento === 'togli' ? '#dc2626' : '#2563eb'} stroke-width="1.5" vector-effect="non-scaling-stroke" class={strumento === 'togli' ? 'cursor-pointer' : 'cursor-move'} onpointerdown={(e) => giuVertice(e, r, k)} />
                    {/each}
                  {/each}
                {/if}
                {#if modoForme && punti.length}
                  <polyline points={[...punti, ...(cursore ? [cursore] : [])].map(([x, y]) => `${x},${-y}`).join(' ')} fill={strumento === 'nuovo' ? '#2563eb' : 'none'} fill-opacity="0.12" stroke="#2563eb" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" />
                  {#each punti as q, k (k)}<circle cx={q[0]} cy={-q[1]} r={upp * 5} fill="#2563eb" />{/each}
                {/if}
                {#if modoForme && agganciato}
                  {@const a = agganciato}
                  <g class="pointer-events-none" stroke="#ea580c" stroke-width="2" fill="none">
                    {#if a.tipo === 'spigolo'}<rect x={a.p[0] - upp * 7} y={-a.p[1] - upp * 7} width={upp * 14} height={upp * 14} vector-effect="non-scaling-stroke" />
                    {:else if a.tipo === 'incrocio'}<path d={`M${a.p[0] - upp * 7},${-a.p[1] - upp * 7}L${a.p[0] + upp * 7},${-a.p[1] + upp * 7}M${a.p[0] - upp * 7},${-a.p[1] + upp * 7}L${a.p[0] + upp * 7},${-a.p[1] - upp * 7}`} vector-effect="non-scaling-stroke" />
                    {:else}<circle cx={a.p[0]} cy={-a.p[1]} r={upp * 6} vector-effect="non-scaling-stroke" />{/if}
                    <text x={a.p[0] + upp * 10} y={-a.p[1] - upp * 10} font-size={upp * 12} fill="#ea580c" stroke="none">{NOME_AGGANCIO[a.tipo]}</text>
                  </g>
                {/if}
                {#each vani[scheda] ?? [] as v (v.id)}
                  <text x={v.centro[0]} y={-v.centro[1]} font-size={upp * 15} text-anchor="middle" class="pointer-events-none fill-neutral-900 dark:fill-neutral-100" font-weight="600">{v.id}</text>
                  <text x={v.centro[0]} y={-v.centro[1] + upp * 16} font-size={upp * 13} text-anchor="middle" class="pointer-events-none fill-neutral-700 dark:fill-neutral-300">{v.tipo === 'escluso' ? 'escluso' : `${v.m2} m²`}</text>
                {/each}
              </svg>
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-xs text-fg-muted">
              {#each TIPI as t (t.tipo)}<span class="flex items-center gap-1.5"><span class="size-3 rounded-sm" style={`background:${t.colore}`}></span>{t.breve}</span>{/each}
              <span>contorno tratteggiato = da verificare</span>
              <span>· rotella del mouse: zoom · trascina: sposta la vista</span>
            </div>
          </div>

          <!-- elenco e totali -->
          <div class="flex min-h-0 flex-col">
            {#if sconosciute.length || msgParole}
              <section class="border-b border-line bg-amber-50/60 px-3 py-2 dark:bg-amber-950/20">
                {#if sconosciute.length}
                  <h3 class="text-xs font-semibold">Parole che il programma non conosce</h3>
                  <p class="mb-1.5 text-xs text-fg-muted">Scegli che cosa significano: lo ricordo per tutte le pratiche.</p>
                  <ul class="space-y-1.5">
                    {#each sconosciute as p (p.testo)}
                      <li class="flex flex-wrap items-center gap-1.5 text-xs">
                        <span class="min-w-24 font-semibold">«{p.testo}»</span><span class="text-fg-muted">vano {p.vani.join(', ')}</span>
                        {#each TIPI as t (t.tipo)}
                          <button type="button" class="btn btn-piccolo" onclick={() => insegna(p.testo, t.tipo)}><span class="size-2.5 rounded-sm" style={`background:${t.colore}`}></span>{t.breve}</button>
                        {/each}
                        <button type="button" class="btn btn-piccolo" onclick={() => insegna(p.testo, 'ignora')}>Non è un nome</button>
                      </li>
                    {/each}
                  </ul>
                {/if}
                {#if msgParole}<p class="mt-1 text-xs text-accent-700 dark:text-accent-300">{msgParole}</p>{/if}
              </section>
            {/if}
            <div class="min-h-0 flex-1 overflow-y-auto">
              <table class="w-full text-sm">
                <thead class="sticky top-0 bg-surface text-left text-xs text-fg-muted">
                  <tr><th class="px-3 py-2">N.</th><th class="py-2">Vano</th><th class="py-2">Tipo</th><th class="py-2 pr-3 text-right">m²</th></tr>
                </thead>
                <tbody>
                  {#each vani[scheda] ?? [] as v (v.id)}
                    <tr class="border-t border-line {evidenziato === v.id ? 'bg-surface-2' : ''}" onmouseenter={() => (evidenziato = v.id)} onmouseleave={() => (evidenziato = null)}>
                      <td class="px-3 py-1.5 align-top font-medium tabular-nums">{v.id}</td>
                      <td class="py-1.5 align-top">
                        <span class="block max-w-[8rem] truncate" title={v.testi.join(', ')}>{nomeVano(v)}</span>
                        <span class="block text-xs text-fg-faint tabular-nums">{v.superficie.toLocaleString('it-IT', { minimumFractionDigits: 2 })} m² esatti</span>
                        {#if v.nota}<span class="block text-xs text-amber-700 dark:text-amber-300">{v.nota}</span>{/if}
                        {#if v.forma}<span class="block text-xs text-accent-700 dark:text-accent-300">forma corretta a mano</span>{/if}
                        <button type="button" class="block text-xs text-accent-700 hover:underline dark:text-accent-300" onclick={() => iniziaModifica(scheda, v.id)}>mostra e modifica la forma</button>
                      </td>
                      <td class="py-1.5 align-top">
                        <select class="campo campo-piccolo w-32" value={v.tipo} onchange={(e) => scegli(scheda, v.id, e.currentTarget.value as TipoVano)}>
                          {#each TIPI as t (t.tipo)}<option value={t.tipo}>{t.breve}</option>{/each}
                        </select>
                        {#if v.tipo !== v.tipoProposto || v.m2 !== m2Intero(v.superficie) || v.forma}
                          <button type="button" class="mt-1 block text-xs text-accent-700 hover:underline dark:text-accent-300" onclick={() => ripristina(scheda, v.id)}>ripristina proposta</button>
                        {/if}
                      </td>
                      <td class="py-1.5 pr-3 text-right align-top">
                        <input type="text" inputmode="numeric" class="campo campo-piccolo w-16 text-right tabular-nums" value={v.m2} disabled={v.tipo === 'escluso'} onchange={(e) => cambiaM2(scheda, v.id, e.currentTarget.value)} />
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            <div class="border-t border-line bg-surface-2/50 px-4 py-3 text-sm">
              <dl class="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 tabular-nums">
                <dt>Vani principali</dt><dd class="text-right">{totali.principaliN}</dd><dd class="text-right">{totali.principaliSup} m²</dd>
                <dt>Bagni</dt><dd class="text-right">{totali.bagniN}</dd><dd class="text-right">{totali.bagniSup} m²</dd>
                <dt>Altri accessori diretti</dt><dd class="text-right">{totali.direttiN}</dd><dd class="text-right">{totali.direttiSup} m²</dd>
                <dt>Accessori indiretti</dt><dd class="text-right">{totali.indirettiN}</dd><dd class="text-right">{auto ? 'dai poligoni' : `${totali.indirettiSup} m²`}</dd>
              </dl>
              <p class="mt-2 text-xs text-fg-muted">
                {#if altezze}Altezza media utile <strong class="text-fg">{altezze.altezzaMediaCm} cm</strong>, superficie con h &lt; 2,30 m <strong class="text-fg">{altezze.supInferiore230} m²</strong> (dai testi «h…»{altezze.senzaAltezza ? `; ${altezze.senzaAltezza} vani senza altezza scritta non contano` : ''}).
                {:else}Nessuna altezza scritta nel disegno (testi come «h270»): altezza media da inserire a mano.{/if}
              </p>
              <p class="mt-1 text-xs text-fg-muted">Consistenza indicativa (gruppo A): <strong class="text-fg">{consistenza.toLocaleString('it-IT')} vani</strong> — principali + accessori diretti ⅓ + indiretti ¼, al mezzo vano. Totali di tutte le schede; m² interi vano per vano.</p>
              {#if m.vaniPrincipaliN || m.vaniPrincipaliSup}
                <p class="mt-1 text-xs text-fg-muted">Ora nel quadro: principali {m.vaniPrincipaliN} / {m.vaniPrincipaliSup} m², bagni {m.bagniN} / {m.bagniSup} m², altri accessori {m.accessoriDirettiN} / {m.accessoriDirettiSup} m².</p>
              {/if}
              {#if daVerificare}<p class="mt-1 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300"><Icona nome="attenzione" classe="mt-0.5 size-3.5 shrink-0" /> {daVerificare} {daVerificare === 1 ? 'vano da verificare' : 'vani da verificare'} (contorno tratteggiato).</p>{/if}
              {#each risultati.flatMap((r) => r.avvisi) as a, i (i)}<p class="mt-1 text-xs text-fg-muted">{a}</p>{/each}
              <div class="mt-3 flex flex-wrap justify-end gap-2">
                <button type="button" class="btn btn-piccolo" onclick={() => calcola(true)}><Icona nome="ricarica" /> Ricalcola</button>
                <button type="button" class="btn btn-piccolo" onclick={() => (aperto = false)}>Chiudi senza inserire</button>
                <button type="button" class="btn btn-piccolo btn-primario" onclick={conferma}><Icona nome="spunta" /> Conferma e inserisci nel quadro C</button>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
