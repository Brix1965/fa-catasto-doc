<script lang="ts">
  /**
   * Data all'italiana gg/mm/aaaa legata a un oggetto { gg, mm, aaaa }; vuota = { 0, 0, 0 } (o undefined in
   * ingresso). Campo di testo (non il selettore del sistema, che segue la lingua del computer): le barre si
   * inseriscono da sole; si accetta anche ggmmaaaa.
   */
  import type { Data } from '$lib/core/model';
  let { valore = $bindable(), disabilitato = false, classe = '' }: { valore: Data | undefined; disabilitato?: boolean; classe?: string } = $props();

  const z = (n: number, l: number) => String(n).padStart(l, '0');
  const formatta = (d: Data | undefined) => (d && d.aaaa ? `${z(d.gg, 2)}/${z(d.mm, 2)}/${z(d.aaaa, 4)}` : '');

  let testo = $state(formatta(valore));
  let errata = $state(false);
  /** ultimo valore riportato nel testo: serve a riconoscere i cambi fatti da fuori (import, Annulla, altra finestra) */
  let ultimo = formatta(valore);
  $effect(() => {
    const f = formatta(valore);
    if (f !== ultimo) { ultimo = f; testo = f; errata = false; }
  });

  function valida(gg: number, mm: number, aaaa: number): boolean {
    if (aaaa < 1800 || aaaa > 2999 || mm < 1 || mm > 12 || gg < 1) return false;
    return gg <= new Date(aaaa, mm, 0).getDate();
  }

  /** Inserisce le barre mentre si digita: 1205 → 12/05, 12052024 → 12/05/2024. */
  function digita(e: Event): void {
    const el = e.currentTarget as HTMLInputElement;
    const cifre = el.value.replace(/\D/g, '').slice(0, 8);
    // barre digitate a mano dopo una sola cifra (es. 1/5/2024): si lascia com'è, altrimenti si ricompone
    const parti = el.value.replace(/[^\d/]/g, '').split('/');
    const amano = parti.slice(0, -1).some((x) => x.length === 1);
    testo = amano ? parti.join('/').slice(0, 10) : [cifre.slice(0, 2), cifre.slice(2, 4), cifre.slice(4)].filter(Boolean).join('/');
    el.value = testo;
    errata = false;
  }

  function conferma(): void {
    const t = testo.trim();
    if (!t) { valore = { gg: 0, mm: 0, aaaa: 0 }; ultimo = ''; errata = false; return; }
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(t);
    if (m && valida(Number(m[1]), Number(m[2]), Number(m[3]))) {
      valore = { gg: Number(m[1]), mm: Number(m[2]), aaaa: Number(m[3]) };
      testo = ultimo = formatta(valore);
      errata = false;
    } else errata = true;
  }
</script>

<input
  type="text"
  inputmode="numeric"
  placeholder="gg/mm/aaaa"
  maxlength="10"
  class="campo font-mono {classe} {errata ? 'border-red-500 text-red-700 dark:text-red-300' : ''}"
  value={testo}
  oninput={digita}
  onchange={conferma}
  onblur={conferma}
  disabled={disabilitato}
  title={errata ? 'Data non valida: scrivere gg/mm/aaaa' : 'gg/mm/aaaa'}
  aria-invalid={errata}
/>
