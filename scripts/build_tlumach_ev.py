#!/usr/bin/env python3
"""Тлумачення Євангелія блж. Феофілакта Болгарського українською — дані для src/data/tlumEv/.

Джерело (російський переклад): https://azbyka.ru/otechnik/Feofilakt_Bolgarskij/ — «Толкование на Евангелие от Матфея / Марка / Луки / Иоанна».
Український переклад лежить у scripts/feofilakt/uk/<книга>/NN.txt (книга: mt, mk, lk, jn; NN — глава, 01…28):

    @0            — вступ (до глави 1 — передмова до Євангелія); @3, @3-5, @1,2 — вірш(і), до яких тлумачення
    >текст        — цитата, яку тлумачать: вірш або його частина (необов’язково)
    абзац         — кожен рядок — окремий абзац тлумачення

Використання:
    python3 -I scripts/build_tlumach_ev.py fetch <cache-dir>   # завантажити книги й розібрати на <cache-dir>/ru/<книга>/NN.txt (той самий формат)
    python3 -I scripts/build_tlumach_ev.py build               # зібрати src/data/tlumEv/ з перекладів
"""
import html
import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
UK = os.path.join(HERE, 'feofilakt', 'uk')
OUT = os.path.join(ROOT, 'src', 'data', 'tlumEv')
BASE = 'https://azbyka.ru/otechnik'
# книга → (id книги на azbyka.ru, slug сторінки, скорочення в посиланнях джерела)
BOOKS = {
    'mt': (10747, 'tolkovanie-na-evangelie-ot-matfeja', 'Мф'),
    'mk': (10748, 'tolkovanie-na-evangelie-ot-marka', 'Мк'),
    'lk': (10749, 'tolkovanie-na-evangelie-ot-luki', 'Лк'),
    'jn': (10750, 'tolkovanie-na-evangelie-ot-ioanna', 'Ин'),
}
CHAPS = {'mt': 28, 'mk': 16, 'lk': 24, 'jn': 21}
# індекс книги в src/data/bible/books.ts
BIBLE_IDX = {'mt': 'matt', 'mk': 'mark', 'lk': 'luke', 'jn': 'john'}


def get(url):
    with urllib.request.urlopen(url, timeout=180) as r:
        return r.read().decode('utf-8')


def clean(s):
    s = re.sub(r'(?is)<script.*?</script>', '', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s).replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', s).strip()


def notes_of(h):
    """Примітки редакції сайту: {n: текст}; у тексті їх позначає зірочка з посиланням #footnoteN."""
    out = {}
    for m in re.finditer(r'(?s)<div class="note">\s*<a href="#footnote(\d+)_return">.*?<p class="txt">(.*?)</p>\s*</div>', h):
        t = clean(m.group(2))
        t = re.sub(r'\s*[–—-]\s*Редакция «Азбуки Веры»\.?$', '', t).rstrip('.') + '.'
        out[m.group(1)] = t
    return out


def inline(s, notes):
    """Абзац HTML → текст; примітки редакції вставлено в дужки: (… — Прим. ред.)."""
    s = re.sub(r'<a href="#footnote(\d+)"[^>]*>.*?</a>', lambda m: '\x03%s\x03' % m.group(1), s, flags=re.S)
    t = clean(s)
    t = re.sub('\x03(\\d+)\x03', lambda m: ' (%s — Прим. ред.)' % notes[m.group(1)].rstrip('.') if m.group(1) in notes else '', t)
    return re.sub(r'\s+([,.;:!?»)])', r'\1', t).replace('( ', '(')


def parse(h, book):
    """HTML книги → {глава: [[вірші, цитата, [абзаци]], …]}; главу визначають за посиланням у заголовку вірша (Мф.13:33)."""
    ab = BOOKS[book][2]
    notes = notes_of(h)
    h = re.sub(r'(?s)<div class="note">.*?</div>', '', h)
    h = re.sub(r'(?s)<p class="h2">.*?</p>|<p class="after-text-vignette">.*?</p>', '', h)
    out, cur, ch = {}, None, 0
    for t in re.findall(r'(?s)<p class="h5">.*?</p>|<p class="txt">.*?</p>', h):
        if t.startswith('<p class="h5"'):
            s = inline(t, notes)
            m = re.match(r'^' + ab + r'\.\s*(\d+)\s*:\s*(\d+(?:\s*[-–—,]\s*\d+)*)\.?\s*(.*)$', s)
            if m:
                ch = int(m.group(1))
                v = re.sub(r'\s+', '', m.group(2)).replace('–', '-').replace('—', '-')
                cur = [v, m.group(3), []]
            else:
                # продовження вірша (його наступна частина): той самий вірш, нова цитата
                cur = [cur[0] if cur else '0', s, []]
            out.setdefault(ch, []).append(cur)
        else:
            if cur is None:
                continue
            cur[2].append(inline(t, notes))
    # Вірші без власного тлумачення — разом із наступним: «Мк.1:1–3» (цитату зберігаємо лише для одного вірша).
    num = lambda v, i: int(re.split(r'[-,]', v)[i])
    for c, segs in out.items():
        merged, pend = [], None
        for sg in segs:
            if not sg[2]:
                if pend is None:
                    pend = [sg[0], sg[0], sg[1]]
                elif pend[1] == sg[0]:
                    pend[2] = (pend[2] + ' ' + sg[1]).strip()
                else:
                    pend = [pend[0], sg[0], '']
                continue
            if pend:
                if pend[1] == sg[0]:
                    sg[1] = (pend[2] + ' ' + sg[1]).strip()
                    sg[0] = pend[0]
                else:
                    sg[0] = '%d-%d' % (num(pend[0], 0), num(sg[0], -1))
                    sg[1] = ''
                pend = None
            merged.append(sg)
        out[c] = merged
    return out


def preface(h):
    a, b = h.index('id="selectable-content"'), h.index('id="book-chapters"')
    seg = h[a:b]
    notes = {}
    ps = [inline(p, notes) for p in re.findall(r'(?s)<p class="txt">.*?</p>', seg)]
    return [p for p in ps if not re.fullmatch(r'Глава[\d ]+', p)]  # рядок переходу по главах


def split(segs, limit=70000):
    """Велику главу ділимо на частини (≤ limit байтів) по межах сегментів — для окремих перекладачів."""
    size = lambda sg: sum(len(x.encode()) for x in [sg[1]] + sg[2])
    parts, cur, n = [], [], 0
    for sg in segs:
        if cur and n + size(sg) > limit:
            parts.append(cur)
            cur, n = [], 0
        cur.append(sg)
        n += size(sg)
    return parts + [cur]


def write_txt(path, segs):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        for v, q, ps in segs:
            f.write('@%s\n' % v)
            if q:
                f.write('>%s\n' % q)
            for p in ps:
                f.write(p + '\n')


def fetch(cache):
    for book, (bid, slug, _) in BOOKS.items():
        main = get('%s/Feofilakt_Bolgarskij/%s/' % (BASE, slug))
        body = json.loads(get('%s/ajax/book/load-chapter/%d/1' % (BASE, bid)))['html']
        os.makedirs(os.path.join(cache, 'html'), exist_ok=True)
        open(os.path.join(cache, 'html', book + '.html'), 'w', encoding='utf-8').write(body)
        res = parse(body, book)
        pre = preface(main)
        res.setdefault(1, []).insert(0, ['0', '', pre])
        miss = [c for c in range(1, CHAPS[book] + 1) if c not in res]
        print(book, 'глав', len(res), 'відсутні', miss, 'сегментів', sum(len(v) for v in res.values()))
        for c, segs in res.items():
            for i, part in enumerate(split(segs), 1):
                write_txt(os.path.join(cache, 'ru', book, '%02d.txt' % c if i == 1 and len(part) == len(segs) else '%02d.%d.txt' % (c, i)), part)


# ---------- збирання ----------

def read_txt(path):
    segs, cur = [], None
    for line in open(path, encoding='utf-8').read().split('\n'):
        if not line.strip():
            continue
        if line.startswith('@'):
            cur = {'v': line[1:].strip(), 't': []}
            segs.append(cur)
        elif line.startswith('>'):
            cur['h'] = line[1:].strip()
        else:
            cur['t'].append(line.strip())
    return segs


def covers(v):
    out = []
    for part in v.split(','):
        a = [int(x) for x in part.split('-')]
        out += list(range(a[0], a[-1] + 1))
    return out


def build():
    """src/data/tlumEv/: index.ts (TE — вірші з тлумаченням, TE_LOAD — завантажувачі) і <книга>/<глава>.ts."""
    import shutil
    shutil.rmtree(OUT, ignore_errors=True)
    te, load = {}, []
    for book in BOOKS:
        te[book] = {}
        for c in range(1, CHAPS[book] + 1):
            segs = []
            for fn in sorted(os.listdir(os.path.join(UK, book)) if os.path.isdir(os.path.join(UK, book)) else [], key=lambda x: (int(x.split('.')[0]), x)):
                if int(fn.split('.')[0]) == c:
                    segs += read_txt(os.path.join(UK, book, fn))
            if not segs:
                continue  # глава ще не перекладена
            te[book][c] = sorted({v for sg in segs for v in covers(sg['v'])})
            os.makedirs(os.path.join(OUT, book), exist_ok=True)
            with open(os.path.join(OUT, book, '%d.ts' % c), 'w', encoding='utf-8') as f:
                f.write('// Тлумачення блж. Феофілакта Болгарського, %s %d. Файл згенеровано scripts/build_tlumach_ev.py, не правте вручну.\n' % (BOOKS[book][2], c))
                f.write("import type { TlumSeg } from '../../tlum';\n")
                f.write('export const Z: TlumSeg[] = %s;\n' % json.dumps(segs, ensure_ascii=False, separators=(',', ':')))
            load.append("  '%s:%d': () => import('./%s/%d')," % (book, c, book, c))
    with open(os.path.join(OUT, 'index.ts'), 'w', encoding='utf-8') as f:
        f.write('// Тлумачення Євангелія блж. Феофілакта Болгарського (переклад українською з російського видання) — https://azbyka.ru/otechnik/Feofilakt_Bolgarskij/\n')
        f.write('// Файл згенеровано scripts/build_tlumach_ev.py з scripts/feofilakt/uk/, не правте вручну.\n')
        f.write("import type { TlumSeg } from '../tlum';\n")
        f.write('/** Книга Євангелія (slug з src/data/bible/books.ts) → код книги в TE. */\n')
        f.write('export const EV_BOOK: Record<string, string> = %s;\n' % json.dumps({v: k for k, v in BIBLE_IDX.items()}, separators=(',', ':')))
        f.write('/** Глави з тлумаченням і вірші, до яких воно є (0 — вступ). */\n')
        f.write('export const TE: Record<string, number[]> = %s;\n' % json.dumps({'%s:%d' % (b, c): v for b in te for c, v in te[b].items()}, separators=(',', ':')))
        f.write('/** Модулі з текстами тлумачень за главами. */\n')
        f.write('export const TE_LOAD: Record<string, () => Promise<{ Z: TlumSeg[] }>> = {\n' + '\n'.join(load) + '\n};\n')


if __name__ == '__main__':
    if sys.argv[1] == 'fetch':
        fetch(sys.argv[2])
    elif sys.argv[1] == 'build':
        build()
