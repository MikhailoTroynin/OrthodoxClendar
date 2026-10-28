#!/usr/bin/env python3
"""Збирає молитви з AlexandrKozlovskiy/OrthodoxCalendar (таблиця prayers_ru_pr) у src/data/kz/pr<N>.ts.
Розбір HTML, транслітерація й поправки ті самі, що в build_kz_akafisty.py (його функції використано повторно);
рубрики й заголовки перекладено українською (kozlovskiy/molytvy_rubrics.py), абзаци сучасною російською — переклад
у kozlovskiy/translated/pr<id>.json, російське → українське (Россія → Україна тощо) — функція ukr().

Використання:
  python3 -I scripts/build_kz_molytvy.py <src.db> <каталог translit/scripts> <каталог виводу> [report.json]
Назви (укр. та англ.) і група — scripts/kozlovskiy/molytvy_titles.tsv (код групи, id у джерелі, укр., англ.).
Змінна середовища RU_DUMP=<каталог> — замість збирання записати абзаци, що схожі на сучасну російську (для перекладу)."""
import html, json, os, re, sqlite3, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'kozlovskiy'))
import build_kz_akafisty as A  # noqa: E402  (розбирає sys.argv так само)
A.translit_text = A.translit_text if hasattr(A, 'translit_text') else A.T.translit_text
import molytvy_rubrics as R  # noqa: E402

# Код групи в molytvy_titles.tsv; порядок = номер групи в prMeta.ts (див. prayers.ts: PRG)
CODES = 'RGBAITSMLHFUDOWC'
TITLES = []
for l in open(os.path.join(HERE, 'kozlovskiy', 'molytvy_titles.tsv'), encoding='utf8'):
    if l.strip():
        c, i, u, e = l.rstrip('\n').split('\t')
        TITLES.append((c, int(i), u, e))

TRANS = os.path.join(HERE, 'kozlovskiy', 'translated')

# ---------------------------------------------------------------- заголовки й рубрики
A.HEAD_EXACT.update(R.HEAD_EXACT)
A.ORD.update(R.ORD)
A.RUB_EXACT.update(R.RUB_EXACT)
A.RUB_DROP = R.RUB_DROP
_rubric_a, _head_a = A.rubric, A.head


def norm(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s).replace('́', '')).strip()


def cs_spans(u):
    """⟦церковнослов'янський фрагмент⟧ у перекладеній рубриці → транслітерація (Київський ізвод)."""
    return re.sub('⟦(.*?)⟧', lambda m: R.TRANSLIT(m[1]).strip(), u, flags=re.S) if u and '⟦' in u else u


def head_m(ru, aid):
    s = A.fix_latin(norm(ru)).rstrip(':').strip()
    u = cs_spans(R.head(s))
    if u is not None: return u
    return _head_a(ru, aid)


def rubric_m(ru, aid):
    s = A.fix_latin(norm(ru))
    if R.RUB_DROP.search(s): return None
    u = cs_spans(R.rub(s))
    if u is not None: return u
    return _rubric_a(ru, aid)


A.head, A.rubric = head_m, rubric_m
R.TRANSLIT = lambda s: A.translit_text(s, enc='civil')[0]
A.inline = lambda key: cs_spans(R.inline(A.fix_latin(key)))

FONT = A.FONT
RUB_P = {'Иерей:': 'Священник:', 'Священник:': 'Священник:', 'Все:': 'Усі:', 'Мы:': 'Ми:', 'И мы:': 'І ми:', 'Лик:': 'Хор:',
         'Мы же:': 'Ми ж:', 'Хор:': 'Хор:', 'Диакон:': 'Диякон:', 'Чтец:': 'Читець:', 'Народ:': 'Народ:'}


def parse_m(t):
    """Як A.parse, але: «\\» = «//»; італік-рубрика стоїть у рядку з текстом лише якщо в тому ж рядку є текст,
    інакше це окрема рубрика; рубрики-репліки («Иерей:») — окремий рядок-рубрика."""
    t = t.replace('\\', '//')
    items, buf, inl = [], [], []
    pos = 0

    def flush():
        chunk = html.unescape(re.sub(r'<[^>]+>', '', ''.join(buf)))
        buf.clear()
        for line in chunk.split('\n'):
            line = re.sub(r'[ \t ]+', ' ', line).strip()
            if line: items.append(('p', line))

    for m in FONT.finditer(t):
        before = t[pos:m.start()]
        buf.append(before)
        inner = m.group(1).strip()
        txt = html.unescape(re.sub(r'<[^>]+>', '', inner)).strip()
        key = re.sub(r'\s+', ' ', txt.replace('́', ''))
        if R.RUB_DROP.search(key):  # довідка про видання тощо — не переноситься
            pos = m.end(); continue
        line_before = re.sub(r'<[^>]+>', '', (''.join(buf)).rsplit('\n', 1)[-1]).strip()
        line_after = re.sub(r'<[^>]+>', '', t[m.end():].split('\n', 1)[0]).strip()
        if re.match(r'<i>', inner, re.I) and (line_before or line_after):
            u = A.inline(key)
            if u is None:
                A.MISS.setdefault('ВСТАВКА: ' + key, []).append(0); u = key
            buf.append('{%d}' % len(inl)); inl.append(u)
        else:
            flush()
            if re.match(r'<b>', inner, re.I): items.append(('h', txt))
            elif re.match(r'<i>', inner, re.I): items.append(('r', txt))
            elif key in RUB_P: items.append(('r', key))
            else: items.append(('p', txt))
        pos = m.end()
    buf.append(t[pos:])
    flush()
    return items, inl


A.parse = parse_m

# ---------------------------------------------------------------- російське → українське
# Россія → Україна, россійський/руський → український, Русь → Україна, Москва → Київ (рішення редактора, як у канонах).
# Правила застосовуються до тексту з наголосами (після кожної літери може стояти знак наголосу).
UKR = [
    (r'в Россії', 'в Україні'), (r'Россії', 'України'), (r'Россія', 'Україна'), (r'Россію', 'Україну'), (r'Россією', 'Україною'),
    (r'град Москву', 'град Київ'), (r'града Москви', 'града Києва'), (r'град Москва', 'град Київ'), (r'Москву', 'Київ'),
    (r'россіійскіій', 'українськіій'), (r'россійськ', 'українськ'), (r'российстій', 'українській'), (r'российстії', 'українськії'),
    (r'российстім', 'українськім'), (r'карпаторусстії', 'закарпатськії'), (r'русстії', 'українськії'), (r'русстій', 'українській'),
    (r'Русь Святая, храни', 'Україно Святая, храни'), (r'воскреснеть Русь', 'воскреснеть Україна'), (r'за Русь Святую', 'за Україну Святую'),
    (r'на Русь ополчишася', 'на Україну ополчишася'), (r'Русі Святия', 'України Святия'), (r'руськ', 'українськ'),
    (r'Руськ', 'Українськ'), (r'росіянин', 'українець'), (r'росіян', 'українців'),
]
UKR += R.UKR
_UKR = [(re.compile(''.join(re.escape(c) + ('́?' if c.isalpha() else '') for c in a), re.I), b) for a, b in UKR]


def ukr(t):
    for rx, b in _UKR:
        t = rx.sub(lambda m: b[:1].upper() + b[1:] if m.group(0)[:1].isupper() else b, t)
    return t


# ---------------------------------------------------------------- збирання
_convert = A.convert
# Переклади абзаців сучасною російською: translated/pr_*.json — {"<id>": {"<номер абзацу>": "текст українською"}}
OVER = {}
for _f in sorted(os.listdir(TRANS)):
    if re.fullmatch(r'pr_.+\.json', _f):
        for _k, _v in json.load(open(os.path.join(TRANS, _f), encoding='utf8')).items():
            assert not set(OVER.get(_k, {})) & set(_v), (_f, _k)
            OVER.setdefault(_k, {}).update(_v)


# Окремі російські слова в абзацах церковнослов'янського (церковно-російського) тексту → церковнослов'янські форми
# (абзаци, що цілком сучасною російською, перекладено в translated/pr_*.json).
_GEN_PREP = {'от', 'у', 'без', 'для', 'из', 'до', 'около', 'кроме', 'ради', 'после', 'против', 'вместо', 'мимо', 'из-за', 'от'}


def _w(word):
    return ''.join(re.escape(c) + ('\u0301?' if c.isalpha() else '') for c in word)


_RUW = [
    (re.compile(r'(?<![А-Яа-яЁё\u0301])((?:[А-Яа-яЁё]+[\u0301]?\s+)?)(' + _w('меня') + r')(?![А-Яа-яЁё])', re.I), 'me'),
    (re.compile(r'(?<![А-Яа-яЁё])(' + _w('тебя') + r')(?![А-Яа-яЁё])', re.I), 'te'),
    (re.compile(r'(?<![А-Яа-яЁё])(' + _w('помоги') + r')(?![А-Яа-яЁё])', re.I), 'помози'),
    (re.compile(r'(?<![А-Яа-яЁё])(' + _w('которых') + r')(?![А-Яа-яЁё])', re.I), 'ихже'),
    (re.compile(r'(?<![А-Яа-яЁё])(' + _w('которую') + r')(?![А-Яа-яЁё])', re.I), 'юже'),
    (re.compile(r'(?<![А-Яа-яЁё])(' + _w('которому') + r')(?![А-Яа-яЁё])', re.I), 'Емуже'),
    (re.compile(r'(?<![А-Яа-яЁё])(' + _w('ведь') + r')(?![А-Яа-яЁё])', re.I), 'бо'),
]


def ru_words(t):
    """меня → мя / (після від, у, без… — мене), тебя → Тя / (після від… — Тебе), помоги → помози тощо."""
    def keep_case(src, rep):
        return rep[:1].upper() + rep[1:] if src[:1].isupper() else rep

    def me(m):
        pre = m.group(1) or ''
        prev = re.sub(r'[\u0301\s]', '', pre).lower()
        rep = 'мене' if prev in _GEN_PREP else 'мя'
        return pre + keep_case(m.group(2), rep)

    for rx, how in _RUW:
        if how == 'me': t = rx.sub(me, t)
        elif how == 'te': t = rx.sub(lambda m: keep_case(m.group(1), 'тя'), t)
        else: t = rx.sub(lambda m: keep_case(m.group(1), how) if how[0].islower() else how, t)
    return t


# Тропарі й кондаки з окремих таблиць: id = 10000 + _id (tropari_kondaki_day_sedmits), 20000 + _id (…_holiday_one), 30000 + _id (…_holiday_multi)
TK = {1: ('tropari_kondaki_day_sedmits', 'text'), 2: ('tropari_kondaki_holiday_one', 'tropari_kondaki_text'),
      3: ('tropari_kondaki_holiday_multi', 'tropari_kondaki_text')}
HEADLINE = re.compile(r'^(?:Ин(?:ой|ое|ый|ая)?\s+)?(?:Тропар[ьи]|Кондак[и]?|Стихир[аы]|Величани[ея]|Икос|Седален|Светилен|Ексапостиларий|Прокимен|Богородичен|Задостойник|Припев|Аллилуиа)\b[^/]{0,95}$')


def source(aid, db):
    """Текст молитви з джерела: items, inl (для тропарів і кондаків з окремих таблиць заголовки — прості рядки)."""
    if aid < 10000:
        return parse_m(db.execute('select text_prayers from prayers_ru_pr where _id=?', (aid,)).fetchone()[0])
    tbl, col = TK[aid // 10000]
    t = db.execute(f'select {col} from {tbl} where _id=?', (aid % 10000,)).fetchone()[0]
    items, inl = parse_m(t)
    out, first = [], True
    for kind, x in items:
        if kind == 'p' and first:
            first = False; continue          # перший рядок — назва свята в давальному відмінку (є в назві книги)
        first = False
        if kind == 'p' and re.fullmatch(r'Ирмос \d+-(?:й|ой) песни:?', x.strip()): kind = 'r'
        elif kind == 'p' and len(x) < 110 and HEADLINE.match(A.fix_latin(x)): kind = 'h'
        out.append((kind, x))
    return out, inl


def build(aid, u, e, db):
    items, inl = source(aid, db)
    over = OVER.get(str(aid), {})
    k = 0
    for ix, (kind, x) in enumerate(items):
        if kind == 'p':
            if str(k) in over:
                items[ix] = (kind, '{%d}' % len(inl)); inl.append(over[str(k)])
            else:
                items[ix] = (kind, ru_words(x))
            k += 1
    if aid != 30006:  # «*» і «**» у тропарях Трійці — посилання на примітки; в інших текстах це залишки розмітки джерела
        items = [(kd, x.strip('*').strip() if kd == 'p' else x) for kd, x in items]
        items = [(kd, x) for kd, x in items if kd != 'p' or x]
    unused = [x for x in over if int(x) >= k]
    assert not unused, (aid, 'переклад поза межами', unused)
    secs, amb = _convert(items, aid, inl)
    for sec in secs:
        if sec.get('h'): sec['h'] = ukr(sec['h'])
        sec['ps'] = [ukr(x) for x in sec['ps']]
    return {'u': u, 'e': e, 'secs': secs, 'notes': []}, amb


# Тексти, що цілком церковнослов'янські (псалми тощо): абзаци з російськими словами в них не перекладаються, а транслітеруються
CS_ONLY = {221}


def dump(db, out):
    """Абзаци, що схожі на сучасну російську, для перекладу: <out>/<id>.tsv — номер абзацу, текст."""
    import rusc
    os.makedirs(out, exist_ok=True)
    tot = 0
    for c, aid, u, e in TITLES:
        if aid in CS_ONLY: continue
        items, inl = source(aid, db)
        rows, k = [], 0
        for kind, x in items:
            if kind == 'p':
                x = A.fix_latin(re.sub(r'\{(\d+)\}', lambda m: inl[int(m[1])], x))
                if rusc.is_ru(x): rows.append((k, x))
                k += 1
        if rows:
            with open(os.path.join(out, f'{aid}.tsv'), 'w', encoding='utf8') as f:
                f.write(f'# {aid} {u}\n' + ''.join(f'{i}\t{x}\n' for i, x in rows))
            tot += sum(len(x) for _, x in rows)
    print('абзаців для перекладу, знаків:', tot)


def main():
    db = sqlite3.connect(A.DB)
    if os.environ.get('RU_DUMP'):
        import rusc  # noqa: F401
        return dump(db, os.environ['RU_DUMP'])
    os.makedirs(A.OUT, exist_ok=True)
    books, meta, rep = [], [], {}
    for c, aid, u, e in TITLES:
        b, amb = build(aid, u, e, db)
        books.append((aid, CODES.index(c), b))
        rep[aid] = {'ambig': amb}
    shards, cur, size, last = [], [], 0, None
    for aid, g, b in books:
        n = len(json.dumps(b, ensure_ascii=False, separators=(',', ':')).encode())
        if cur and (g != last or size + n > 450_000):
            shards.append(cur); cur, size = [], 0
        cur.append((aid, g, b)); size += n; last = g
    shards.append(cur)
    for si, sh in enumerate(shards):
        js = json.dumps([b for _, _, b in sh], ensure_ascii=False, separators=(',', ':'))
        with open(os.path.join(A.OUT, f'pr{si}.ts'), 'w', encoding='utf8') as f:
            f.write("// Молитви з AlexandrKozlovskiy/OrthodoxCalendar (Apache-2.0), Київський ізвод: транслітерація правилами віра.укр.\n"
                    "// Файл згенеровано scripts/build_kz_molytvy.py. Абзац з префіксом § — рубрика, з префіксом # — підзаголовок.\n"
                    "import type { MvBook } from '../molytvoslov';\n"
                    f"const D: MvBook[] = {js};\nexport default D;\n")
        for ix, (aid, g, b) in enumerate(sh):
            meta.append((aid, si, ix, g, b['u'], b['e']))
    with open(os.path.join(A.OUT, 'prMeta.ts'), 'w', encoding='utf8') as f:
        f.write("// Перелік молитов з ./pr<N>.ts (генерує scripts/build_kz_molytvy.py): [id у джерелі, шард, номер у шарді, група, назва, назва англ.].\n"
                "// Група — індекс у рядку CODES скрипта (R правила, G Господу й Хресту, B Богородиці, A Небесним Силам, I перед іконами,\n"
                "// T загальні тропарі й кондаки, S святим, M різні, L про хворих, H родина, F трапеза, U за спочилих, D тропарі й кондаки дня седмиці,\n"
                "// O і W тропарі й кондаки свят, C Часослов). Тексти шардів завантажуються за потреби.\n"
                f"export const KZ_PR: [number, number, number, number, string, string][] = {json.dumps(meta, ensure_ascii=False, separators=(',', ':'))};\n"
                "import type { MvBook } from '../molytvoslov';\n"
                "/** Ліниве завантаження шарда з текстами молитов. */\n"
                "export const PR_LOAD: (() => Promise<MvBook[]>)[] = [\n"
                + ''.join(f"  () => import('./pr{i}').then((m) => m.default),\n" for i in range(len(shards))) + "];\n")
    print(len(books), 'книг,', len(shards), 'шардів')
    if A.MISS:
        print('НЕ ПЕРЕКЛАДЕНО:'); [print(' ', k, v[:3]) for k, v in sorted(A.MISS.items())]
    if A.REPORT: json.dump(rep, open(A.REPORT, 'w', encoding='utf8'), ensure_ascii=False)


main()
