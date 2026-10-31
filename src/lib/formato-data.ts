/** Date all'italiana per l'interfaccia, sempre gg/mm/aaaa (indipendenti dalla lingua del computer). */
import type { Data } from '$lib/core/model';

const z = (n: number, l = 2) => String(n).padStart(l, '0');

/** gg/mm/aaaa da una data del modello, da un oggetto Date o da una stringa ISO; '' se vuota. */
export function dataIt(d: Data | Date | string | undefined | null): string {
  if (!d) return '';
  if (typeof d === 'string') d = new Date(d);
  if (d instanceof Date) return isNaN(d.getTime()) ? '' : `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()}`;
  return d.aaaa ? `${z(d.gg)}/${z(d.mm)}/${z(d.aaaa, 4)}` : '';
}

/** gg/mm/aaaa hh:mm (ora locale). */
export function dataOraIt(d: Date | string | undefined | null): string {
  if (!d) return '';
  const x = typeof d === 'string' ? new Date(d) : d;
  return isNaN(x.getTime()) ? '' : `${dataIt(x)} ${z(x.getHours())}:${z(x.getMinutes())}`;
}
