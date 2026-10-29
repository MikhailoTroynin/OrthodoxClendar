#!/usr/bin/env python3
"""Порівнює молитви з azbyka.ru/molitvoslov (кеш від crawl.py) із текстами додатка.

Використання: python3 -I scripts/azbyka/compare.py <каталог-кешу> [каталог src/data]
Пише <кеш>/units.json (усі уривки сторінок із покриттям) і <кеш>/REPORT.md.

Одиниця порівняння — уривок сторінки під одним заголовком (h2–h4) або вступ сторінки без заголовка.
Уривок «є в додатку», якщо більшість його четвірок слів (у «скелетному» написанні, де стерто різницю
між російським, церковнослов'янським і українським правописом) трапляється в текстах додатка.
Сучасні російські молитви в додатку є лише в перекладі, тому для них збігу за словами не буде:
вони потрапляють у «немає» разом із мовою «ru», а перекладач вирішує, що з ними робити.
"""
import glob, hashlib, html, json, os, re, sys, unicodedata
from collections import Counter

ACC = '́'
W = re.compile(r"[а-яіїєґёѣѡꙋѵѳѧѩѫѭꙗꙁꙃꙅꙉꙕꙑ']+", re.I)
MAP = {'ё': 'и', 'е': 'и', 'і': 'и', 'ї': 'и', 'є': 'и', 'ы': 'и', 'э': 'и', 'ѣ': 'и', 'ѵ': 'и', 'ѡ': 'о', 'ꙋ': 'у',
       'ѳ': 'ф', 'ѧ': 'я', 'ꙗ': 'я', 'ґ': 'г', 'ъ': '', 'ь': '', "'": '', '’': '', 'ʼ': ''}


def skel(word):
    w = word.lower()
    w = ''.join(MAP.get(c, c) for c in w)
    w = re.sub(r'(.)\1+', r'\1', w)  # благословенни / благословенны
    w = re.sub(r'ъ?я$', 'а', w) if len(w) > 4 else w  # -ия/-іа тощо: стерти різницю я/а на кінці
    return w


def words(text):
    text = unicodedata.normalize('NFC', text.replace(ACC, ''))
    return [skel(w) for w in W.findall(text)]


def shingles(ws, n=4):
    return [hashlib.md5(' '.join(ws[i:i + n]).encode()).digest()[:6] for i in range(len(ws) - n + 1)]


def app_corpus(data_dir):
    """Множина хешів четвірок слів з усіх текстів додатка (без Біблії й тлумачень)."""
    s = set()
    files = [f for f in glob.glob(data_dir + '/**/*.ts', recursive=True)
             if '/bible/' not in f and '/tlum/' not in f and 'calendar' not in f]
    for f in files:
        txt = open(f, encoding='utf-8').read()
        # кожен рядок JSON/TS окремо, щоб четвірки не склеювали сусідні абзаци
        for m in re.finditer(r'"((?:[^"\\]|\\.)*)"|\'((?:[^\'\\]|\\.)*)\'', txt):
            piece = m.group(1) or m.group(2) or ''
            if len(piece) > 20:
                s.update(shingles(words(piece), 3))
    return s, len(files)


# ---------- розбір сторінки ----------
def strip(s):
    return html.unescape(re.sub(r'[ \t\r\f]+', ' ', re.sub(r'<[^>]+>', '', s)))


def article(h):
    i = h.find('article-single-content')
    if i < 0:
        return ''
    j = h.find('</article>', i)
    a = h[i:j if j > 0 else None]
    a = re.sub(r'<script.*?</script>|<style.*?</style>|<noscript.*?</noscript>', '', a, flags=re.S)
    a = re.sub(r'<div class="bg_forreaders">.*?</div></div>', '', a, flags=re.S)
    a = re.sub(r'<div class="audioframe">.*?<div style="clear: both;">', '', a, flags=re.S)
    a = re.sub(r'<div id="mainogl">.*?</ul>\s*</div>', '', a, flags=re.S)
    a = re.sub(r'<span class="thin">.*?</span>', '', a, flags=re.S)  # виноски
    return a


def units(h, title):
    """Уривки сторінки; заголовок — ланцюжок h2 / h3 / h4 («Амвросию Оптинскому / глас 5»)."""
    a = article(h)
    parts = re.split(r'(<h[2-4][^>]*>.*?</h[2-4]>)', a, flags=re.S)
    out, chain = [], {}
    for i, p in enumerate(parts):
        if i % 2:
            lv = int(p[2])
            t = re.sub(r'\s+', ' ', strip(p)).strip().lstrip('^ ').rstrip(',:;')
            t = re.sub(r'(?<=[^\d\s])\d{1,2}$', '', t).strip()  # виноски, що злиплися із заголовком
            chain = {k: v for k, v in chain.items() if k < lv}
            chain[lv] = t
            continue
        paras = []
        for m in re.finditer(r'<p[^>]*>(.*?)</p>|<blockquote[^>]*>(.*?)</blockquote>', p, flags=re.S):
            t = re.sub(r'[ \t]*\n[ \t]*', '\n', strip(m.group(1) or m.group(2) or '')).strip()
            if t and t != '* * *':
                paras.append(t)
        if paras:
            out.append({'head': ' / '.join(chain[k] for k in sorted(chain)) or title, 'paras': paras})
    return out


CSM = re.compile(r'\b(яко|аще|еси|мя|тя|ми|ти|вся|сей|иже|паки|убо|ныне|присно|веки|рабы|во|ко|ихже)\b', re.I)
RUS = re.compile(r'\b(что|чтобы|который|которая|которые|этот|это|эти|меня|тебя|себя|пожалуйста|очень|только|если|быть|может|будет)\b', re.I)


def lang(text):
    """cs — церковнослов'янський (з наголосами або з ЦС-ознаками), tr — переклад («Перевод: …»), ru — решта."""
    n = max(1, len(W.findall(text)))
    if re.match(r'\s*(Перевод|Русский перевод|Перевод на русский)\b', text):
        return 'tr'
    if text.count(ACC) / n > 0.12:
        return 'cs'
    cs, ru = len(CSM.findall(text)), len(RUS.findall(text))
    return 'cs' if cs > 2 * ru + 1 else 'ru'


def main(cache, data_dir):
    idx = json.load(open(cache + '/index.json', encoding='utf-8'))
    corpus, nfiles = app_corpus(data_dir)
    print('корпус додатка:', nfiles, 'файлів,', len(corpus), 'четвірок')
    res = []
    for e in idx:
        p = f"{cache}/pages/{e['id']}.html"
        if not os.path.exists(p):
            res.append({**e, 'units': [], 'external': True})
            continue
        us = []
        for u in units(open(p, encoding='utf-8').read(), e['title']):
            cs = [t for t in u['paras'] if lang(t) == 'cs']
            ru = [t for t in u['paras'] if lang(t) == 'ru']
            # церковнослов'янська частина: якщо її мало, уривок вважаємо російським
            kind = 'cs' if sum(len(t) for t in cs) >= sum(len(t) for t in ru) else 'ru'
            text = '\n'.join(cs if kind == 'cs' else ru)
            ws = words(text)
            sh = shingles(ws, 3)
            cov = sum(1 for x in sh if x in corpus) / len(sh) if sh else None
            us.append({'head': u['head'], 'words': len(ws), 'cov': None if cov is None else round(cov, 2),
                       'lang': kind, 'text': text, 'orig': '\n'.join(u['paras'])})
        res.append({**e, 'units': us})
    json.dump(res, open(cache + '/units.json', 'w', encoding='utf-8'), ensure_ascii=False)
    report(cache, res)


def status(u):
    if u['words'] < 25 or u['cov'] is None:
        return 'short'
    return 'have' if u['cov'] >= 0.55 else 'part' if u['cov'] >= 0.35 else 'miss'


def report(cache, res):
    c = Counter()
    lines = []
    for e in res:
        us = [u for u in e['units'] if status(u) != 'short']
        for u in us:
            c[status(u)] += 1
        if e.get('external'):
            lines.append(f"- **{e['cat']} / {e['title']}** — зовнішнє посилання {e['url']}")
            continue
        bad = [u for u in us if status(u) != 'have']
        if bad:
            lines.append(f"- **{e['cat']}{' / ' + e['sub'] if e['sub'] else ''} / {e['title']}** — {e['url']}")
            for u in bad:
                lines.append(f"    - {status(u)} {u['cov']:.2f} · {u['words']} сл. · {u['lang']} · {u['head']}")
    out = ['# Порівняння azbyka.ru/molitvoslov з додатком', '',
           f"Уривків: є {c['have']}, частково {c['part']}, немає {c['miss']} (без коротких, < 25 слів).", '', *lines]
    open(cache + '/REPORT.md', 'w', encoding='utf-8').write('\n'.join(out))
    print(dict(c))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'src/data')
