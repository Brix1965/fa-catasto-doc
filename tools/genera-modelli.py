#!/usr/bin/env python3
"""
Converte i modelli TIFF dell'Agenzia (A4.mod, A3.mod, EP2_A4.mod, EP2_A3.mod, cartella PGM di
Docfa 4) in un modulo TypeScript con gli stream CCITT G4 incorporati in base64.

Gli stream G4 sono già la rappresentazione più compatta (4-7 KB l'uno) e vengono decodificati a
runtime dal decoder di src/lib/core/raster/g4.ts: nessuna dipendenza da zlib o DecompressionStream.

Uso:
    python3 tools/genera-modelli.py "/percorso/Docfa4-cartella programma/PGM" [src/lib/core/raster/modelli-dati.ts]
"""
import base64
import struct
import sys
from pathlib import Path

MODELLI = {
    'A4_planimetria': 'A4.mod',
    'A3_planimetria': 'A3.mod',
    'A4_elaborato': 'EP2_A4.mod',
    'A3_elaborato': 'EP2_A3.mod',
}


def leggi_tiff(dati: bytes):
    """Legge un TIFF a strip unica G4 e restituisce (larghezza, altezza, strip)."""
    le = dati[:2] == b'II'
    end = '<' if le else '>'
    assert dati[:2] in (b'II', b'MM') and struct.unpack(end + 'H', dati[2:4])[0] == 42, 'non è un TIFF'
    ifd = struct.unpack(end + 'I', dati[4:8])[0]
    n = struct.unpack(end + 'H', dati[ifd:ifd + 2])[0]
    dim = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8}
    tags = {}
    for i in range(n):
        p = ifd + 2 + i * 12
        tag, tipo, count = struct.unpack(end + 'HHI', dati[p:p + 8])
        size = dim.get(tipo, 1) * count
        off = p + 8 if size <= 4 else struct.unpack(end + 'I', dati[p + 8:p + 12])[0]
        if tipo == 3:
            tags[tag] = list(struct.unpack(end + f'{count}H', dati[off:off + 2 * count]))
        elif tipo == 4:
            tags[tag] = list(struct.unpack(end + f'{count}I', dati[off:off + 4 * count]))
    assert tags[259] == [4], 'compressione non G4'
    assert tags.get(262, [0]) == [0], 'PhotometricInterpretation diverso da WhiteIsZero'
    assert tags.get(266, [1]) == [1], 'FillOrder diverso da 1'
    assert len(tags[273]) == 1, 'più di una strip'
    off, cnt = tags[273][0], tags[279][0]
    return tags[256][0], tags[257][0], dati[off:off + cnt]


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    pgm = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / 'src/lib/core/raster/modelli-dati.ts'
    righe = [
        '/**',
        ' * Modelli TIFF dell\'Agenzia delle Entrate (cartella PGM di Docfa 4) incorporati come stream',
        ' * CCITT G4 in base64. File generato da tools/genera-modelli.py: non modificare a mano.',
        ' */',
        '',
        'export interface ModelloIncorporato {',
        '  width: number;',
        '  height: number;',
        '  /** stream G4 puro (T.6) in base64 */',
        '  g4: string;',
        '}',
        '',
        'export const MODELLI_DATI: Record<string, ModelloIncorporato> = {',
    ]
    for chiave, nome in MODELLI.items():
        dati = (pgm / nome).read_bytes()
        w, h, strip = leggi_tiff(dati)
        b64 = base64.b64encode(strip).decode('ascii')
        righe.append(f'  // {nome}: {w}x{h} px, {len(strip)} byte G4')
        righe.append(f'  {chiave}: {{')
        righe.append(f'    width: {w},')
        righe.append(f'    height: {h},')
        righe.append('    g4:')
        for i in range(0, len(b64), 100):
            sep = ' +' if i + 100 < len(b64) else ','
            righe.append(f"      '{b64[i:i + 100]}'{sep}")
        righe.append('  },')
    righe.append('};')
    righe.append('')
    out.write_text('\n'.join(righe), encoding='utf-8')
    print(f'scritto {out} ({out.stat().st_size} byte)')


if __name__ == '__main__':
    main()
