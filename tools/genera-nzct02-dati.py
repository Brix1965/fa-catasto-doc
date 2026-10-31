#!/usr/bin/env python3
"""Genera src/lib/core/classamento/nzct02-dati.generated.ts: modelli dei record e working storage iniziale di NZCT02.
Uso: genera-nzct02-dati.py <NZCT02.bin> <nzct02_modelli.json>
(NZCT02.bin = codice del modulo estratto da PGM/NZCT00.lbr; la working storage iniziale è il blocco
_mFginitdat in .rodata 0x73a8, lunghezza 0x31a4; W[x] = ws[x-8])."""
import sys, json, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'fixtures-private', 'ricerca-classamento'))
sys.path.insert(0, '/tmp/claude-0/emu')
from initdat import initdat

def rle(b):
    out = []; i = 0; lit = bytearray()
    while i < len(b):
        j = i
        while j < len(b) and b[j] == b[i]: j += 1
        if j - i >= 6:
            if lit: out.append(lit.decode('latin1')); lit = bytearray()
            out.append([b[i], j - i])
        else:
            lit += b[i:j]
        i = j
    if lit: out.append(lit.decode('latin1'))
    return out

def main():
    d = open(sys.argv[1], 'rb').read()
    ws, _ = initdat(d, 0x73a8, 0x31a4)
    W0 = b'\x00' * 8 + ws
    mod = json.load(open(sys.argv[2]))
    voci = {'W0': W0, 'T1868': bytes.fromhex(mod['T1868']), 'T0AF0': bytes.fromhex(mod['T0af0']), 'TA_B57': bytes.fromhex(mod['TA'])}
    righe = ['// File generato da tools/genera-nzct02-dati.py: non modificare a mano.',
             '// Modelli dei record e working storage iniziale di NZCT02 (Docfa 4), codificati a corse:',
             '// stringa = byte letterali (latin1), [byte, n] = n ripetizioni.',
             'export type Corse = (string | [number, number])[];']
    for k, v in voci.items():
        righe.append(f'export const {k}: Corse = {json.dumps(rle(v), ensure_ascii=True)};')
    out = os.path.join(os.path.dirname(__file__), '..', 'src', 'lib', 'core', 'classamento', 'nzct02-dati.generated.ts')
    open(out, 'w').write('\n'.join(righe) + '\n')
    print(out, os.path.getsize(out))

main()
