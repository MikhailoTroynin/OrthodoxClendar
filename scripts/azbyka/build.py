#!/usr/bin/env python3
"""Збирає молитви й тропарі azbyka.ru/molitvoslov, яких немає в додатку, у src/data/kz/az<N>.ts + azMeta.ts.

Використання:
  python3 -I scripts/azbyka/build.py <кеш> <каталог translit/scripts> <каталог виводу> [report.json]

Вхід:
  <кеш>/units.json              — уривки сторінок azbyka (scripts/azbyka/compare.py); ключ уривка — id сторінки # хеш початку тексту;
  manifest_cs.tsv               — що переносити транслітерацією (церковнослов'янські та церковно-російські тексти):
                                  ключ, режим (T), група, назва укр., назва англ., заголовок розділу (для книг з кількох уривків), коментар;
  manifest_ru.tsv               — сучасні російські тексти (режим R): ті самі стовпці, текст — переклад
                                  українською з translated/az_*.txt;
  tropari_titles.tsv            — тропарі: ключ, український заголовок розділу (книга = сторінка azbyka).
Транслітерація — навичка cs-kyiv-translit (Київський ізвод), з тими самими поправками, що в build_kz_akafisty.py.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE, TR, OUT = sys.argv[1:4]
REPORT = sys.argv[4] if len(sys.argv) > 4 else None
sys.argv = [sys.argv[0], 'unused.db', TR, OUT]  # build_kz_akafisty розбирає sys.argv при імпорті
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, 'kozlovskiy'))
import build_kz_akafisty as A  # noqa: E402
import rusc  # noqa: E402

# Групи в переліку «Додаткові молитви» (порядок = номер групи в azMeta.ts, див. prayers.ts: AZG)
GROUPS = 'BHLMUSWK'

# Сторінки з тропарями: (назва книги укр., англ.)
KBOOK = {
    'Тропари и кондаки Господские': ('Тропарі й кондаки Господні (додаткові)', 'Troparia and kontakia of the Lord (additional)'),
    'Тропари Богородичные': ('Тропарі й кондаки Богородичні (додаткові)', 'Troparia and kontakia of the Theotokos (additional)'),
    'Тропари и кондаки чудотворным иконам Пресвятой Богородицы': ('Тропарі іконам Пресвятої Богородиці (додаткові)', 'Troparia of the icons of the Theotokos (additional)'),
    'Тропари пророкам': ('Тропарі пророкам', 'Troparia of the prophets'),
    'Тропари апостолам': ('Тропарі апостолам', 'Troparia of the apostles'),
    'Тропари равноапостольным': ('Тропарі рівноапостольним', 'Troparia of the equals-to-the-apostles'),
    'Тропари святителям': ('Тропарі святителям', 'Troparia of the hierarchs'),
    'Тропари преподобным': ('Тропарі преподобним', 'Troparia of the venerable saints'),
    'Тропари великомученикам, священномученикам, преподобномученикам, мученикам': ('Тропарі мученикам', 'Troparia of the martyrs'),
    'Тропари бессребреникам': ('Тропарі безсрібникам', 'Troparia of the unmercenary healers'),
    'Тропари праведным и блаженным': ('Тропарі праведним і блаженним', 'Troparia of the righteous and the blessed'),
    'Тропари святым благоверным князьям и царям': ('Тропарі благовірним князям і царям', 'Troparia of the holy princes and kings'),
    'Тропари соборам святых': ('Тропарі соборам святих', 'Troparia of the synaxes of saints'),
    'Богородичны воскресные': ('Богородичні воскресні (на стиховні)', 'Sunday theotokia (at the aposticha)'),
    'Богородичны отпустительные': ('Богородичні відпустительні (на «Бог Господь»)', 'Dismissal theotokia (at “God is the Lord”)'),
    'Богородичны восьми гласов': ('Богородичні восьми гласів', 'Theotokia of the eight tones'),
}

# ---------------------------------------------------------------- «церковно-російські» слова (як у build_kz_molytvy.py)
_GEN_PREP = {'от', 'у', 'без', 'для', 'из', 'до', 'около', 'кроме', 'ради', 'после', 'против', 'вместо', 'мимо', 'из-за'}


def _w(word):
    return ''.join(re.escape(c) + ('́?' if c.isalpha() else '') for c in word)


_RUW = [
    (re.compile(r'(?<![А-Яа-яЁё́])((?:[А-Яа-яЁё]+[́]?\s+)?)(' + _w('меня') + r')(?![А-Яа-яЁё])', re.I), 'me'),
    (re.compile(r'(?<![А-Яа-яЁё])(' + _w('тебя') + r')(?![А-Яа-яЁё])', re.I), 'te'),
    (re.compile(r'(?<![А-Яа-яЁё])(' + _w('помоги') + r')(?![А-Яа-яЁё])', re.I), 'помози'),
    (re.compile(r'(?<![А-Яа-яЁё])(' + _w('которых') + r')(?![А-Яа-яЁё])', re.I), 'ихже'),
    (re.compile(r'(?<![А-Яа-яЁё])(' + _w('которую') + r')(?![А-Яа-яЁё])', re.I), 'юже'),
    (re.compile(r'(?<![А-Яа-яЁё])(' + _w('которому') + r')(?![А-Яа-яЁё])', re.I), 'Емуже'),
    (re.compile(r'(?<![А-Яа-яЁё])(' + _w('ведь') + r')(?![А-Яа-яЁё])', re.I), 'бо'),
]


def ru_words(t):
    def keep_case(src, rep):
        return rep[:1].upper() + rep[1:] if src[:1].isupper() else rep

    def me(m):
        pre = m.group(1) or ''
        prev = re.sub(r'[́\s]', '', pre).lower()
        return pre + keep_case(m.group(2), 'мене' if prev in _GEN_PREP else 'мя')

    for rx, how in _RUW:
        if how == 'me': t = rx.sub(me, t)
        elif how == 'te': t = rx.sub(lambda m: keep_case(m.group(1), 'тя'), t)
        else: t = rx.sub(lambda m: keep_case(m.group(1), how) if how[0].islower() else how, t)
    return t


# ---------------------------------------------------------------- читання вхідних даних
def tsv(name):
    p = os.path.join(HERE, name)
    return [l.rstrip('\n').split('\t') for l in open(p, encoding='utf8') if l.strip()] if os.path.exists(p) else []


def key_of(r):
    import hashlib
    return f"{r['id']}#{hashlib.md5(r['text'][:80].encode()).hexdigest()[:6]}"


UNITS = {}
for _e in json.load(open(CACHE + '/units.json', encoding='utf8')):
    for _u in _e['units']:
        _r = {'id': _e['id'], 'page': _e['title'], 'cat': _e['cat'], 'head': _u['head'], 'text': _u['text']}
        UNITS.setdefault(key_of(_r), _r)

# Переклади сучасних російських текстів українською: translated/az_*.txt — блоки «=== <ключ>» і абзаци (по одному в рядку);
# «=== <ключ> @N» замінює абзац N (з нуля) в тексті, що транслітерується (сучасний російський абзац серед церковнослов'янських); без рядків — прибирає абзац (переклад-дубль).
TRANSL, PARA = {}, {}
TD = os.path.join(HERE, 'translated')
if os.path.isdir(TD):
    for f in sorted(os.listdir(TD)):
        if re.fullmatch(r'az_.+\.txt', f):
            cur = None
            for line in open(os.path.join(TD, f), encoding='utf8'):
                line = line.rstrip('\n')
                m = re.match(r'=== (\S+?)(?: @(\d+))?\s*$', line)
                if m:
                    cur = (m[1], m[2])
                    if m[2] is None:
                        assert m[1] not in TRANSL, (f, m[1])
                        TRANSL[m[1]] = []
                    else:
                        PARA.setdefault(m[1], {})[int(m[2])] = []
                elif line.strip() and cur:
                    (TRANSL[cur[0]] if cur[1] is None else PARA[cur[0]][int(cur[1])]).append(line.strip())


def clean(line):
    line = line.replace('﻿', '').replace(' ', ' ')
    line = re.sub(r'\[\d+\]', '', line)  # виноски [1]
    line = re.sub(r'(?<=[А-Яа-яЁё́])\d{1,2}(?=[\s,.;:!?)»]|$)', '', line)  # виноски, що злиплися зі словом
    line = re.sub(r'(?<=[.,;:!?»])\d{1,2}(?=\s|$)', '', line)  # …або із розділовим знаком
    line = line.replace('*', '')  # позначки приміток
    if '«' in line and '»' not in line:  # лапки, що охоплюють кілька абзаців
        line = line.replace('«', '', 1) if line.startswith('«') else line
    elif '»' in line and '«' not in line:
        line = line[:line.rindex('»')] + line[line.rindex('»') + 1:]
    line = re.sub(r'\s+', ' ', line).strip()
    return line


def lines_of(r):
    return [x for x in (clean(l) for l in r['text'].split('\n')) if x]


REP = {'ru_paras': [], 'ambig': {}}


def translit_lines(lines, ident):
    """Рядки «гражданки» (з наголосами) → рядки Київського ізводу."""
    over = PARA.get(ident, {})
    flagged = [i for i, x in enumerate(lines) if rusc.is_ru(x) and i not in over]
    if flagged:
        REP['ru_paras'].append((ident, flagged))
    idx = [i for i in range(len(lines)) if i not in over]
    items = [('p', ru_words(lines[i])) for i in idx]
    secs, amb = A.convert(items, ident)
    REP['ambig'][ident] = len(amb)
    out = dict(zip(idx, secs[0]['ps']))
    for i, t in over.items():
        out[i] = ' '.join(t)
    return [out[i] for i in range(len(lines)) if out[i]]


# ---------------------------------------------------------------- збирання книг
books = []  # (група, назва, англ., [(заголовок розділу, [абзаци])])


def add_book(g, u, e, sec, ps):
    for b in books:
        if b[0] == g and b[1] == u:
            b[3].append((sec, ps)); return
    books.append((g, u, e, [(sec, ps)]))


for row in tsv('manifest_cs.tsv'):
    k, mode, g, u, e, sec = row[:6]
    r = UNITS[k]
    add_book(g, u, e, sec, translit_lines(lines_of(r), k))

for row in tsv('manifest_ru.tsv'):
    k, mode, g, u, e, sec = row[:6]
    assert k in UNITS, k
    if k not in TRANSL:
        print('НЕМАЄ ПЕРЕКЛАДУ:', k, u); continue
    add_book(g, u, e, sec, TRANSL[k])

# тропарі: книга = сторінка azbyka, розділ = святий
tt = {row[0]: row[1] for row in tsv('tropari_titles.tsv')}
kbooks = {}
for k, h in tt.items():
    r = UNITS[k]
    u, e = KBOOK[r['page']]
    kbooks.setdefault((u, e), []).append((h, translit_lines(lines_of(r), k)))
for (u, e), secs in kbooks.items():
    books.append(('K', u, e, secs))

# порядок: за групою, всередині групи — як у манифестах
books.sort(key=lambda b: GROUPS.index(b[0]))

# ---------------------------------------------------------------- запис шардів
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if re.fullmatch(r'az\d+\.ts', f):
        os.remove(os.path.join(OUT, f))


def mv(g, u, e, secs):
    out = []
    for h, ps in secs:
        s = {'ps': ps}
        if h: s['h'] = h
        out.append(s)
    return {'u': u, 'e': e, 'secs': out, 'notes': []}


shards, cur, size, last = [], [], 0, None
for g, u, e, secs in books:
    b = mv(g, u, e, secs)
    n = len(json.dumps(b, ensure_ascii=False, separators=(',', ':')).encode())
    if cur and (g != last or size + n > 450_000):
        shards.append(cur); cur, size = [], 0
    cur.append((g, b)); size += n; last = g
if cur: shards.append(cur)

meta = []
for si, sh in enumerate(shards):
    js = json.dumps([b for _, b in sh], ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, f'az{si}.ts'), 'w', encoding='utf8') as f:
        f.write("// Додаткові молитви й тропарі, Київський ізвод: транслітерація правилами віра.укр; сучасні російські тексти — в українському перекладі.\n"
                "// Файл згенеровано scripts/azbyka/build.py. Абзац з префіксом § — рубрика, з префіксом # — підзаголовок.\n"
                "import type { MvBook } from '../molytvoslov';\n"
                f"const D: MvBook[] = {js};\nexport default D;\n")
    for ix, (g, b) in enumerate(sh):
        meta.append((len(meta) + 1, si, ix, GROUPS.index(g), b['u'], b['e']))
with open(os.path.join(OUT, 'azMeta.ts'), 'w', encoding='utf8') as f:
    f.write("// Перелік додаткових молитов з ./az<N>.ts (генерує scripts/azbyka/build.py): [номер, шард, номер у шарді, група, назва, назва англ.].\n"
            "// Група — індекс у рядку GROUPS скрипта (0 Богородиці, 1 родина й діти, 2 хворі, 3 різні потреби, 4 спочилі, 5 святим, 6 піснеспіви, 7 тропарі).\n"
            f"export const KZ_AZ: [number, number, number, number, string, string][] = {json.dumps(meta, ensure_ascii=False, separators=(',', ':'))};\n"
            "import type { MvBook } from '../molytvoslov';\n"
            "/** Ліниве завантаження шарда з текстами додаткових молитов. */\n"
            "export const AZ_LOAD: (() => Promise<MvBook[]>)[] = [\n"
            + ''.join(f"  () => import('./az{i}').then((m) => m.default),\n" for i in range(len(shards))) + "];\n")
print(len(books), 'книг,', len(shards), 'шардів')
if A.MISS:
    print('НЕ ПЕРЕКЛАДЕНО:'); [print(' ', k, v[:3]) for k, v in sorted(A.MISS.items())]
if REP['ru_paras']:
    print('Абзаци, схожі на сучасну російську (потребують перекладу або перевірки):')
    for ident, idx in REP['ru_paras']:
        print(' ', ident, idx)
if REPORT:
    json.dump(REP, open(REPORT, 'w', encoding='utf8'), ensure_ascii=False)
