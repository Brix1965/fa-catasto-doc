/**
 * Valore di un campo numerico: un campo svuotato dà null (bind:value su type="number") e il null finiva nella
 * pratica (rendita, superfici, altezze) e poi nei record o in toLocaleString: qui diventa 0.
 */
export function numeroCampo(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
