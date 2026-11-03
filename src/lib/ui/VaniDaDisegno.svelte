<script lang="ts">
  /**
   * Proposta dei vani dalla planimetria (modulo SPERIMENTALE): finestra sopra il modello 1N parte II con la
   * planimetria a colori, un vano per riga. Il tecnico cambia il tipo di ogni vano (clic sul disegno o sulla
   * riga), corregge i m², esclude quello che non va, poi conferma: i totali passano nel quadro C, dove restano
   * modificabili a mano come sempre.
   */
  import type { Mod1NParteII, PropostaVani, UnitaImmobiliare, VanoProposto } from '$lib/core/model';
  import { altezzeUnita, m2Intero, totaliVani, type RisultatoVani, type TipoVano, type VanoRiconosciuto } from '$lib/core/vani/riconosci';
  import { riconosciInBackground, schedeConDxf } from '$lib/core/vani/esegui';
  import { consistenzaVani } from '$lib/core/vani/totali';
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

  async function calcola(): Promise<void> {
    stato = 'calcolo';
    errore = '';
    menu = null;
    try {
      const schede = schedeConDxf($state.snapshot(unita.planimetria) as UnitaImmobiliare['planimetria']);
      if (!schede.length) throw new Error('La planimetria di questa unità non ha un DXF: il riconoscimento dei vani parte dal disegno DXF.');
      risultati = await riconosciInBackground({ schede });
      // scelte già confermate in precedenza: si riapplicano ai vani nella stessa posizione
      const prima = m.propostaVani?.schede ?? [];
      vani = risultati.map((r, s) => r.vani.map((v) => {
        const p = prima[s]?.vani.find((x) => Math.hypot(x.centro[0] - v.centro[0], x.centro[1] - v.centro[1]) < 0.3 && Math.abs(x.superficie - v.superficie) < 0.5);
        return p ? { ...v, tipo: p.tipo as TipoVano, m2: p.m2 } : v;
      }));
      scheda = 0;
      stato = 'pronto';
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
    if (v) { v.tipo = v.tipoProposto; v.m2 = m2Intero(v.superficie); }
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
    const proposta: PropostaVani = { confermata: new Date().toISOString(), schede: $state.snapshot(vani).map((vs) => ({ vani: vs as VanoProposto[] })) };
    m.propostaVani = proposta;
    aperto = false;
  }

  // ---- disegno
  const limiti = $derived(risultati[scheda]?.limiti);
  const viewBox = $derived(limiti ? `${limiti.x0 - 0.5} ${-limiti.y1 - 0.5} ${limiti.x1 - limiti.x0 + 1} ${limiti.y1 - limiti.y0 + 1}` : '0 0 1 1');
  const percorso = (c: [number, number][][]) => c.map((r) => 'M' + r.map(([x, y]) => `${x.toFixed(3)},${(-y).toFixed(3)}`).join('L') + 'Z').join(' ');
  const scalaTesto = $derived(limiti ? Math.max(0.18, Math.min(0.45, (limiti.x1 - limiti.x0) / 90)) : 0.3);

  function clicVano(e: MouseEvent, s: number, id: number): void {
    const box = (e.currentTarget as SVGElement).closest('.area-disegno')!.getBoundingClientRect();
    // il menu resta dentro il disegno
    menu = { s, id, x: Math.max(4, Math.min(e.clientX - box.left, box.width - 216)), y: Math.max(4, Math.min(e.clientY - box.top, box.height - 230)) };
    selezionato = { s, id };
  }
  function tasti(e: KeyboardEvent): void {
    if (!aperto) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (menu) menu = null; else aperto = false; }
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
          <p class="mt-0.5 text-xs text-fg-muted">Proposta calcolata dal DXF: controlla ogni vano. Clic su un vano per cambiarne il tipo; i m² si correggono nella tabella. Dopo la conferma tutti i valori restano modificabili nel quadro C.</p>
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
            {#if risultati.length > 1}
              <div class="flex gap-1 border-b border-line px-3 py-2">
                {#each risultati as _, s (s)}
                  <button type="button" class="btn btn-piccolo {scheda === s ? 'btn-primario' : ''}" onclick={() => { scheda = s; menu = null; }}>Scheda {s + 1}</button>
                {/each}
              </div>
            {/if}
            <div class="area-disegno relative min-h-[22rem] flex-1 overflow-hidden bg-white dark:bg-neutral-950">
              <svg class="h-full w-full" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Planimetria con i vani colorati">
                {#each risultati[scheda]?.linee ?? [] as l, i (i)}
                  <line x1={l.a[0]} y1={-l.a[1]} x2={l.b[0]} y2={-l.b[1]} stroke="currentColor" class="text-neutral-500" stroke-width="0.025" stroke-dasharray={l.tratteggiata ? '0.12 0.08' : undefined} />
                {/each}
                {#each vani[scheda] ?? [] as v (v.id)}
                  {@const sel = (selezionato?.s === scheda && selezionato.id === v.id) || evidenziato === v.id}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <path d={percorso(v.contorni)} fill={colore(v.tipo)} fill-opacity={v.tipo === 'escluso' ? 0.12 : sel ? 0.6 : 0.38} stroke={colore(v.tipo)} stroke-width={sel ? 0.08 : 0.03} stroke-dasharray={verificare(v) ? '0.15 0.1' : undefined} class="cursor-pointer" role="button" tabindex="-1" aria-label={`Vano ${v.id}`} onclick={(e) => clicVano(e, scheda, v.id)} onmouseenter={() => (evidenziato = v.id)} onmouseleave={() => (evidenziato = null)} />
                {/each}
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
                  </div>
                {/if}
              {/if}
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-xs text-fg-muted">
              {#each TIPI as t (t.tipo)}<span class="flex items-center gap-1.5"><span class="size-3 rounded-sm" style={`background:${t.colore}`}></span>{t.breve}</span>{/each}
              <span>contorno tratteggiato = da verificare</span>
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
                      </td>
                      <td class="py-1.5 align-top">
                        <select class="campo campo-piccolo w-32" value={v.tipo} onchange={(e) => scegli(scheda, v.id, e.currentTarget.value as TipoVano)}>
                          {#each TIPI as t (t.tipo)}<option value={t.tipo}>{t.breve}</option>{/each}
                        </select>
                        {#if v.tipo !== v.tipoProposto || v.m2 !== m2Intero(v.superficie)}
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
