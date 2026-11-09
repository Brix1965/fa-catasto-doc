<script lang="ts">
  /**
   * Editor minimale del disegno di una scheda (planimetria): linee, testi, poligoni DOCFA_POLIGONI, tipo di linea
   * e spessore dei muri; aggancio a estremi/punti medi/linee, ortogonale (Maiusc), misura, annulla/ripeti.
   * Gli automatismi (sperimentali) propongono i poligoni dai vani e lo spessore dei muri sezionati: sono proposte
   * che il tecnico applica e poi corregge. «Salva» riscrive il DXF della scheda (R12) e i suoi poligoni; il DXF di
   * prima resta conservato e si può ripristinare.
   */
  import type { Planimetria, Poligono, SchedaGrafica, TipoAmbientePoligono } from '$lib/core/model';
  import type { Entita, LayerDxf, Punto2 } from '$lib/core/raster/dxf';
  import { preparaDxf } from '$lib/core/raster/dxf-correzioni';
  import { dxfPerFile, scriviDxf } from '$lib/core/raster/dxf-scrivi';
  import { haAltezza } from '$lib/core/superfici';
  import { aggancia, area, dentro, dist, distanzaEntita, distSegmento, limiti, puntiAggancio, puntiArco, segmentiEntita, type Aggancio } from '$lib/core/disegno/geometria';
  import { analizzaDisegnoInBackground } from '$lib/core/vani/esegui';
  import { spessoreMuroPerScala } from '$lib/core/vani/poligoni';
  import type { RisultatoDisegno } from '$lib/core/vani/worker';
  import { conferma, scegliDestinazione, scriviFile } from '$lib/piattaforma';
  import Icona from './Icona.svelte';
  import { untrack } from 'svelte';

  let { scheda, aperto = $bindable(), titolo = 'Disegno', onsalva }: { scheda: Planimetria | SchedaGrafica; aperto: boolean; titolo?: string; onsalva: (dxf: string, poligoni: Poligono[]) => void } = $props();

  type Strumento = 'seleziona' | 'linea' | 'poligono' | 'testo' | 'misura';
  type Selezione = { k: 'entita'; i: number } | { k: 'poligono'; i: number; v: number | null } | null;

  const COLORE_TIPO: Record<TipoAmbientePoligono, string> = { A: '#e11d48', B: '#ca8a04', C: '#16a34a', D: '#0891b2', E: '#2563eb', F: '#c026d3', G: '#475569', H: '#78716c' };
  const NOMI_TIPO: Record<TipoAmbientePoligono, string> = { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', H: 'A2' };
  const COLORE_VANO: Record<string, string> = { principale: '#e11d48', bagno: '#2563eb', diretto: '#f59e0b', verificare: '#f59e0b', indiretto: '#16a34a', escluso: '#9ca3af' };
  const CONTINUE = new Set(['', 'CONTINUOUS', 'CONTINUA', 'BYLAYER', 'BYBLOCK']);
  const tratteggiata = (e: Entita) => !CONTINUE.has((e.tipoLinea ?? '').toUpperCase());

  // ---- dati del disegno
  let entita = $state<Entita[]>([]);
  let poligoni = $state<Poligono[]>([]);
  let riquadro = $state.raw<Punto2[] | null>(null);
  let layers = $state.raw<Record<string, LayerDxf>>({});
  let errore = $state('');
  let modificato = $state(false);
  let storia: string[] = [];
  let futuro: string[] = [];

  // ---- interazione
  let strumento = $state<Strumento>('seleziona');
  let sel = $state<Selezione>(null);
  let punti = $state<Punto2[]>([]); // punti del tratto in corso (linea, poligono, misura)
  let cursore = $state<Punto2 | null>(null);
  let agg = $state<Aggancio | null>(null);
  let ortogonale = $state(false);
  let agganciAttivi = $state(true);
  let nuovaTratteggiata = $state(false);
  let nuovaMuro = $state(false);
  let nuovoTipo = $state<TipoAmbientePoligono>('A');
  let mostraPoligoni = $state(true);
  let mostraVani = $state(true);

  // ---- vista: centro (coordinate DXF) e zoom (px per metro)
  let cx = $state(0), cy = $state(0), zoom = $state(10);
  let largh = $state(800), alt = $state(600);
  let svgEl = $state<SVGSVGElement | null>(null);
  const vb = $derived({ x: cx - largh / 2 / zoom, y: -cy - alt / 2 / zoom, w: largh / zoom, h: alt / zoom });
  const px = (n: number) => n / zoom; // n pixel in unità del disegno

  // ---- automatismi
  let analisi = $state.raw<RisultatoDisegno | null>(null);
  let calcolo = $state(false);
  let usaPoligoni = $state(true);
  let msg = $state('');

  const spessoreMuro = $derived(spessoreMuroPerScala(scheda.scala));
  const indiceAggancio = $derived(puntiAggancio(entita, poligoni));

  function carica(): void {
    errore = ''; msg = ''; analisi = null; sel = null; punti = []; storia = []; futuro = []; modificato = false; strumento = 'seleziona'; trascina = null; versione++;
    try {
      const p = preparaDxf(scheda.dxf ?? '');
      entita = p.letto.entita;
      poligoni = $state.snapshot(scheda.poligoni ?? []) as Poligono[];
      if (!poligoni.length && !scheda.poligoniLetti) poligoni = p.letto.poligoni;
      riquadro = p.letto.riquadro;
      layers = p.letto.layers;
      usaPoligoni = poligoni.length > 0;
      adatta();
    } catch (e) {
      errore = `DXF non leggibile: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  $effect(() => { if (aperto) untrack(carica); });

  function adatta(): void {
    const l = limiti(entita, poligoni, riquadro);
    cx = (l.x0 + l.x1) / 2; cy = (l.y0 + l.y1) / 2;
    zoom = Math.max(0.5, Math.min((largh - 40) / Math.max(1, l.x1 - l.x0), (alt - 40) / Math.max(1, l.y1 - l.y0)));
  }

  // ---- annulla / ripeti
  const istantanea = () => JSON.stringify({ entita: $state.snapshot(entita), poligoni: $state.snapshot(poligoni) });
  /**
   * Cresce quando si aggiungono o tolgono linee e testi (o con annulla/ripeti): gli indici delle linee calcolati
   * dall'analisi non valgono più e «Spessore ai muri» ingrosserebbe le linee sbagliate.
   */
  let versione = $state(0);
  let versioneAnalisi = $state(-1);
  function memorizza(cambiaIndici = false): void {
    storia.push(istantanea());
    if (storia.length > 100) storia.shift();
    futuro = [];
    modificato = true;
    if (cambiaIndici) versione++;
  }
  function ripristinaDa(s: string): void {
    const d = JSON.parse(s);
    entita = d.entita; poligoni = d.poligoni; sel = null;
  }
  function annulla(): void { if (trascina) return; const s = storia.pop(); if (s) { futuro.push(istantanea()); ripristinaDa(s); versione++; } }
  function ripeti(): void { if (trascina) return; const s = futuro.pop(); if (s) { storia.push(istantanea()); ripristinaDa(s); versione++; } }
  /** l'analisi vale ancora per il disegno attuale */
  const analisiValida = $derived(!!analisi && versioneAnalisi === versione);

  // ---- coordinate
  function aDxf(e: MouseEvent | PointerEvent | WheelEvent): Punto2 {
    const r = svgEl!.getBoundingClientRect();
    return [vb.x + (e.clientX - r.left) / zoom, -(vb.y + (e.clientY - r.top) / zoom)];
  }
  function puntoAgganciato(e: MouseEvent): Punto2 {
    const p = aDxf(e);
    const da = punti.length ? punti[punti.length - 1] : trascina?.origine ?? null;
    const a = agganciAttivi || ortogonale || e.shiftKey ? aggancia(p, agganciAttivi ? indiceAggancio : [], agganciAttivi ? entita : [], px(10), { da, ortogonale: ortogonale || e.shiftKey, escludi: trascina?.punto ?? null }) : null;
    agg = a;
    return a ? [a.p[0], a.p[1]] : p;
  }

  // ---- trascinamento: vista (pan) o vertice
  type Trascina = { tipo: 'vista'; x: number; y: number; cx: number; cy: number; origine?: undefined; punto?: undefined }
    | { tipo: 'vertice'; poligono?: number; entita?: number; v: number; origine: Punto2; punto: Punto2; mosso: boolean };
  let trascina = $state.raw<Trascina | null>(null);
  function giu(e: PointerEvent): void {
    if (e.button === 1 || (e.button === 0 && strumento === 'seleziona' && !maniglia(e))) {
      if (e.button === 0) seleziona(aDxf(e));
      trascina = { tipo: 'vista', x: e.clientX, y: e.clientY, cx, cy };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
  }
  /** pressione su una maniglia (vertice dell'oggetto selezionato): inizia lo spostamento */
  function maniglia(e: PointerEvent): boolean {
    const p = aDxf(e);
    const t = px(7);
    if (sel?.k === 'poligono') {
      const v = poligoni[sel.i]?.vertici ?? [];
      const k = v.findIndex((q) => dist(q, p) < t);
      if (k >= 0) {
        sel = { k: 'poligono', i: sel.i, v: k };
        trascina = { tipo: 'vertice', poligono: sel.i, v: k, origine: v[k], punto: v[k], mosso: false };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        return true;
      }
    } else if (sel?.k === 'entita') {
      const en = entita[sel.i];
      const vs: Punto2[] = en?.tipo === 'linea' ? [en.p1, en.p2] : en?.tipo === 'polilinea' ? en.punti : en?.tipo === 'testo' ? [en.punto] : [];
      const k = vs.findIndex((q) => dist(q, p) < t);
      if (k >= 0) {
        trascina = { tipo: 'vertice', entita: sel.i, v: k, origine: vs[k], punto: vs[k], mosso: false };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        return true;
      }
    }
    return false;
  }
  function muovi(e: PointerEvent): void {
    if (trascina?.tipo === 'vista') {
      cx = trascina.cx - (e.clientX - trascina.x) / zoom;
      cy = trascina.cy + (e.clientY - trascina.y) / zoom;
      return;
    }
    const p = puntoAgganciato(e);
    cursore = p;
    if (trascina?.tipo === 'vertice') {
      // l'istantanea per Annulla si prende alla prima mossa: un semplice clic sulla maniglia non conta come modifica
      if (!trascina.mosso) memorizza();
      trascina.mosso = true;
      trascina.punto = p;
      if (trascina.poligono !== undefined) poligoni[trascina.poligono].vertici[trascina.v] = p;
      else if (trascina.entita !== undefined) {
        const en = entita[trascina.entita];
        if (en.tipo === 'linea') { if (trascina.v === 0) en.p1 = p; else en.p2 = p; }
        else if (en.tipo === 'polilinea') en.punti[trascina.v] = p;
        else if (en.tipo === 'testo') en.punto = p;
      }
    }
  }
  function su(): void {
    trascina = null;
  }
  function rotella(e: WheelEvent): void {
    e.preventDefault();
    const p = aDxf(e);
    const f = Math.exp(-e.deltaY * 0.0015);
    const z = Math.max(0.2, Math.min(2000, zoom * f));
    // il punto sotto il cursore resta fermo
    cx = p[0] - (p[0] - cx) * (zoom / z);
    cy = p[1] - (p[1] - cy) * (zoom / z);
    zoom = z;
  }

  // ---- selezione
  function seleziona(p: Punto2): void {
    const t = px(6);
    let best = -1, d = t;
    entita.forEach((e, i) => { const x = distanzaEntita(e, p); if (x < d) { d = x; best = i; } });
    if (best >= 0) { sel = { k: 'entita', i: best }; return; }
    if (mostraPoligoni) {
      // prima il bordo, poi il più piccolo che contiene il punto
      let pb = -1; d = t;
      poligoni.forEach((pg, i) => { for (let k = 0; k < pg.vertici.length; k++) { const a = pg.vertici[k], b = pg.vertici[(k + 1) % pg.vertici.length]; const x = segDist(p, a, b); if (x < d) { d = x; pb = i; } } });
      if (pb < 0) {
        let am = Infinity;
        poligoni.forEach((pg, i) => { if (dentro(p, pg.vertici)) { const a = area(pg.vertici); if (a < am) { am = a; pb = i; } } });
      }
      if (pb >= 0) { sel = { k: 'poligono', i: pb, v: null }; return; }
    }
    sel = null;
  }
  const segDist = distSegmento;

  // ---- strumenti di disegno
  function clic(e: MouseEvent): void {
    if (strumento === 'seleziona') return;
    const p = puntoAgganciato(e);
    if (strumento === 'linea') {
      if (punti.length) {
        const a = punti[punti.length - 1];
        if (dist(a, p) > 1e-6) {
          memorizza();
          entita.push({ tipo: 'linea', layer: '0', colore: 7, spessore: nuovaMuro ? spessoreMuro : 0, tipoLinea: nuovaTratteggiata ? 'TRATTEGGIO' : 'CONTINUOUS', p1: a, p2: p });
        }
      }
      punti = [...punti, p];
    } else if (strumento === 'poligono') {
      if (punti.length >= 3 && dist(p, punti[0]) < px(8)) { chiudiPoligono(); return; }
      punti = [...punti, p];
    } else if (strumento === 'misura') {
      punti = punti.length >= 2 ? [p] : [...punti, p];
    } else if (strumento === 'testo') {
      memorizza();
      entita.push({ tipo: 'testo', layer: '0', colore: 7, spessore: 0, testo: 'testo', punto: p, altezza: Math.round(0.45 * (scheda.scala / 200) * 100) / 100, rotazione: 0, allineamentoH: 'centro', allineamentoV: 'medio', larghezza: 1 });
      sel = { k: 'entita', i: entita.length - 1 };
      strumento = 'seleziona';
      setTimeout(() => (document.getElementById('testo-sel') as HTMLInputElement | null)?.select(), 30);
    }
  }
  function doppioClic(e: MouseEvent): void {
    if (strumento === 'linea') { punti = []; return; }
    if (strumento === 'poligono') { chiudiPoligono(); return; }
    // doppio clic sul bordo del poligono selezionato: aggiunge un vertice
    if (strumento === 'seleziona' && sel?.k === 'poligono') {
      const p = aDxf(e);
      const v = poligoni[sel.i].vertici;
      for (let k = 0; k < v.length; k++) {
        const a = v[k], b = v[(k + 1) % v.length];
        if (segDist(p, a, b) < px(6)) { memorizza(); v.splice(k + 1, 0, puntoAgganciato(e)); sel = { k: 'poligono', i: sel.i, v: k + 1 }; return; }
      }
    }
  }
  function chiudiPoligono(): void {
    // il doppio clic aggiunge due volte l'ultimo punto
    const v = punti.filter((p, i) => i === 0 || dist(p, punti[i - 1]) > 1e-6);
    while (v.length > 1 && dist(v[0], v[v.length - 1]) < 1e-6) v.pop();
    // almeno 3 vertici distinti e un'area: [a, b, a] non è un poligono
    if (v.length >= 3 && area(v) > 1e-4) {
      memorizza();
      poligoni.push({ tipo: nuovoTipo, vertici: v, altezzaValida: true });
      sel = { k: 'poligono', i: poligoni.length - 1, v: null };
      mostraPoligoni = true;
    }
    punti = [];
  }
  function scegliStrumento(s: Strumento): void { strumento = s; punti = []; if (s !== 'seleziona') sel = null; }

  function elimina(): void {
    if (!sel || trascina) return;
    // togliere una linea sposta gli indici di quelle dopo (aggiungerne in fondo no)
    memorizza(sel.k === 'entita');
    if (sel.k === 'entita') entita.splice(sel.i, 1);
    else if (sel.v !== null && poligoni[sel.i].vertici.length > 3) { poligoni[sel.i].vertici.splice(sel.v, 1); sel = { ...sel, v: null }; return; }
    else poligoni.splice(sel.i, 1);
    sel = null;
  }

  // ---- proprietà dell'oggetto selezionato
  const entSel = $derived(sel?.k === 'entita' ? entita[sel.i] : undefined);
  const polSel = $derived(sel?.k === 'poligono' ? poligoni[sel.i] : undefined);
  function lunghezza(e: Entita): number { return segmentiEntita(e).reduce((s, [a, b]) => s + dist(a, b), 0); }
  function cambiaEnt(f: (e: Entita) => void): void { if (entSel) { memorizza(); f(entSel); } }

  // ---- automatismi
  async function analizza(): Promise<void> {
    calcolo = true; msg = ''; analisi = null;
    const v = versione;
    try {
      const r = await analizzaDisegnoInBackground({ entita: $state.snapshot(entita) as Entita[], poligoni: $state.snapshot(poligoni) as Poligono[], usaPoligoni: usaPoligoni && poligoni.length > 0, riquadro });
      if (!aperto) return;
      analisi = r;
      versioneAnalisi = v;
      mostraVani = true;
      msg = `${analisi.vani.vani.filter((v) => v.tipo !== 'escluso').length} vani riconosciuti, ${analisi.generati.poligoni.length} poligoni proposti, ${analisi.muri.length} linee di muro sezionato.`;
    } catch (e) {
      msg = `Calcolo non riuscito: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      calcolo = false;
    }
  }
  async function applicaPoligoni(): Promise<void> {
    if (!analisi || !analisiValida) return;
    if (poligoni.length && !(await conferma(`I ${poligoni.length} poligoni attuali verranno sostituiti dai ${analisi.generati.poligoni.length} proposti. Continuare?`))) return;
    memorizza();
    poligoni = analisi.generati.poligoni.map((p) => ({ ...p, vertici: p.vertici.map((v) => [v[0], v[1]] as Punto2) }));
    mostraPoligoni = true;
    sel = null;
  }
  function applicaSpessori(): void {
    // indici calcolati sul disegno di prima: dopo una modifica si ingrosserebbero le linee sbagliate
    if (!analisi || !analisiValida) return;
    memorizza();
    const muri = new Set(analisi.muri);
    // si ingrossano le linee proposte; gli spessori già messi restano (per toglierli: «Togli tutti gli spessori»)
    entita.forEach((e, i) => {
      if ((e.tipo === 'linea' || e.tipo === 'polilinea') && muri.has(i)) e.spessore = spessoreMuro;
    });
  }
  function togliSpessori(): void { memorizza(); for (const e of entita) if (e.tipo === 'linea' || e.tipo === 'polilinea') e.spessore = 0; }

  // ---- salvataggio
  function dxfAttuale(): string {
    const ly: Record<string, { colore?: number; tipoLinea?: string; spento?: boolean }> = {};
    for (const [k, l] of Object.entries(layers)) if (k !== 'DOCFA_POLIGONI' && k !== 'RIQUADRO') ly[k] = { colore: l.colore, tipoLinea: l.tipoLinea };
    return scriviDxf({ entita: $state.snapshot(entita) as Entita[], poligoni: $state.snapshot(poligoni) as Poligono[], riquadro, layers: ly });
  }
  function salva(): void {
    onsalva(dxfAttuale(), $state.snapshot(poligoni) as Poligono[]);
    modificato = false;
    aperto = false;
  }
  async function esporta(): Promise<void> {
    try {
      const percorso = await scegliDestinazione('Salva il DXF', 'planimetria.dxf', [{ nome: 'Disegni DXF', estensioni: ['dxf'] }]);
      if (percorso) { await scriviFile(percorso, dxfPerFile(dxfAttuale())); msg = 'DXF salvato.'; }
    } catch (e) {
      msg = `DXF non salvato: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  async function chiudi(): Promise<void> {
    if (modificato && !(await conferma('Chiudere senza salvare le modifiche al disegno?'))) return;
    aperto = false;
  }

  function tasti(e: KeyboardEvent): void {
    if (!aperto) return;
    const t = e.target as HTMLElement;
    const inCampo = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (punti.length) { if (strumento === 'poligono' && punti.length >= 3) chiudiPoligono(); else punti = []; }
      else if (strumento !== 'seleziona') strumento = 'seleziona';
      else if (sel) sel = null;
      else void chiudi();
      return;
    }
    if (inCampo) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) ripeti(); else annulla(); return; }
    if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); e.stopPropagation(); ripeti(); return; }
    if (ctrl) return;
    if (trascina) return; // niente scorciatoie durante uno spostamento (l'oggetto trascinato sparirebbe)
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); elimina(); return; }
    if (e.key === 'Enter' && strumento === 'poligono') { chiudiPoligono(); return; }
    const k = e.key.toLowerCase();
    if (k === 's') scegliStrumento('seleziona');
    else if (k === 'l') scegliStrumento('linea');
    else if (k === 'p') scegliStrumento('poligono');
    else if (k === 't') scegliStrumento('testo');
    else if (k === 'm') scegliStrumento('misura');
    else if (k === 'f') adatta();
    else if (k === 'o') ortogonale = !ortogonale;
  }

  // ---- disegno SVG
  const Y = (y: number) => -y;
  const pts = (v: Punto2[]) => v.map(([x, y]) => `${x},${-y}`).join(' ');
  function percorsoArco(e: Extract<Entita, { tipo: 'arco' }>): string {
    const p = puntiArco(e.centro, e.raggio, e.inizio, e.fine, 32);
    return 'M' + p.map(([x, y]) => `${x},${-y}`).join('L');
  }
  const ancoraH = { sinistra: 'start', centro: 'middle', destra: 'end' } as const;
  const baseV = { base: 'alphabetic', basso: 'text-after-edge', medio: 'central', alto: 'hanging' } as const;
  const misura = $derived(strumento === 'misura' && punti.length ? (punti.length === 2 ? dist(punti[0], punti[1]) : cursore ? dist(punti[0], cursore) : 0) : null);
  const vaniAnalisi = $derived(analisi?.vani.vani ?? []);
  const NOME_AGG: Record<string, string> = { estremo: 'estremo', medio: 'punto medio', centro: 'centro', vertice: 'vertice', linea: 'sulla linea', ortogonale: 'ortogonale' };
  const fmt = (n: number, d = 2) => n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
</script>

<svelte:window onkeydowncapture={tasti} />

{#if aperto}
  <div class="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Editor del disegno">
    <div class="flex w-full flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xl">
      <header class="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <h2 class="mr-2 text-sm font-semibold">{titolo} <span class="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">sperimentale</span></h2>
        <div class="flex items-center gap-1" role="toolbar" aria-label="Strumenti">
          {#each [['seleziona', 'cursore', 'Seleziona e sposta (S)'], ['linea', 'linea', 'Linea (L): clic, clic… doppio clic o Esc per finire'], ['poligono', 'poligono', 'Poligono (P): clic sui vertici, clic sul primo o Invio per chiudere'], ['testo', 'testo', 'Testo (T): clic dove scriverlo'], ['misura', 'righello', 'Misura (M)']] as [s, ic, tit] (s)}
            <button type="button" class="btn btn-piccolo {strumento === s ? 'btn-primario' : ''}" title={tit} aria-label={tit} onclick={() => scegliStrumento(s as Strumento)}><Icona nome={ic as 'cursore'} /></button>
          {/each}
        </div>
        <span class="mx-1 h-5 w-px bg-line"></span>
        <button type="button" class="btn btn-piccolo" title="Annulla (Ctrl+Z)" aria-label="Annulla" onclick={annulla}><Icona nome="annulla" /></button>
        <button type="button" class="btn btn-piccolo" title="Ripeti (Ctrl+Y)" aria-label="Ripeti" onclick={ripeti}><Icona nome="ripeti" /></button>
        <button type="button" class="btn btn-piccolo" title="Adatta alla finestra (F)" aria-label="Adatta" onclick={adatta}><Icona nome="adatta" /></button>
        <label class="ml-1 flex items-center gap-1 text-xs"><input type="checkbox" class="check" bind:checked={agganciAttivi} /> Aggancio</label>
        <label class="flex items-center gap-1 text-xs" title="Anche tenendo premuto Maiusc"><input type="checkbox" class="check" bind:checked={ortogonale} /> Ortogonale (O)</label>
        <label class="flex items-center gap-1 text-xs"><input type="checkbox" class="check" bind:checked={mostraPoligoni} /> Poligoni</label>
        {#if analisi}<label class="flex items-center gap-1 text-xs"><input type="checkbox" class="check" bind:checked={mostraVani} /> Vani</label>{/if}
        <span class="ml-auto flex gap-2">
          <button type="button" class="btn btn-piccolo" onclick={esporta} title="Salva una copia del disegno come file DXF (R12) da aprire nel CAD"><Icona nome="esporta" /> Esporta DXF</button>
          <button type="button" class="btn btn-piccolo" onclick={chiudi}>Chiudi</button>
          <button type="button" class="btn btn-piccolo btn-primario" onclick={salva} disabled={!!errore}><Icona nome="salva" /> Salva nella scheda</button>
        </span>
      </header>

      <div class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div class="relative min-h-[24rem] overflow-hidden bg-white dark:bg-neutral-950" bind:clientWidth={largh} bind:clientHeight={alt}>
          {#if errore}
            <p class="p-6 text-sm text-red-700 dark:text-red-300">{errore}</p>
          {:else}
            <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
            <svg bind:this={svgEl} class="absolute inset-0 h-full w-full select-none {strumento === 'seleziona' ? (trascina?.tipo === 'vista' ? 'cursor-grabbing' : 'cursor-default') : 'cursor-crosshair'}" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
              onpointerdown={giu} onpointermove={muovi} onpointerup={su} onpointerleave={() => { cursore = null; agg = null; }} onwheel={rotella} onclick={clic} ondblclick={doppioClic} oncontextmenu={(e) => { e.preventDefault(); if (punti.length) { if (strumento === 'poligono') chiudiPoligono(); else punti = []; } }}>
              {#if riquadro}<polygon points={pts(riquadro)} fill="none" stroke="#94a3b8" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="4 3" />{/if}
              {#if mostraVani}
                {#each vaniAnalisi as v (v.id)}
                  {#each v.contorni as c, k (k)}<polygon points={pts(c)} fill={COLORE_VANO[v.tipo]} fill-opacity={v.tipo === 'escluso' ? 0.08 : 0.22} stroke="none" />{/each}
                {/each}
              {/if}
              {#if mostraPoligoni}
                {#each poligoni as p, i (i)}
                  <polygon points={pts(p.vertici)} fill={COLORE_TIPO[p.tipo]} fill-opacity={sel?.k === 'poligono' && sel.i === i ? 0.3 : 0.12} stroke={COLORE_TIPO[p.tipo]} stroke-width={sel?.k === 'poligono' && sel.i === i ? 2.5 : 1.5} vector-effect="non-scaling-stroke" />
                {/each}
              {/if}
              {#each entita as e, i (i)}
                {@const s = sel?.k === 'entita' && sel.i === i}
                {@const colore = s ? '#2563eb' : 'currentColor'}
                {@const w = (e.spessore > 0 ? 2.6 : 1) + (s ? 1 : 0)}
                {@const da = tratteggiata(e) ? '6 4' : undefined}
                {#if e.tipo === 'linea'}
                  <line x1={e.p1[0]} y1={Y(e.p1[1])} x2={e.p2[0]} y2={Y(e.p2[1])} stroke={colore} stroke-width={w} stroke-dasharray={da} vector-effect="non-scaling-stroke" class="text-neutral-800 dark:text-neutral-200" />
                {:else if e.tipo === 'polilinea'}
                  {#if e.chiusa}<polygon points={pts(e.punti)} fill="none" stroke={colore} stroke-width={w} stroke-dasharray={da} vector-effect="non-scaling-stroke" class="text-neutral-800 dark:text-neutral-200" />
                  {:else}<polyline points={pts(e.punti)} fill="none" stroke={colore} stroke-width={w} stroke-dasharray={da} vector-effect="non-scaling-stroke" class="text-neutral-800 dark:text-neutral-200" />{/if}
                {:else if e.tipo === 'arco'}
                  <path d={percorsoArco(e)} fill="none" stroke={colore} stroke-width={w} stroke-dasharray={da} vector-effect="non-scaling-stroke" class="text-neutral-800 dark:text-neutral-200" />
                {:else if e.tipo === 'cerchio'}
                  <circle cx={e.centro[0]} cy={Y(e.centro[1])} r={e.raggio} fill="none" stroke={colore} stroke-width={w} vector-effect="non-scaling-stroke" class="text-neutral-800 dark:text-neutral-200" />
                {:else if e.tipo === 'testo'}
                  <text x={e.punto[0]} y={Y(e.punto[1])} font-size={e.altezza * 1.4} text-anchor={ancoraH[e.allineamentoH]} dominant-baseline={baseV[e.allineamentoV]} transform={e.rotazione ? `rotate(${-e.rotazione} ${e.punto[0]} ${Y(e.punto[1])})` : undefined} fill={s ? '#2563eb' : 'currentColor'} class="text-neutral-800 dark:text-neutral-200" font-family="Arial, sans-serif">{e.testo}</text>
                {/if}
              {/each}
              <!-- maniglie dell'oggetto selezionato -->
              {#if polSel}
                {#each polSel.vertici as v, k (k)}<rect x={v[0] - px(4)} y={Y(v[1]) - px(4)} width={px(8)} height={px(8)} fill={sel?.k === 'poligono' && sel.v === k ? '#2563eb' : '#fff'} stroke="#2563eb" stroke-width="1.5" vector-effect="non-scaling-stroke" />{/each}
              {:else if entSel}
                {@const vs = entSel.tipo === 'linea' ? [entSel.p1, entSel.p2] : entSel.tipo === 'polilinea' ? entSel.punti : entSel.tipo === 'testo' ? [entSel.punto] : []}
                {#each vs as v, k (k)}<rect x={v[0] - px(4)} y={Y(v[1]) - px(4)} width={px(8)} height={px(8)} fill="#fff" stroke="#2563eb" stroke-width="1.5" vector-effect="non-scaling-stroke" />{/each}
              {/if}
              <!-- tratto in corso -->
              {#if punti.length && cursore}
                {#if strumento === 'poligono'}
                  <polyline points={pts([...punti, cursore])} fill={COLORE_TIPO[nuovoTipo]} fill-opacity="0.12" stroke={COLORE_TIPO[nuovoTipo]} stroke-width="1.5" vector-effect="non-scaling-stroke" />
                {:else}
                  <polyline points={pts([...punti.slice(-1), cursore])} fill="none" stroke="#2563eb" stroke-width="1.5" stroke-dasharray={strumento === 'misura' || nuovaTratteggiata ? '6 4' : undefined} vector-effect="non-scaling-stroke" />
                {/if}
              {/if}
              {#if strumento === 'misura' && punti.length === 2}<line x1={punti[0][0]} y1={Y(punti[0][1])} x2={punti[1][0]} y2={Y(punti[1][1])} stroke="#2563eb" stroke-width="1.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" />{/if}
              {#if agg && cursore}<rect x={agg.p[0] - px(5)} y={Y(agg.p[1]) - px(5)} width={px(10)} height={px(10)} fill="none" stroke="#16a34a" stroke-width="2" vector-effect="non-scaling-stroke" transform={agg.tipo === 'medio' ? `rotate(45 ${agg.p[0]} ${Y(agg.p[1])})` : undefined} />{/if}
            </svg>
            <div class="pointer-events-none absolute bottom-2 left-2 rounded bg-surface/90 px-2 py-1 text-[11px] tabular-nums text-fg-muted shadow-sm">
              {#if cursore}x {fmt(cursore[0])} · y {fmt(cursore[1])}{/if}{#if agg} · {NOME_AGG[agg.tipo]}{/if}{#if misura !== null} · <strong class="text-fg">distanza {fmt(misura)} m</strong>{/if}
              · rotella: zoom · trascina: sposta la vista
            </div>
          {/if}
        </div>

        <aside class="min-h-0 space-y-4 overflow-y-auto border-t border-line p-3 text-sm lg:border-t-0 lg:border-l">
          {#if strumento === 'linea'}
            <section class="space-y-1.5">
              <h3 class="text-xs font-semibold text-fg-muted">Nuove linee</h3>
              <label class="flex items-center gap-2"><input type="checkbox" class="check" bind:checked={nuovaTratteggiata} /> tratteggiata (porta, altezza diversa)</label>
              <label class="flex items-center gap-2"><input type="checkbox" class="check" bind:checked={nuovaMuro} /> muro sezionato (spessore {fmt(spessoreMuro, 3)})</label>
            </section>
          {:else if strumento === 'poligono'}
            <section class="space-y-1.5">
              <h3 class="text-xs font-semibold text-fg-muted">Nuovo poligono</h3>
              <label class="flex items-center gap-2">Tipo <select class="campo campo-piccolo w-20" bind:value={nuovoTipo}>{#each Object.entries(NOMI_TIPO) as [v, n] (v)}<option value={v}>{n}</option>{/each}</select></label>
              <p class="text-xs text-fg-muted">Clic sui vertici (con l'aggancio agli spigoli), poi clic sul primo vertice, doppio clic o Invio.</p>
            </section>
          {/if}

          {#if entSel}
            <section class="space-y-1.5">
              <h3 class="text-xs font-semibold text-fg-muted">{{ linea: 'Linea', polilinea: 'Polilinea', arco: 'Arco', cerchio: 'Cerchio', testo: 'Testo' }[entSel.tipo]} <span class="font-normal">· layer {entSel.layer}</span></h3>
              {#if entSel.tipo === 'testo'}
                <input id="testo-sel" type="text" class="campo" value={entSel.testo} onchange={(e) => { const v = e.currentTarget.value; cambiaEnt((x) => { if (x.tipo === 'testo') x.testo = v; }); }} />
                <label class="flex items-center gap-2 text-xs">Altezza <input type="number" step="0.05" min="0.05" class="campo campo-piccolo w-24" value={entSel.altezza} onchange={(e) => { const v = Number(e.currentTarget.value); if (v > 0) cambiaEnt((x) => { if (x.tipo === 'testo') x.altezza = v; }); }} /> m</label>
                <p class="text-xs text-fg-muted">Nomi riconosciuti: camera, soggiorno, cucina, bagno, wc, ingresso, corridoio, disimpegno, rip., cantina, soffitta… Altezze: h270.</p>
              {:else}
                <label class="flex items-center gap-2"><input type="checkbox" class="check" checked={tratteggiata(entSel)} onchange={(e) => { const v = e.currentTarget.checked; cambiaEnt((x) => (x.tipoLinea = v ? 'TRATTEGGIO' : 'CONTINUOUS')); }} /> tratteggiata</label>
                {#if entSel.tipo === 'linea' || entSel.tipo === 'polilinea'}
                  <label class="flex items-center gap-2"><input type="checkbox" class="check" checked={entSel.spessore > 0} onchange={(e) => { const v = e.currentTarget.checked; cambiaEnt((x) => (x.spessore = v ? spessoreMuro : 0)); }} /> muro sezionato (spessore)</label>
                {/if}
                <p class="text-xs text-fg-muted">Lunghezza {fmt(lunghezza(entSel))} m. Trascina i quadratini per spostare gli estremi.</p>
              {/if}
              <button type="button" class="btn btn-piccolo btn-pericolo" onclick={elimina}><Icona nome="cestino" /> Elimina (Canc)</button>
            </section>
          {:else if polSel && sel?.k === 'poligono'}
            <section class="space-y-1.5">
              <h3 class="text-xs font-semibold text-fg-muted">Poligono {sel.i + 1}</h3>
              <label class="flex items-center gap-2">Tipo <select class="campo campo-piccolo w-20" value={polSel.tipo} onchange={(e) => { const v = e.currentTarget.value as TipoAmbientePoligono; memorizza(); polSel.tipo = v; }}>{#each Object.entries(NOMI_TIPO) as [v, n] (v)}<option value={v}>{n}</option>{/each}</select></label>
              {#if haAltezza(polSel.tipo)}<label class="flex items-center gap-2"><input type="checkbox" class="check" checked={!polSel.altezzaValida} onchange={(e) => { const v = e.currentTarget.checked; memorizza(); polSel.altezzaValida = !v; }} /> altezza inferiore a 1,50 m</label>{/if}
              <p class="text-xs text-fg-muted">Superficie {fmt(area(polSel.vertici))} m², {polSel.vertici.length} vertici. Trascina un vertice per spostarlo; doppio clic sul bordo per aggiungerne uno.</p>
              <button type="button" class="btn btn-piccolo btn-pericolo" onclick={elimina}><Icona nome="cestino" /> {sel.v !== null && polSel.vertici.length > 3 ? 'Togli il vertice' : 'Elimina il poligono'} (Canc)</button>
            </section>
          {:else if strumento === 'seleziona'}
            <p class="text-xs text-fg-muted">Clic su una linea, un testo o un poligono per selezionarlo. Canc elimina, Ctrl+Z annulla.</p>
          {/if}

          <section class="space-y-2 rounded-md border border-dashed border-amber-400/70 p-2.5">
            <h3 class="flex items-center gap-1.5 text-xs font-semibold"><Icona nome="bacchetta" classe="size-3.5" /> Automatismi <span class="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">sperimentale</span></h3>
            <p class="text-xs text-fg-muted">Riconosce i vani dalle linee e dai nomi scritti, propone i poligoni per tipologia (A con i muri, B accessori indiretti, C locali staccati, D balconi e terrazze, F giardini e corti; le parti a comune mai) e le linee dei muri sezionati. Sono proposte: controllale e correggile.</p>
            {#if poligoni.length}<label class="flex items-center gap-2 text-xs"><input type="checkbox" class="check" bind:checked={usaPoligoni} /> cerca i vani solo dentro i poligoni attuali</label>{/if}
            <button type="button" class="btn btn-piccolo w-full justify-center" onclick={analizza} disabled={calcolo}><Icona nome="ricarica" /> {calcolo ? 'Calcolo in corso…' : 'Riconosci i vani'}</button>
            {#if msg}<p class="text-xs">{msg}</p>{/if}
            {#if analisi}
              <button type="button" class="btn btn-piccolo w-full justify-center" onclick={applicaPoligoni} disabled={!analisi.generati.poligoni.length || !analisiValida}>Applica i {analisi.generati.poligoni.length} poligoni proposti</button>
              <button type="button" class="btn btn-piccolo w-full justify-center" onclick={applicaSpessori} disabled={!analisiValida}>Spessore ai muri sezionati ({analisi.muri.length} linee)</button>
              {#if !analisiValida}<p class="text-xs text-amber-700 dark:text-amber-300">Il disegno è cambiato dopo il riconoscimento: rifai «Riconosci i vani» prima di applicare.</p>{/if}
              {#each [...analisi.generati.avvisi, ...analisi.vani.avvisi] as a, i (i)}<p class="text-xs text-amber-700 dark:text-amber-300">{a}</p>{/each}
            {/if}
            <button type="button" class="btn btn-piccolo w-full justify-center" onclick={togliSpessori}>Togli tutti gli spessori</button>
          </section>
          <p class="text-[11px] text-fg-faint">Il disegno salvato sostituisce il DXF della scheda; quello di prima resta conservato e si ripristina dalla planimetria.</p>
        </aside>
      </div>
    </div>
  </div>
{/if}
