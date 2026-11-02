<script lang="ts">
  /**
   * Modello 2N parte I, quadro H: prospetto di stima, valore complessivo attribuito (Va), saggio e rendita.
   * Tutti gli importi si inseriscono in euro; i totali e la rendita (Va × saggio) si calcolano da soli.
   */
  import type { Mod2N, UnitaImmobiliare } from '$lib/core/model';
  import { euro, numeroItaliano, leggiRighe, leggiSaggio, leggiStima, ricalcola2N, rigaVuota, RIGHE_STIMA, scriviRiga, scriviSaggio, valoreRiga, type RigaStima } from '$lib/core/stima-2n';
  import Icona from './Icona.svelte';
  import { untrack } from 'svelte';

  let { unita = $bindable() }: { unita: UnitaImmobiliare } = $props();
  const d = $derived(unita.mod2N as Mod2N);

  // righe mostrate: quelle compilate più una vuota (fino a 18)
  const righe = $derived(leggiRighe(d));
  const ultimaPiena = $derived(righe.reduce((u, r, i) => (rigaVuota(r) ? u : i), -1));
  const visibili = $derived(Math.min(RIGHE_STIMA, Math.max(1, ultimaPiena + 2)));
  const totale = $derived(righe.reduce((s, r) => s + (r.valore || 0), 0));
  const stima = $derived(leggiStima(d));
  const percento = $derived(Math.round(leggiSaggio(d.recordN) * 1000000) / 10000);

  // all'apertura (e quando cambia l'unità): totale e rendita riallineati, per le pratiche salvate con valori
  // incoerenti. Il ricalcolo legge e scrive gli stessi campi: va fatto fuori dal tracciamento (untrack), altrimenti
  // l'effetto si richiama all'infinito (effect_update_depth_exceeded, segnalato da Fabrizio il 02/11/2026)
  $effect(() => {
    const m = d;
    untrack(() => { ricalcola2N(m); allineaQuadroU(); });
  });

  /** la rendita del quadro U è quella del 2N: si aggiorna subito, senza dover riaprire il quadro U */
  function allineaQuadroU(): void {
    const r = leggiStima(unita.mod2N as Mod2N).rendita;
    if (unita.classamento && r > 0 && unita.classamento.rendita !== r) unita.classamento.rendita = r;
  }

  const numero = (s: string): number => numeroItaliano(s);
  const it = (v: number, dec = 2): string => (v ? v.toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '');

  function cambia(i: number, campo: keyof RigaStima, valore: string): void {
    const r = { ...righe[i] };
    if (campo === 'rif' || campo === 'natura' || campo === 'descrizione') r[campo] = valore;
    else r[campo] = numero(valore);
    // il valore della riga segue consistenza × valore unitario (resta modificabile a mano)
    if (campo === 'consistenza' || campo === 'unitario') r.valore = valoreRiga(r.consistenza, r.unitario);
    scriviRiga(d, i, r);
    ricalcola2N(d, { attribuitaDaTotale: true });
    allineaQuadroU();
  }
  function togli(i: number): void {
    const tutte = leggiRighe(d).filter((_, k) => k !== i);
    for (let k = 0; k < RIGHE_STIMA; k++) scriviRiga(d, k, tutte[k] ?? { rif: '', natura: '', descrizione: '', consistenza: 0, unitario: 0, valore: 0 });
    while (d.stimaComparativa.length > 3) d.stimaComparativa.pop();
    ricalcola2N(d, { attribuitaDaTotale: true });
    allineaQuadroU();
  }
  function sommaria(v: string): void {
    d.recordN.valore_stima_sommaria = Math.round(numero(v) * 100);
    ricalcola2N(d, { attribuitaDaTotale: !totale });
    allineaQuadroU();
  }
  function attribuita(v: string): void {
    d.recordN.valutazione_attribuita = Math.round(numero(v) * 100);
    ricalcola2N(d);
    allineaQuadroU();
  }
  function saggio(v: string): void {
    scriviSaggio(d.recordN, numero(v) / 100);
    ricalcola2N(d);
    allineaQuadroU();
  }
  function altroTesto(v: string): void {
    const righe3 = v.replace(/\r/g, '').split('\n').slice(0, 3).map((s) => s.slice(0, 300));
    d.altroTipoStima = righe3.some((s) => s.trim()) ? righe3 : undefined;
  }
</script>

<div class="space-y-6">
  <section>
    <h3 class="mb-1 text-sm font-semibold">1. Valutazione sommaria con elementi comparativi di valore o di costo</h3>
    <p class="mb-2 text-xs text-fg-muted">Importi in euro. Il valore della riga è consistenza × valore unitario (si può correggere a mano).</p>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-left text-xs text-fg-muted">
          <tr><th class="pr-2">Rif.</th><th class="pr-2">Natura</th><th class="pr-2">Descrizione</th><th class="pr-2 text-right">Consistenza m²/m³</th><th class="pr-2 text-right">Valore unitario €</th><th class="pr-2 text-right">Valore €</th><th></th></tr>
        </thead>
        <tbody>
          {#each righe.slice(0, visibili) as r, i (i)}
            <tr>
              <td class="py-1 pr-2"><input type="text" class="campo campo-piccolo w-14" maxlength="3" value={r.rif} onchange={(e) => cambia(i, 'rif', e.currentTarget.value)} /></td>
              <td class="py-1 pr-2">
                <select class="campo campo-piccolo w-36" value={r.natura} onchange={(e) => cambia(i, 'natura', e.currentTarget.value)}>
                  <option value=""></option><option value="S">S – suolo</option><option value="C">C – costruzioni</option><option value="E">E – elementi connessi</option>
                  {#if r.natura && !['S', 'C', 'E'].includes(r.natura)}<option value={r.natura}>{r.natura}</option>{/if}
                </select>
              </td>
              <td class="py-1 pr-2"><input type="text" class="campo campo-piccolo w-48 uppercase" maxlength="20" value={r.descrizione} onchange={(e) => cambia(i, 'descrizione', e.currentTarget.value.toUpperCase())} /></td>
              <td class="py-1 pr-2"><input type="text" inputmode="decimal" class="campo campo-piccolo w-24 text-right tabular-nums" value={r.consistenza || ''} onchange={(e) => cambia(i, 'consistenza', e.currentTarget.value)} /></td>
              <td class="py-1 pr-2"><input type="text" inputmode="decimal" class="campo campo-piccolo w-28 text-right tabular-nums" value={it(r.unitario)} onchange={(e) => cambia(i, 'unitario', e.currentTarget.value)} /></td>
              <td class="py-1 pr-2"><input type="text" inputmode="decimal" class="campo campo-piccolo w-32 text-right tabular-nums" value={it(r.valore, 0)} onchange={(e) => cambia(i, 'valore', e.currentTarget.value)} /></td>
              <td class="py-1">{#if !rigaVuota(r)}<button type="button" class="btn btn-piccolo btn-pericolo" title="Togli la riga" onclick={() => togli(i)}><Icona nome="cestino" /></button>{/if}</td>
            </tr>
          {/each}
        </tbody>
        <tfoot><tr class="border-t border-line"><td colspan="5" class="py-1.5 pr-2 text-right text-xs text-fg-muted">Totale prospetto</td><td class="py-1.5 pr-2 text-right font-semibold tabular-nums">{euro(totale)}</td><td></td></tr></tfoot>
      </table>
    </div>
  </section>

  <section>
    <h3 class="mb-1 text-sm font-semibold">2. Valutazione con metodologie diverse (aziende a destinazione singolare)</h3>
    <div class="grid gap-3 sm:grid-cols-[1fr_12rem]">
      <textarea class="campo h-20 font-mono text-xs" placeholder="descrizione (al massimo 3 righe)" value={(d.altroTipoStima ?? []).join('\n')} onchange={(e) => altroTesto(e.currentTarget.value)}></textarea>
      <label class="text-xs text-fg-muted">Valore stimato €
        <input type="text" inputmode="decimal" class="campo mt-1 text-right tabular-nums" value={it(stima.sommaria)} onchange={(e) => sommaria(e.currentTarget.value)} />
      </label>
    </div>
  </section>

  <section class="rounded-md border border-line p-4">
    <h3 class="mb-3 text-sm font-semibold">3. Rendita catastale proposta</h3>
    <div class="grid items-end gap-4 sm:grid-cols-4">
      <label class="text-xs text-fg-muted">Valore complessivo Va €
        <input type="text" inputmode="decimal" class="campo mt-1 text-right tabular-nums" value={it(stima.attribuita)} onchange={(e) => attribuita(e.currentTarget.value)} />
        <span class="mt-1 block">{totale ? 'proposto il totale del prospetto, arrotondabile' : 'da indicare'}</span>
      </label>
      <label class="text-xs text-fg-muted">Saggio r %
        <input type="text" inputmode="decimal" class="campo mt-1 text-right tabular-nums" value={percento ? percento.toLocaleString('it-IT', { maximumFractionDigits: 2 }) : ''} onchange={(e) => saggio(e.currentTarget.value)} />
        <span class="mt-1 block">es. 2 = 0,0200</span>
      </label>
      <div class="text-xs text-fg-muted sm:col-span-2">Rendita = Va × r
        <div class="mt-1 text-lg font-semibold text-fg tabular-nums">{euro(stima.rendita)}</div>
        <span class="block">{it(stima.attribuita)} × {(leggiSaggio(d.recordN)).toLocaleString('it-IT', { minimumFractionDigits: 4 })} — riportata nel quadro U</span>
      </div>
    </div>
  </section>
</div>
