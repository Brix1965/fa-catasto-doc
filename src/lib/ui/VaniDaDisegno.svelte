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
  import { altezzeUnita, m2Intero, totaliVani, type RisultatoVani, type TipoVano, type VanoRiconosciuto } from '$lib/core/vani/riconosci';
  import { riconosciInBackground, schedeConDxf } from '$lib/core/vani/esegui';
  import { consistenzaVani } from '$lib/core/vani/totali';
  import { allineaAiVicini, area, direzionePrincipale, dist, distSegmento, type P } from '$lib/core/disegno/geometria';
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
  let menu = $state<{ s: number; id: number; x: number; y: number } | null>(null);
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
  async function calcola(): Promise<void> {
    const mia = ++richiesta;
    stato = 'calcolo';
    errore = '';
    menu = null;
    try {
      const schede = schedeConDxf($state.snapshot(unita.planimetria) as UnitaImmobiliare['planimetria']);
      if (!schede.length) throw new Error('La planimetria di questa unità non ha un DXF: il riconoscimento dei vani parte dal disegno DXF.');
      const r = await riconosciInBackground({ schede });
      if (mia !== richiesta || !aperto) return;
      risultati = r;
      // scelte già confermate in precedenza: si riapplicano ai vani nella stessa posizione
      const prima = m.propostaVani?.schede ?? [];
      vani = risultati.map((r, s) => r.vani.map((v) => {
        // il vano di allora com'era proposto (prima delle correzioni della forma)
        const p = prima[s]?.vani.find((x) => { const o = x.originale ?? x; return Math.hypot(o.centro[0] - v.centro[0], o.centro[1] - v.centro[1]) < 0.3 && Math.abs(o.superficie - v.superficie) < 0.5; });
        // si riapplicano solo le scelte del tecnico (tipo, m², forma diversi dalla proposta di allora): se il disegno è
        // cambiato, il resto segue la proposta nuova
        if (!p) return v;
        const conForma = p.forma && p.originale ? { forma: true, originale: v.originale ?? { superficie: v.superficie, centro: v.centro, contorni: v.contorni }, contorni: p.contorni, superficie: p.superficie, centro: p.centro } : {};
        const sup = p.forma ? p.superficie : v.superficie;
        return { ...v, ...conForma, tipo: p.tipo !== p.tipoProposto ? (p.tipo as TipoVano) : v.tipo, m2: p.m2 !== m2Intero(p.superficie) ? p.m2 : m2Intero(sup) };
      }));
      scheda = 0;
      modifica = null;
      stato = 'pronto';
      adatta();
    } catch (e) {
      errore = e instanceof Error ? e.message : String(e);
      stato = 'errore';
    }
  }

  $effect(() => { if (aperto) untrack(() => void calcola()); });

  function scegli(s: number, id: number, tipo: TipoVano): void {
    const v = vani[s].find((x) => x.id === id);
    if (v) v.tipo = tipo;
    menu = null;
  }
  function cambiaM2(s: number, id: number, valore: string): void {
    const v = vani[s].find((x) => x.id === id);
    const n = Math.max(0, Math.round(Number(valore.replace(',', '.'))));
    if (v && Number.isFinite(n)) v.m2 = n;
  }
  function ripristina(s: number, id: number): void {
    const v = vani[s].find((x) => x.id === id);
    if (!v) return;
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
    const proposta: PropostaVani = { confermata: new Date().toISOString(), schede: $state.snapshot(vani).map((vs) => ({ vani: vs.map(({ contorniLordi: _, ...v }) => v) as VanoProposto[] })) };
    m.propostaVani = proposta;
    aperto = false;
  }

  // ---- disegno: vista (zoom con la rotella, spostamento trascinando)
  const limiti = $derived(risultati[scheda]?.limiti);
  let vista = $state({ x: 0, y: 0, w: 1, h: 1 });
  const viewBox = $derived(`${vista.x} ${vista.y} ${vista.w} ${vista.h}`);
  let svgEl = $state<SVGSVGElement | null>(null);
  function adatta(): void {
    const l = risultati[scheda]?.limiti;
    if (l) vista = { x: l.x0 - 0.5, y: -l.y1 - 0.5, w: l.x1 - l.x0 + 1, h: l.y1 - l.y0 + 1 };
    requestAnimationFrame(() => (upp = perPixel()));
  }
  $effect(() => { void scheda; untrack(adatta); });
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
    menu = null;
    zoomA(Math.exp(e.deltaY * 0.0015), puntoSvg(e));
  }
  let spinta = $state.raw<{ x: number; y: number; vx: number; vy: number; id: number } | null>(null);
  let trascinato = $state(false);
  function giu(e: PointerEvent): void {
    if (e.button !== 0 && e.button !== 1) return;
    trascinato = false;
    if (e.button === 0 && aggiungi && modifica && aggiungiVertice(e)) return;
    spinta = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y, id: e.pointerId };
  }
  function muovi(e: PointerEvent): void {
    if (trascinaV) { muoviVertice(e); return; }
    if (!spinta) return;
    const dx = e.clientX - spinta.x, dy = e.clientY - spinta.y;
    if (!trascinato && Math.hypot(dx, dy) < 4) return;
    if (!trascinato) { trascinato = true; menu = null; svgEl?.setPointerCapture(spinta.id); }
    const u = perPixel();
    vista = { ...vista, x: spinta.vx - dx * u, y: spinta.vy - dy * u };
  }
  function su(): void {
    spinta = null;
    if (trascinaV) { trascinaV = null; }
  }

  // ---- forma del vano: vertici da spostare, aggiungere, togliere
  let modifica = $state<{ s: number; id: number } | null>(null);
  let vSel = $state<{ r: number; k: number } | null>(null);
  let aggiungi = $state(false);
  let ortogonale = $state(false);
  let trascinaV: { r: number; k: number; mosso: boolean } | null = null;
  const vanoInModifica = $derived(modifica ? vani[modifica.s]?.find((x) => x.id === modifica!.id) : undefined);
  /** orientamento dei muri, per l'ortogonale */
  const angolo = $derived(direzionePrincipale((risultati[scheda]?.linee ?? []).filter((l) => !l.tratteggiata).map((l) => [l.a, l.b] as [P, P])));
  /** estremi delle linee del disegno, per agganciare i vertici agli spigoli dei muri */
  const spigoli = $derived((risultati[scheda]?.linee ?? []).flatMap((l) => [l.a, l.b] as P[]));
  function iniziaModifica(s: number, id: number): void {
    if (scheda !== s) scheda = s;
    modifica = { s, id }; vSel = null; aggiungi = false; menu = null; selezionato = { s, id };
    // la vista si porta sul vano, con un po' di margine attorno
    const v = vani[s]?.find((x) => x.id === id);
    const pts = v?.contorni.flat() ?? [];
    if (pts.length) {
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const m = Math.max(1, 0.4 * Math.max(x1 - x0, y1 - y0));
      vista = { x: x0 - m, y: -y1 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
    }
    requestAnimationFrame(() => (upp = perPixel()));
  }
  function fineModifica(): void { modifica = null; vSel = null; aggiungi = false; }
  /** la forma è cambiata: m² ricalcolati (anche quelli scritti a mano seguono, salvo correzione dopo) */
  function aggiornaForma(v: VanoRiconosciuto): void {
    if (!v.originale) v.originale = { superficie: v.superficie, centro: v.centro, contorni: $state.snapshot(v.contorni) as P[][] };
    const manuale = v.m2 !== m2Intero(v.superficie);
    v.superficie = Math.round(v.contorni.reduce((a, c) => a + area(c as P[]), 0) * 100) / 100;
    if (!manuale) v.m2 = m2Intero(v.superficie);
    const c = v.contorni.reduce((m, x) => (area(x as P[]) > area(m as P[]) ? x : m), v.contorni[0]);
    v.centro = [c.reduce((a, p) => a + p[0], 0) / c.length, c.reduce((a, p) => a + p[1], 0) / c.length];
    v.forma = true;
  }
  function giuVertice(e: PointerEvent, r: number, k: number): void {
    e.stopPropagation();
    if (e.button !== 0) return;
    vSel = { r, k };
    trascinaV = { r, k, mosso: false };
    svgEl?.setPointerCapture(e.pointerId);
  }
  function muoviVertice(e: PointerEvent): void {
    const v = vanoInModifica;
    if (!v || !trascinaV) return;
    const [sx, sy] = puntoSvg(e);
    let p: P = [sx, -sy];
    const t = upp * 9;
    // aggancio agli spigoli del disegno
    let best: P | null = null, d = t;
    for (const q of spigoli) { const x = dist(q, p); if (x < d) { d = x; best = q; } }
    if (best) p = [best[0], best[1]];
    else if (ortogonale || e.shiftKey) {
      const c = v.contorni[trascinaV.r];
      const n = c.length;
      p = allineaAiVicini(p, [c[(trascinaV.k - 1 + n) % n] as P, c[(trascinaV.k + 1) % n] as P], angolo, upp * 14).p;
    }
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
    v.contorni[br].splice(bk + 1, 0, p);
    vSel = { r: br, k: bk + 1 };
    trascinaV = { r: br, k: bk + 1, mosso: true };
    svgEl?.setPointerCapture(e.pointerId);
    aggiornaForma(v);
    return true;
  }
  function togliVertice(): void {
    const v = vanoInModifica;
    if (!v || !vSel) return;
    const c = v.contorni[vSel.r];
    if (!c || c.length <= 3) return;
    c.splice(vSel.k, 1);
    vSel = null;
    aggiornaForma(v);
  }
  const percorso = (c: [number, number][][]) => c.map((r) => 'M' + r.map(([x, y]) => `${x.toFixed(3)},${(-y).toFixed(3)}`).join('L') + 'Z').join(' ');
  const scalaTesto = $derived(limiti ? Math.max(0.18, Math.min(0.45, (limiti.x1 - limiti.x0) / 90)) : 0.3);

  function clicVano(e: MouseEvent, s: number, id: number): void {
    if (trascinato) return;
    if (modifica) { if (modifica.id !== id) iniziaModifica(s, id); return; }
    const box = (e.currentTarget as SVGElement).closest('.area-disegno')!.getBoundingClientRect();
    // il menu resta dentro il disegno
    menu = { s, id, x: Math.max(4, Math.min(e.clientX - box.left, box.width - 216)), y: Math.max(4, Math.min(e.clientY - box.top, box.height - 230)) };
    selezionato = { s, id };
  }
  function tasti(e: KeyboardEvent): void {
    if (!aperto) return;
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (menu) menu = null; else if (aggiungi) aggiungi = false; else if (modifica) fineModifica(); else aperto = false;
      return;
    }
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if (modifica && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); togliVertice(); }
    else if (modifica && (e.key === 'v' || e.key === '+')) aggiungi = !aggiungi;
    else if (e.key === 'f') adatta();
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
          <p class="mt-0.5 text-xs text-fg-muted">Proposta calcolata dal DXF (superfici fra i muri, senza sguinci e soglie): controlla ogni vano. Clic su un vano per cambiarne il tipo o modificarne la forma; i m² si correggono anche nella tabella. Dopo la conferma tutti i valori restano modificabili nel quadro C.</p>
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
          <button type="button" class="btn btn-piccolo" onclick={calcola}><Icona nome="ricarica" /> Riprova</button>
        </div>
      {:else}
        <div class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <!-- disegno -->
          <div class="flex min-h-0 flex-col border-b border-line lg:border-r lg:border-b-0">
            <div class="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2">
              {#if risultati.length > 1}
                {#each risultati as _, s (s)}
                  <button type="button" class="btn btn-piccolo {scheda === s ? 'btn-primario' : ''}" onclick={() => { scheda = s; menu = null; fineModifica(); }}>Scheda {s + 1}</button>
                {/each}
                <span class="mx-1 h-5 w-px bg-line"></span>
              {/if}
              <button type="button" class="btn btn-piccolo" title="Ingrandisci (anche con la rotella)" aria-label="Ingrandisci" onclick={() => zoomA(0.7)}><Icona nome="piu" /></button>
              <button type="button" class="btn btn-piccolo" title="Riduci" aria-label="Riduci" onclick={() => zoomA(1 / 0.7)}><span class="px-0.5 font-semibold">−</span></button>
              <button type="button" class="btn btn-piccolo" title="Tutto il disegno (F)" aria-label="Adatta" onclick={adatta}><Icona nome="adatta" /></button>
              {#if vanoInModifica}
                {@const v = vanoInModifica}
                <span class="mx-1 h-5 w-px bg-line"></span>
                <span class="text-xs font-semibold">Forma del vano {v.id}</span>
                <button type="button" class="btn btn-piccolo {aggiungi ? 'btn-primario' : ''}" onclick={() => (aggiungi = !aggiungi)} title="Poi clic sul bordo del vano (tasto V)"><Icona nome="piu" /> Aggiungi vertici</button>
                <button type="button" class="btn btn-piccolo" onclick={togliVertice} disabled={!vSel} title="Toglie il vertice selezionato (Canc)"><Icona nome="cestino" /> Togli vertice</button>
                <label class="flex items-center gap-1 text-xs" title="Anche tenendo premuto Maiusc"><input type="checkbox" class="check" bind:checked={ortogonale} /> Ortogonale</label>
                {#if v.forma}<button type="button" class="btn btn-piccolo" onclick={() => ripristina(modifica!.s, v.id)} title="Torna alla forma proposta dal programma">Forma proposta</button>{/if}
                <button type="button" class="btn btn-piccolo btn-primario" onclick={fineModifica}><Icona nome="spunta" /> Fine</button>
              {/if}
            </div>
            <div class="area-disegno relative min-h-[22rem] flex-1 overflow-hidden bg-white dark:bg-neutral-950">
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <svg bind:this={svgEl} class="h-full w-full touch-none select-none {aggiungi ? 'cursor-crosshair' : spinta && trascinato ? 'cursor-grabbing' : ''}" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Planimetria con i vani colorati" onwheel={rotella} onpointerdown={giu} onpointermove={muovi} onpointerup={su} onpointercancel={su}>
                {#each risultati[scheda]?.linee ?? [] as l, i (i)}
                  <line x1={l.a[0]} y1={-l.a[1]} x2={l.b[0]} y2={-l.b[1]} stroke="currentColor" class="text-neutral-500" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray={l.tratteggiata ? '5 3' : undefined} />
                {/each}
                {#each vani[scheda] ?? [] as v (v.id)}
                  {@const sel = (selezionato?.s === scheda && selezionato.id === v.id) || evidenziato === v.id}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <path d={percorso(v.contorni)} fill={colore(v.tipo)} fill-opacity={v.tipo === 'escluso' ? 0.12 : sel ? 0.6 : 0.38} stroke={colore(v.tipo)} stroke-width={sel ? 3 : 1.2} vector-effect="non-scaling-stroke" stroke-dasharray={verificare(v) ? '6 4' : undefined} class="cursor-pointer" role="button" tabindex="-1" aria-label={`Vano ${v.id}`} onclick={(e) => clicVano(e, scheda, v.id)} onmouseenter={() => (evidenziato = v.id)} onmouseleave={() => (evidenziato = null)} />
                {/each}
                {#if vanoInModifica && modifica?.s === scheda}
                  {#each vanoInModifica.contorni as c, r (r)}
                    {#each c as q, k (k)}
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <rect x={q[0] - upp * 5} y={-q[1] - upp * 5} width={upp * 10} height={upp * 10} fill={vSel?.r === r && vSel.k === k ? '#2563eb' : '#fff'} stroke="#2563eb" stroke-width="1.5" vector-effect="non-scaling-stroke" class="cursor-move" onpointerdown={(e) => giuVertice(e, r, k)} />
                    {/each}
                  {/each}
                {/if}
                {#each vani[scheda] ?? [] as v (v.id)}
                  <text x={v.centro[0]} y={-v.centro[1]} font-size={scalaTesto} text-anchor="middle" class="pointer-events-none fill-neutral-900 dark:fill-neutral-100" font-weight="600">{v.id}</text>
                  <text x={v.centro[0]} y={-v.centro[1] + scalaTesto * 1.1} font-size={scalaTesto * 0.85} text-anchor="middle" class="pointer-events-none fill-neutral-700 dark:fill-neutral-300">{v.tipo === 'escluso' ? 'escluso' : `${v.m2} m²`}</text>
                {/each}
              </svg>
              {#if menu}
                {@const v = vani[menu.s]?.find((x) => x.id === menu!.id)}
                {#if v}
                  <div class="absolute z-10 w-52 rounded-md border border-line bg-surface p-1 shadow-lg" style={`left:${menu.x}px;top:${menu.y}px`}>
                    <p class="px-2 py-1 text-xs text-fg-muted">Vano {v.id} · {v.superficie.toLocaleString('it-IT')} m² {nomeVano(v) !== '—' ? `· ${nomeVano(v)}` : ''}</p>
                    {#each TIPI as t (t.tipo)}
                      <button type="button" class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2 {v.tipo === t.tipo ? 'font-semibold' : ''}" onclick={() => scegli(menu!.s, v.id, t.tipo)}>
                        <span class="size-3 rounded-sm" style={`background:${t.colore}`}></span> {t.nome} {#if v.tipo === t.tipo}<Icona nome="spunta" classe="ml-auto size-3.5" />{/if}
                      </button>
                    {/each}
                    <div class="my-1 border-t border-line"></div>
                    <button type="button" class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface-2" onclick={() => iniziaModifica(menu!.s, v.id)}><Icona nome="poligono" classe="size-3.5" /> Modifica la forma</button>
                  </div>
                {/if}
              {/if}
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-xs text-fg-muted">
              {#each TIPI as t (t.tipo)}<span class="flex items-center gap-1.5"><span class="size-3 rounded-sm" style={`background:${t.colore}`}></span>{t.breve}</span>{/each}
              <span>contorno tratteggiato = da verificare</span>
              <span>· rotella: zoom · trascina: sposta la vista</span>
            </div>
          </div>

          <!-- elenco e totali -->
          <div class="flex min-h-0 flex-col">
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
                        <button type="button" class="block text-xs text-accent-700 hover:underline dark:text-accent-300" onclick={() => iniziaModifica(scheda, v.id)}>modifica la forma</button>
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
                <button type="button" class="btn btn-piccolo" onclick={calcola}><Icona nome="ricarica" /> Ricalcola</button>
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
