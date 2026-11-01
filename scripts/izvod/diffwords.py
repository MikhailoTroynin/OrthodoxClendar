#!/usr/bin/env python3
"""Перелік змінених слів у текстах між git-версією (типово HEAD) і робочою копією — для звіту про виправлення.

  python3 -I scripts/izvod/diffwords.py [REV] > зміни.tsv
Колонки: джерело, шлях абзацу, назва книги, було, стало, контекст.
"""
import difflib, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import izvodlib as L  # noqa: E402


def units_of(fname, text):
    orig = L.load
    L.load = lambda f: text
    try:
        return {p: (k, t) for p, k, t in L.units('', fname)}, L.book_titles(fname)
    finally:
        L.load = orig


def main(rev='HEAD'):
    out = sys.stdout
    for sid, fname, _ in L.sources():
        try:
            old = subprocess.run(['git', 'show', f'{rev}:src/data/{fname}'], cwd=L.ROOT, capture_output=True, text=True, check=True).stdout
        except subprocess.CalledProcessError:
            continue
        new = L.load(fname)
        if old == new:
            continue
        uo, _ = units_of(fname, old)
        un, titles = units_of(fname, new)
        for path, (kind, t) in un.items():
            o = uo.get(path, (kind, ''))[1]
            if o == t:
                continue
            a, b = L.words_of(o), L.words_of(t)
            for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
                if tag == 'equal':
                    continue
                ctx = ' '.join(b[max(0, j1 - 4):j2 + 4])
                out.write('\t'.join([sid, path, titles.get(path.split('/')[0], ''), ' '.join(a[i1:i2]), ' '.join(b[j1:j2]), ctx]) + '\n')


if __name__ == '__main__':
    main(*sys.argv[1:])
