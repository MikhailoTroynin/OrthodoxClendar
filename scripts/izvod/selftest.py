#!/usr/bin/env python3
"""Самоперевірка check.py на еталоні: кожну книгу віра.укр перевіряємо словником, зібраним БЕЗ неї
(перехресна перевірка). Тексти віра.укр вичитані вручну, тож усе, що check.py у них позначить як помилку, —
хибне спрацювання (або описка на сайті). Потрібен кеш crawl_gold.py.

  python3 -I scripts/izvod/selftest.py <каталог_кешу>
"""
import json, os, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import check  # noqa: E402
import crawl_gold as cg  # noqa: E402
from izvodlib import words_of, plain  # noqa: E402


def main(cache):
    index = json.load(open(os.path.join(cache, 'index.json')))
    paras = {}
    for b, p in index:
        h = cg.get(cache, cg.H + b + ('/' + p if p else ''))
        paras.setdefault(b, []).extend(cg.page_text(h))
    ck = check.Checker()
    full_uni, full_bi, full_acc = dict(ck.uni), dict(ck.bi), dict(ck.gacc)
    tot_w = tot_e = 0
    codes = Counter(); examples = []
    for b, ps in paras.items():
        own = Counter()
        for t in ps:
            for w in words_of(t):
                own[plain(w)] += 1
        # словник без цієї книги: частоти віднімаємо; слова лише з цієї книги зникають з корпусу
        ck.uni = {k: v - own.get(k, 0) for k, v in full_uni.items() if v - own.get(k, 0) > 0}
        ck.gacc = {k: v for k, v in full_acc.items() if k in ck.uni}
        ck.sk = check.defaultdict(list)
        for k in ck.uni:
            ck.sk[check.skel(k)].append(k)
        for k, n in ck.der.items():
            if n >= 2 and k not in ck.uni:
                ck.sk[check.skel(k)].append(k)
        nw = ne = 0
        for t in ps:
            ws = words_of(t)
            if not check.is_cs(t, ws):
                continue
            nw += len(ws)
            for i, code, sug, why, sev in ck.check_para(ws):
                if sev == 'error':
                    ne += 1; codes[code] += 1
                    if len(examples) < 60:
                        examples.append(f'{b}: {ws[i]} → {sug} [{code}] …{" ".join(ws[max(0, i - 4):i + 4])}…')
        tot_w += nw; tot_e += ne
        print(f'{b:28} слів {nw:7}  позначено {ne:4}  ({100 * ne / max(nw, 1):.3f} %)')
    print(f'усього слів {tot_w}, позначено {tot_e} ({100 * tot_e / max(tot_w, 1):.3f} %)', dict(codes.most_common()))
    for e in examples:
        print(' ', e)


if __name__ == '__main__':
    main(sys.argv[1])
