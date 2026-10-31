<script lang="ts">
  /** Disegna una Bitmap bilivello (1 = nero) su un canvas, ridotta per l'anteprima. */
  import type { Bitmap } from '$lib/core/raster/bitmap';
  let { bitmap, larghezzaMax = 640, classe = '' }: { bitmap: Bitmap | null; larghezzaMax?: number; classe?: string } = $props();
  let canvas = $state<HTMLCanvasElement | null>(null);

  $effect(() => {
    const c = canvas;
    const bm = bitmap;
    if (!c) return;
    if (!bm) { c.width = 1; c.height = 1; return; }
    // riduzione per campionamento: un pixel dell'anteprima è nero se nel blocco c'è almeno un pixel nero
    const fattore = Math.max(1, Math.ceil(bm.width / larghezzaMax));
    const w = Math.ceil(bm.width / fattore);
    const h = Math.ceil(bm.height / fattore);
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let neri = 0;
        const y0 = y * fattore, x0 = x * fattore;
        for (let yy = y0; yy < Math.min(y0 + fattore, bm.height); yy++) {
          const riga = yy * bm.rowBytes;
          for (let xx = x0; xx < Math.min(x0 + fattore, bm.width); xx++) if (bm.data[riga + (xx >> 3)] & (0x80 >> (xx & 7))) neri++;
        }
        const tot = fattore * fattore;
        const v = Math.round(255 * (1 - Math.min(1, (neri * 2.2) / tot)));
        const i = (y * w + x) * 4;
        d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
</script>

<canvas bind:this={canvas} class="h-auto max-w-full rounded border border-line bg-white {classe}"></canvas>
