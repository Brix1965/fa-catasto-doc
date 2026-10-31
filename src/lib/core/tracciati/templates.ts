/**
 * Modelli (template) dei record a 350 byte, ricavati dai file prodotti da Docfa 4.00.5
 * azzerando i campi dati. Contengono i byte 0xFF (qui 'ÿ') e le costanti delle zone riservate.
 * Le posizioni dati vengono sovrascritte dal compilatore; le zone riservate restano come qui.
 */
export const TEMPLATES: Record<string, string> = {
  '1': "0000000A00000000100000000   00000000000000000           00000000000000000000000000000000000000000000000000000000000000000000000                                                                                                                0000000000          000000000        ÿÿÿÿÿÿÿ        0000     0000 0000000000000000000000                       ",
  '3': "0000000C000000003                    0000                                                                                                          0000    0000               000000000000000    00         000000000000000000000000        ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ00 Classamento automatico eseguito                                            ",
  '4': "0000000C000000004            0000                0000                0000                0000                0000                0000                0000                0000                0000                0000    ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ                ",
  '9': "0000000L000000009                                                                                                             000000      000000                                                                                                                            0                                                                                 ",
  'A': "0000000M00000000A                                                                                                                                                                                0000000                                                              ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ1                      ",
  'B': "0000000N00000000B            0000     0000            0000     00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000                0000000000000000000000000000000          000000000000000000000000000000100000                  ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ                ",
  'C': "0000000P00000000C00000               00000000               00000000000000000                              0000000000000000               000000                                   000000000000               00000000000000               00000               00                                                                                             ",
  'H': "0000000U00000000H            0000                0000                0000                0000    00000000   0000000000   0000000000   0000000000   0000000000   0000000000   000000000000000000000000    0000000000000000 0000      0 000          0     000000000000                                  000000000000000000000                 ÿ                ",
  'I': "0000000U00000000I                                                                                                                                                                                                                                       ÿÿÿÿÿÿÿÿÿÿÿ ÿÿÿÿÿ                                                                                     ",
  'L': "0000000U00000000L                                                                                                                                                                                                                                                                                                                                             ",
  'M': "0000000W00000000M            0000     0000            0000    00000000                                                            000000000000000                                        000000000000                                                                                                                                       ÿÿI1AA          D3",
  'N': "0000000W00000000N                                        0000                                                                                                                                            00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008646000        I1AA          D3",
  'O': "0000000W00000000O0                               000000000000000000000                               000000000000000000000                               000000000000000000000                               000000000000000000000                               000000000000000000000                               000000000000000000000    I1AA          D3",
  'P': "0000000W00000000P                                0000                0000                                  0000000000000                    00000000                                                                                                                                                      00000000000000000000000000000000ÿÿÿÿI1AA          D3",
  'Q': "0000000W00000000Q000000000000000000000000                                                                                                                                                                                                                                                                                                     I1AA          D3",
  'R': "0000000W00000000R                                                                                                                                                                                                                                                                                                                             I1AA          D3",
};

import { SCHEMAS } from './schema';

/**
 * Record senza un file reale di riferimento (intestati, utilità comuni, ulteriori indirizzi, beni comuni
 * non censibili): template costruito dal tracciato, con zeri nei campi numerici e spazi altrove.
 */
/** Filler a 0xFF (posizioni 1-based) dei record generati, come li scrive Docfa (verificato con Docfa 4.00.5). */
const FILLER_FF: Record<string, [number, number]> = { '2': [314, 334], '8': [242, 334] };

function templateDaTracciato(type: string, identificativo: string): string {
  const b = Array.from({ length: 350 }, () => ' ');
  for (const f of SCHEMAS[type].fields) if (f.kind === 'N') for (let i = f.start; i <= f.end; i++) b[i - 1] = '0';
  const ff = FILLER_FF[type];
  if (ff) for (let i = ff[0]; i <= ff[1]; i++) b[i - 1] = '\u00ff';
  b[7] = identificativo;
  b[16] = type;
  return b.join('');
}
for (const [t, id] of [['2', 'B'], ['5', 'C'], ['6', 'C'], ['8', 'H']] as const) TEMPLATES[t] ??= templateDaTracciato(t, id);
