#!/usr/bin/env python3
"""Завантажує еталонні тексти Київського ізводу з віра.укр (усі книги *-cs-ukr, Слідуваний Псалтир)
у кеш і будує з них частотні таблиці для перевірки (scripts/izvod/data/gold.json.gz).

  python3 -I scripts/izvod/crawl_gold.py <каталог_кешу>            # завантажити (повторний запуск бере кеш)
  python3 -I scripts/izvod/crawl_gold.py <каталог_кешу> --build    # лише перебудувати таблиці з кешу

Таблиці: частоти словоформ (з наголосом і без) і біграми сусідніх слів.
Рубрики (червоний текст сучасною українською), заголовки й примітки до таблиць не потрапляють.
"""
import gzip, hashlib, json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from izvodlib import words_of, plain  # noqa: E402

H = 'https://xn--80ad6b1e.xn--j1amh/b/'
BOOKS = ['molytvoslov-cs-ukr', 'akafisty-cs-ukr', 'kanonnyk-cs-ukr', 'sluzhebnyk-cs-ukr', 'trebnyk-cs-ukr',
         'trebnyk-voyinskyi-cs-ukr', 'tropari-cs-ukr', 'shestopsalmiye-cs-ukr', 'psaltyr-sliduvany']
# сторінки з правилами транслітерації (там навмисно наведено ЦС-форми й неправильні приклади), вступи
SKIP = re.compile(r'pravyla|litera|bukvy|apostrof|prykmetnykovi|pryklady|kharakterni|vstup|peredmova')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'gold.json.gz')


def get(cache, url):
    f = os.path.join(cache, hashlib.md5(url.encode()).hexdigest() + '.html')
    if not os.path.exists(f) or os.path.getsize(f) < 1000:
        for _ in range(3):
            subprocess.run(['curl', '-sSL', '-m', '90', '-o', f, url])
            if os.path.exists(f) and os.path.getsize(f) >= 1000:
                break
    try:
        return open(f, encoding='utf-8', errors='ignore').read()
    except OSError:
        return ''


def crawl(cache):
    os.makedirs(cache, exist_ok=True)
    index = []
    for b in BOOKS:
        seen, frontier = set(), ['']
        while frontier:
            urls = [H + b + ('/' + p if p else '') for p in frontier]
            with ThreadPoolExecutor(8) as ex:
                res = list(ex.map(lambda u: get(cache, u), urls))
            new = []
            for p, h in zip(frontier, res):
                seen.add(p)
                for m in re.finditer(r'href="https://xn--80ad6b1e\.xn--j1amh/b/' + b + r'/([^?#"]+)"', h):
                    q = m.group(1).rstrip('/')
                    # /<розділ>/<число> — паралельний ЦС-текст, не потрібен
                    if re.search(r'/\d+$', q) or q in seen or q in new or SKIP.search(q):
                        continue
                    new.append(q)
            frontier = new
        pages = sorted(p for p in seen if p) or ['']  # однотомна книга — текст на головній сторінці
        index += [(b, p) for p in pages]
        print(b, len(pages), flush=True)
    json.dump(index, open(os.path.join(cache, 'index.json'), 'w'))
    return index


class P(HTMLParser):
    """Текст сторінки без рубрик (span.red), заголовків, приміток (sup) і службових блоків."""

    def __init__(s):
        super().__init__(convert_charrefs=True)
        s.on = False; s.skip = 0; s.red = 0; s.stack = []; s.paras = []; s.cur = []; s.hdr = 0

    def handle_starttag(s, t, a):
        a = dict(a)
        if t == 'h1':
            s.on = True; s.hdr += 1; return
        if not s.on:
            return
        if t in ('style', 'iframe', 'hide', 'script', 'sup', 'h2', 'h3', 'h4'):
            s.skip += 1
        if t in ('p', 'li', 'div', 'h2', 'h3', 'h4', 'br'):
            s.flush()
        if t == 'span':
            r = 'red' in (a.get('class') or '')
            s.stack.append(r); s.red += r

    def handle_endtag(s, t):
        if t == 'h1':
            s.hdr -= 1; return
        if not s.on:
            return
        if t in ('style', 'iframe', 'hide', 'script', 'sup', 'h2', 'h3', 'h4'):
            s.skip -= 1
        if t == 'span' and s.stack:
            s.red -= s.stack.pop()
        if t in ('p', 'li', 'div'):
            s.flush()

    def flush(s):
        # червона буквиця (1–2 літери впритул до слова) — частина тексту, решта червоного — рубрики
        out = []
        for i, (d, r) in enumerate(s.cur):
            if r:
                nx = s.cur[i + 1][0] if i + 1 < len(s.cur) else ''
                if not (len(d.strip()) <= 2 and d.strip().isalpha() and nx[:1].isalpha()):
                    out.append(' ')
                    continue
            out.append(d)
        txt = re.sub(r'\s+', ' ', ''.join(out)).strip()
        if txt:
            s.paras.append(txt)
        s.cur = []

    def handle_data(s, d):
        if s.on and not s.skip and not s.hdr:
            s.cur.append((d, s.red > 0))


def page_text(h):
    a = h.find('<h1')
    b = h.find('chapter-navigation-menu', a)
    if a < 0:
        return []
    p = P(); p.feed(h[a:b if b > 0 else len(h)]); p.flush()
    return p.paras


def build(cache):
    index = json.load(open(os.path.join(cache, 'index.json')))
    uni, acc, prev = {}, {}, {}
    nwords = 0
    for b, p in index:
        h = get(cache, H + b + ('/' + p if p else ''))
        for para in page_text(h):
            ws = [w for w in words_of(para)]
            pl = [plain(w) for w in ws]
            for i, w in enumerate(ws):
                k = pl[i]
                if not k:
                    continue
                nwords += 1
                uni[k] = uni.get(k, 0) + 1
                a = w.lower()
                if a != k:
                    d = acc.setdefault(k, {}); d[a] = d.get(a, 0) + 1
                if i:
                    key = pl[i - 1] + ' ' + k; prev[key] = prev.get(key, 0) + 1
    data = {'n': nwords, 'pages': len(index), 'uni': uni, 'acc': acc, 'bi': prev}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with gzip.open(OUT, 'wt', encoding='utf-8', compresslevel=9) as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    print('слів:', nwords, 'форм:', len(uni), 'біграм:', len(prev), '→', OUT)


if __name__ == '__main__':
    cache = sys.argv[1]
    if '--build' not in sys.argv:
        crawl(cache)
    build(cache)
