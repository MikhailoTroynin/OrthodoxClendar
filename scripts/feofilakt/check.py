#!/usr/bin/env python3
"""Звіряє переклад з оригіналом: check.py <каталог ru> [книга…] — однакова будова (@, >, кількість абзаців), без російських літер.
Файли: <ru>/<книга>/NN[.P].txt ↔ scripts/feofilakt/uk/<книга>/NN[.P].txt"""
import os, re, sys
UK = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uk')
ru_dir = sys.argv[1]
books = sys.argv[2:] or ['mt', 'mk', 'lk', 'jn']
RU_ONLY = re.compile(r'[ыэъёЫЭЪЁ]')
bad = missing = 0
def shape(path):
    out = []
    for l in open(path, encoding='utf-8').read().split('\n'):
        if l.strip():
            out.append(l[:1] if l[0] in '@>' else '¶')
    return out
for b in books:
    for fn in sorted(os.listdir(os.path.join(ru_dir, b))):
        u = os.path.join(UK, b, fn)
        if not os.path.exists(u):
            missing += 1
            print('немає', b, fn)
            continue
        r = os.path.join(ru_dir, b, fn)
        errs = []
        a = open(r, encoding='utf-8').read().split('\n')
        c = open(u, encoding='utf-8').read().split('\n')
        a = [l for l in a if l.strip()]
        c = [l for l in c if l.strip()]
        if len(a) != len(c):
            errs.append('рядків %d ≠ %d' % (len(a), len(c)))
        for i, (x, y) in enumerate(zip(a, c), 1):
            if x[:1] in '@>' or y[:1] in '@>':
                if x[:1] != y[:1] or (x[:1] == '@' and x != y):
                    errs.append('рядок %d: %r ≠ %r' % (i, x[:25], y[:25]))
                    break
            if RU_ONLY.search(y):
                errs.append('рядок %d: російські літери: %s' % (i, RU_ONLY.search(y).group(0)))
                break
        tot = sum(len(x) for x in a)
        if tot and not errs and sum(len(x) for x in c) < 0.6 * tot:
            errs.append('переклад надто короткий: %d з %d знаків' % (sum(len(x) for x in c), tot))
        if errs:
            bad += 1
            print('ПОМИЛКА', b, fn, '; '.join(errs[:3]))
print('перевірено, помилок: %d, відсутніх: %d' % (bad, missing))
sys.exit(1 if bad or missing else 0)
