#!/usr/bin/env python3
"""Тлумачення Псалтиря Євфимія Зигабена українською — дані для src/data/tlum/.

Джерело (російський переклад): http://mediaglagol.com.ua/book/tolkovaya_psaltir — сторінка на кожен псалом.
Український переклад лежить у scripts/zigaben/uk/NNN.txt (NNN — номер псалма за грецькою/слов’янською нумерацією):

    @0            — вступ до псалма (надписання, загальний зміст); @3, @3-5, @1,2 — вірш(і), до яких тлумачення
    >текст вірша  — цитата вірша (необов’язково)
    абзац         — кожен рядок — окремий абзац тлумачення

Використання:
    python3 -I scripts/build_tlumach.py fetch <cache-dir>   # завантажити сторінки й розібрати на <cache-dir>/ru/NNN.txt (той самий формат)
    python3 -I scripts/build_tlumach.py build               # зібрати src/data/tlum/k<K>.ts та index.ts з перекладів
"""
import html
import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
UK = os.path.join(HERE, 'zigaben', 'uk')
OUT = os.path.join(ROOT, 'src', 'data', 'tlum')
BASE = 'http://mediaglagol.com.ua'

# Кафизми (як KATH у src/data/prayerLists.ts): тлумачення кожної кафизми — окремий модуль, що завантажується за потреби.
KATH = [(1, 8), (9, 16), (17, 23), (24, 31), (32, 36), (37, 45), (46, 54), (55, 63), (64, 69), (70, 76),
        (77, 84), (85, 90), (91, 100), (101, 104), (105, 108), (109, 117), (118, 118), (119, 133), (134, 142), (143, 151)]


def kath_of(n):
    return next(k for k, (a, b) in enumerate(KATH, 1) if a <= n <= b)


# ---------- завантаження й розбір джерела ----------

HDR = re.compile(r'^(?:\d+\.\s*\(слав\.\s*перевод\s*[–-]\s*)?Пс\.?\s*(\d+)\s*:\s*(\d+(?:\s*[-–—,]\s*\d+)*)\s*\)?\s*[.:]?\s*(.*)$', re.S)


def get(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read().decode('utf-8')


def to_lines(s):
    """HTML сторінки → рядки тексту; \x01…\x02 позначають жирний текст (ним виділено вірші)."""
    s = re.sub(r'(?is)<script.*?</script>', '', s)
    s = re.sub(r'(?i)<(b|strong)\b[^>]*>', '\x01', s)
    s = re.sub(r'(?i)</(b|strong)>', '\x02', s)
    s = re.sub(r'(?i)<br\s*/?>|</?(div|p|h\d|li|ul|ol|table|tr|td)\b[^>]*>', '\n', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s).replace('\xa0', ' ')
    out = []
    for line in s.split('\n'):
        line = re.sub(r'[ \t]+', ' ', line).strip()
        if line.replace('\x01', '').replace('\x02', '').strip():
            out.append(line)
    return out


def fetch(cache):
    os.makedirs(os.path.join(cache, 'html'), exist_ok=True)
    os.makedirs(os.path.join(cache, 'ru'), exist_ok=True)
    idx = get(BASE + '/book/tolkovaya_psaltir')
    pages = re.findall(r'href="/book/(psalom_[^"]+)"[^>]*>Псалом (\d+)', idx)
    res = {n: [] for n in range(1, 152)}
    for slug, n in pages:
        n = int(n)
        path = os.path.join(cache, 'html', f'{n:03}.html')
        if not os.path.exists(path):
            open(path, 'w', encoding='utf-8').write(get(f'{BASE}/book/{slug}'))
        h = open(path, encoding='utf-8').read()
        a = h.index('<div class="text">') + len('<div class="text">')
        body = h[a:h.index('к оглавлению', a)]
        # Сторінка одного псалма може містити й вірші іншого (напр. «Псалом 10 у євреїв» — це Пс. 9:22–39):
        # розкладаємо за номером псалма з заголовка вірша.
        cur, pre = None, []
        for line in to_lines(body):
            plain = line.replace('\x01', '').replace('\x02', '').strip()
            m = HDR.match(plain)
            bold = line.startswith('\x01') or (0 <= line.find('\x01') < 15 and len(plain) < 400)
            if m and bold and len(plain) < 600:
                p, v = int(m.group(1)), re.sub(r'\s', '', m.group(2)).replace('–', '-').replace('—', '-')
                if cur:
                    res[cur['ps']].append(cur)
                if pre:
                    res[p].append({'ps': p, 'v': '0', 'h': '', 't': pre})
                    pre = []
                cur = {'ps': p, 'v': v, 'h': m.group(3).strip().lstrip('.').strip(), 't': []}
            elif cur is None:
                pre.append(plain)
            else:
                cur['t'].append(plain)
        if cur:
            res[cur['ps']].append(cur)
        if pre:
            res[n].append({'ps': n, 'v': '0', 'h': '', 't': pre})
    for n, segs in res.items():
        if segs:
            open(os.path.join(cache, 'ru', f'{n:03}.txt'), 'w', encoding='utf-8').write(dump(segs))


def dump(segs):
    out = []
    for x in segs:
        out.append('@' + x['v'])
        if x['h']:
            out.append('>' + x['h'])
        out.extend(x['t'])
    return '\n'.join(out) + '\n'


# ---------- збирання даних застосунку ----------

def parse(path):
    segs = []
    for line in open(path, encoding='utf-8').read().split('\n'):
        line = line.strip()
        if not line:
            continue
        if line[0] == '@':
            v = line[1:].strip().replace('–', '-')
            if not re.fullmatch(r'\d+(?:[-,]\d+)*', v):
                sys.exit(f'{path}: хибний номер вірша «{line}»')
            segs.append({'v': v, 't': []})
        elif not segs:
            sys.exit(f'{path}: текст до першого @')
        elif line[0] == '>':
            segs[-1]['h'] = line[1:].strip()
        else:
            segs[-1]['t'].append(line)
    return segs


def verses(v):
    """'3-5' → [3, 4, 5]; '1,2' → [1, 2]."""
    a = [int(x) for x in re.split(r'[-,]', v)]
    return list(range(a[0], a[-1] + 1)) if '-' in v else a


def build():
    os.makedirs(OUT, exist_ok=True)
    data, index = {}, {}
    for f in sorted(os.listdir(UK)):
        m = re.fullmatch(r'(\d{3})\.txt', f)
        if not m:
            continue
        n = int(m.group(1))
        segs = parse(os.path.join(UK, f))
        data.setdefault(kath_of(n), {})[n] = segs
        index[n] = sorted({x for s in segs for x in verses(s['v'])})
    head = ('// Тлумачення Псалтиря Євфимія Зигабена (переклад українською з російського видання) — '
            'http://mediaglagol.com.ua/book/tolkovaya_psaltir\n'
            '// Файл згенеровано scripts/build_tlumach.py з scripts/zigaben/uk/, не правте вручну.\n')
    for f in os.listdir(OUT):
        if re.fullmatch(r'k\d+\.ts', f):
            os.remove(os.path.join(OUT, f))
    for k, ps in sorted(data.items()):
        body = json.dumps({str(n): ps[n] for n in sorted(ps)}, ensure_ascii=False, separators=(',', ':'))
        open(os.path.join(OUT, f'k{k}.ts'), 'w', encoding='utf-8').write(
            head + "import type { TlumPsalms } from './index';\n"
            f'// Кафизма {k}: псалми {KATH[k - 1][0]}–{KATH[k - 1][1]}.\n'
            f'export const Z: TlumPsalms = {body};\n')
    loaders = '\n'.join(f'  {k}: () => import(\'./k{k}\'),' for k in sorted(data))
    idx = json.dumps({str(n): index[n] for n in sorted(index)}, ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(OUT, 'index.ts'), 'w', encoding='utf-8').write(
        head +
        '/** Тлумачення одного місця: v — вірш(і) («0» — вступ до псалма, «3-5», «1,2»), h — цитата вірша, t — абзаци. */\n'
        'export interface TlumSeg {\n  v: string;\n  h?: string;\n  t: string[];\n}\n'
        'export type TlumPsalms = Record<string, TlumSeg[]>;\n\n'
        f'export const KATH_RANGE: [number, number][] = {json.dumps([list(r) for r in KATH])};\n'
        '/** Псалми з тлумаченням і вірші, до яких воно є (0 — вступ). */\n'
        f'export const TL: Record<string, number[]> = {idx};\n'
        '/** Модулі з текстами тлумачень за кафизмами. */\n'
        f'export const TL_LOAD: Record<number, () => Promise<{{ Z: TlumPsalms }}>> = {{\n{loaders}\n}};\n')
    print(f'псалмів: {len(index)}, місць: {sum(len(v) for k in data.values() for v in k.values())}')


if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == 'fetch':
        fetch(sys.argv[2])
    elif len(sys.argv) == 2 and sys.argv[1] == 'build':
        build()
    else:
        sys.exit(__doc__)
