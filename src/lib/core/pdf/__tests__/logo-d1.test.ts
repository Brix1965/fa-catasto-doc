/**
 * Logo del D1: incorporato nel programma, identico a quello che Docfa stampa sulla prima pagina del D1
 * (stessa immagine JPEG in NCV002, NCV081 e nella pratica BPM).
 */
import { it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { estraiLogoD1 } from '../importa';
import { LOGO_D1 } from '../assets/logo-d1.generated';
import { decodificaBase64 } from '../base64';

it.skipIf(!existsSync('fixtures-private/NCV081.PDF'))('il logo incorporato è quello dei PDF di Docfa', async () => {
  const logo = await estraiLogoD1(new Uint8Array(readFileSync('fixtures-private/NCV081.PDF')));
  expect(logo).toMatchObject({ larghezza: LOGO_D1.larghezza, altezza: LOGO_D1.altezza });
  expect(Buffer.from(logo!.jpeg).equals(Buffer.from(decodificaBase64(LOGO_D1.jpegB64)))).toBe(true);
});
