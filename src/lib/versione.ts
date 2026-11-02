/**
 * Versione dell'app e data di rilascio (data e ora della build), scritte da vite.config.js al momento della
 * compilazione. La data si mostra nel fuso di Roma.
 */
declare const __INFO_BUILD__: { versione: string; data: string; commit: string } | undefined;

const info = typeof __INFO_BUILD__ !== 'undefined' ? __INFO_BUILD__ : { versione: '', data: '', commit: '' };

function dataRoma(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d).replace(',', '');
}

export const VERSIONE_APP = {
  versione: info.versione,
  /** data e ora del rilascio, es. «02/11/2026 15:30» (Europe/Rome) */
  rilascio: dataRoma(info.data),
  commit: info.commit,
  /** testo breve: «v0.2.0 · 02/11/2026 15:30» */
  testo: [info.versione ? `v${info.versione}` : '', dataRoma(info.data)].filter(Boolean).join(' · '),
};
