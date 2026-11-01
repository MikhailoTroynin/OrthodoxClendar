#!/usr/bin/env python3
"""Звіт про наголоси в ЦС-текстах додатка (лише для вичитки — нічого не змінює).

  python3 -I scripts/izvod/accents.py                 # підсумок у консоль
  python3 -I scripts/izvod/accents.py --md звіт.md    # повний звіт

Що в звіті:
  1. Наголос, який розходиться з корпусом віра.укр там, де корпус одностайний: форма трапляється в еталоні
     щонайменше MIN разів (за замовчуванням 5), і всі вживання мають той самий наголос.
     Омографи з різним наголосом (ру́ки/руки́, мно́ю) корпус не дає одностайно, тож вони сюди не потрапляють.
  2. ЦС-абзаци з наголосами, де без наголосу лишилося багато багатоскладових слів (частково наголошені абзаци).
  3. ЦС-абзаци зовсім без наголосів (наприклад, «Ра́дуйся, горделивих жен пред супругами смирительнице» — один наголос).
  4. Найчастіші багатоскладові слова без наголосу в абзацах із наголосами.
"""
import argparse, os, re, sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from izvodlib import ACC, words_of, plain, sources, units, book_titles  # noqa: E402
import check  # noqa: E402

VOW = set('аеєиіїоуюяАЕЄИІЇОУЮЯ')


def nsyl(w):
    return sum(c in VOW for c in w)


def acc_pos(w):
    """Номер наголошеної голосної (з 0) або None."""
    k = 0
    for i, c in enumerate(w):
        if c in VOW:
            if i + 1 < len(w) and w[i + 1] == ACC:
                return k
            k += 1
    return None


def run(MIN=5):
    ck = check.Checker()
    gold = {}
    for p, forms in ck.gacc.items():
        pos = Counter()
        for f, n in forms.items():
            if f.count(ACC) == 1:
                pos[acc_pos(f)] += n
        if pos and sum(pos.values()) >= MIN and len(pos) == 1:
            gold[p] = (next(iter(pos)), sum(pos.values()), max(forms, key=forms.get))
    mism = defaultdict(list)
    partial, noacc = [], []
    unacc = Counter(); unacc_ex = {}
    stat = Counter()
    for sid, fname, is_gold in sources():
        titles = book_titles(fname)
        for path, kind, text in units(sid, fname):
            if kind != 't':
                continue
            ws = words_of(text)
            if not check.is_cs(text, ws, ck.known):
                continue
            book = titles.get(path.split('/')[0], '')
            multi = [w for w in ws if nsyl(w) > 1]
            withacc = [w for w in multi if ACC in w]
            stat['paras'] += 1
            if multi and not withacc and len(multi) >= 5:
                noacc.append((sid, path, book, text[:140]))
                stat['noacc'] += 1
            elif withacc and len(multi) >= 8 and len(withacc) < 0.6 * len(multi):
                partial.append((sid, path, book, len(withacc), len(multi), text[:140]))
                stat['partial'] += 1
            for i, w in enumerate(ws):
                p = plain(w)
                if ACC in w:
                    stat['acc-words'] += 1
                    g = gold.get(p)
                    if g and w.count(ACC) == 1 and acc_pos(w.lower()) != g[0]:
                        ctx = ' '.join(ws[max(0, i - 4):i]) + ' [' + w + '] ' + ' '.join(ws[i + 1:i + 4])
                        mism[(p, w.lower())].append((sid, path, book, g, ctx))
                elif withacc and nsyl(w) > 1:
                    unacc[p] += 1
                    unacc_ex.setdefault(p, (sid, path))
    return mism, partial, noacc, unacc, unacc_ex, stat


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--md')
    ap.add_argument('--min', type=int, default=5)
    a = ap.parse_args()
    mism, partial, noacc, unacc, unacc_ex, stat = run(a.min)
    nm = sum(len(v) for v in mism.values())
    print(f"ЦС-абзаців: {stat['paras']}, наголошених слів: {stat['acc-words']}")
    print(f"наголос не як у одностайному корпусі віра.укр (≥{a.min} вживань): {nm} місць, {len(mism)} форм")
    print(f"абзаців без наголосів: {stat['noacc']}, частково наголошених: {stat['partial']}, "
          f"слів без наголосу в наголошених абзацах: {sum(unacc.values())}")
    if not a.md:
        return
    L = ['# Наголоси: звіт для вичитки', '',
         'Згенеровано `scripts/izvod/accents.py`. Нічого не виправлено автоматично: наголоси в джерелах (зокрема в новіших акафістах)',
         'можуть свідомо відрізнятися, а корпус віра.укр — лише орієнтир.', '',
         f"ЦС-абзаців: {stat['paras']}; наголошених слів: {stat['acc-words']}.", '',
         f'## 1. Наголос не такий, як в одностайному корпусі віра.укр (≥ {a.min} вживань, усі з одним наголосом)', '',
         f'{nm} місць, {len(mism)} форм. Формат: у тексті → у корпусі (кількість у корпусі) · джерело · контекст.', '']
    for (p, w), rows in sorted(mism.items(), key=lambda t: -len(t[1])):
        sid, path, book, g, ctx = rows[0]
        srcs = Counter(r[0].split('/')[0] for r in rows)
        L.append(f"- **{w}** → {g[2]} ({g[1]}) · {len(rows)}× · " + ', '.join(f'{k} {n}' for k, n in srcs.most_common())
                 + f" · {book[:40]} {sid} {path} · …{ctx}…")
    L += ['', '## 2. Частково наголошені ЦС-абзаци (наголос мають < 60 % багатоскладових слів)', '']
    for sid, path, book, k, n, t in partial:
        L.append(f'- `{sid}` {path} · {book[:50]} · {k}/{n} · {t}')
    L += ['', '## 3. ЦС-абзаци без наголосів (≥ 5 багатоскладових слів)', '']
    for sid, path, book, t in noacc:
        L.append(f'- `{sid}` {path} · {book[:50]} · {t}')
    L += ['', '## 4. Найчастіші багатоскладові слова без наголосу в абзацах із наголосами', '']
    L += [', '.join(f'{w} {n}' for w, n in unacc.most_common(400))]
    open(a.md, 'w', encoding='utf-8').write('\n'.join(L) + '\n')


if __name__ == '__main__':
    main()
