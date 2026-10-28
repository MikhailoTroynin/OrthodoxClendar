#!/usr/bin/env python3
"""Збирає акафісти з AlexandrKozlovskiy/OrthodoxCalendar (таблиця prayers_ru_ak) у src/data/kz/.
Текст — «гражданка» з наголосами, транслітерується правилами віра.укр (навичка cs-kyiv-translit);
рубрики й заголовки перекладено українською. Формат книги — MvBook, як у akafisty.ts.

Використання:
  python3 -I scripts/build_kz_akafisty.py <src.db> <каталог translit/scripts> <каталог виводу> [report.json]
Назви (укр. та англ.) — scripts/kozlovskiy/akafisty_titles.tsv; ручні виправлення слів —
scripts/kozlovskiy/fixes/<id>.json ({"<слово №>": "форма"}) і scripts/kozlovskiy/fixes_global.tsv."""
import html, json, os, re, sqlite3, sys

DB, TR, OUT = sys.argv[1:4]
REPORT = sys.argv[4] if len(sys.argv) > 4 else None
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TR)
import translit as T  # noqa: E402
from translit import translit_text  # noqa: E402
import unicodedata  # noqa: E402

TITLES = []
for l in open(os.path.join(HERE, 'kozlovskiy', 'akafisty_titles.tsv'), encoding='utf8'):
    if l.strip():
        i, u, e = l.rstrip('\n').split('\t')
        TITLES.append((int(i), u, e))

# Групи джерела → підзаголовки переліку (див. prayers.ts: KZG)
GROUP = {1: 0, 2: 1, 3: 2, 4: 3}

# ---------------------------------------------------------------- заголовки й рубрики
ORD = {'первая': 'перша', 'вторая': 'друга', 'третья': 'третя', 'третия': 'третя', 'четвертая': 'четверта', 'пятая': 'п’ята',
       'иная': 'інша', 'ина': 'інша'}
HEAD_EXACT = {
    'Величание': 'Величання', 'Ин величание': 'Інше величання', 'Ино величание': 'Інше величання', 'Молитва': 'Молитва',
    'Ина молитва': 'Інша молитва', 'Молитва иная': 'Інша молитва', 'Задостойник': 'Задостойник',
    'Молитва ко Господу Иисусу воскресшему': 'Молитва до Господа Ісуса, що воскрес',
    'Молитва ко Господу нашему Иисусу Христу': 'Молитва до Господа нашого Ісуса Христа',
    'Молитва ко Господу Иисусу Христу': 'Молитва до Господа Ісуса Христа',
    'Молитва ко Пресвятей Троице': 'Молитва до Пресвятої Тройці',
    'Молитва ко Пресвятей Богородице': 'Молитва до Пресвятої Богородиці',
    'Молитва к Божией Матери': 'Молитва до Матері Божої',
    'Молитвы ко Пресвятой Богородице': 'Молитви до Пресвятої Богородиці',
    'Молитва Введению во храм Пресвятой Богородицы': 'Молитва Введенню в храм Пресвятої Богородиці',
    'Молитва в праздник Введения во храм Пресвятой Богородицы': 'Молитва в празник Введення в храм Пресвятої Богородиці',
    'Молитва Входу Господню в Иерусалим': 'Молитва Входу Господньому в Єрусалим',
    'Молитва на Успение Пресвятой Богородицы': 'Молитва на Успіння Пресвятої Богородиці',
    'Молитва на Сошествие Святаго Духа': 'Молитва на Зішестя Святого Духа',
    'Молитва о усопших': 'Молитва за спочилих',
    'Молитва о даровании чад': 'Молитва про дарування дітей',
    'Молитва во время бездождия': 'Молитва під час безводдя',
    'Молитва святому праведному Лазарю': 'Молитва святому праведному Лазарю',
    'Молитва, для чтения пред мощами': 'Молитва, що читається перед мощами',
    'Молитва, читаемая в обители у мощей': 'Молитва, що читається в обителі біля мощей',
    'Молитва четвертая, о недугующих и страждущих': 'Молитва четверта, про недугуючих і страждущих',
    'Молитва пятая, в день прославления': 'Молитва п’ята, у день прославлення',
    'Молитва иная (пред гробницею преподобного)': 'Інша молитва (перед гробницею преподобного)',
    'Ина молитва, страстотерпцу царю Николаю': 'Інша молитва, страстотерпцю цареві Миколаю',
    'Молитва ко Пресвятей Богородице пред иконою Ея Иверскою': 'Молитва до Пресвятої Богородиці перед Її іконою Іверською',
    'Величание Пресвятой Троице': 'Величання Пресвятій Тройці',
    'Величание Пресвятой Богородице': 'Величання Пресвятій Богородиці',
    'Величание святым': 'Величання святим', 'Ин величание святым': 'Інше величання святим',
    'Величание рождеству': 'Величання різдву', 'Величание усекновению': 'Величання усікновенню', 'Величание обретению': 'Величання знайденню',
    'Величание (на успение прав. Анны)': 'Величання (на успіння прав. Анни)', 'Ин величание (на успение)': 'Інше величання (на успіння)',
    'Ин величание, иже в Великом Новеграде': 'Інше величання, що у Великому Новгороді',
    'Стихира, поемая вместо тропаря': 'Стихира, що співається замість тропаря',
    'Тропарь положению пояса': 'Тропар положенню пояса', 'Кондак положению пояса': 'Кондак положенню пояса',
    'Тропарь собору и усекновению': 'Тропар собору і усікновенню', 'Тропарь зачатию': 'Тропар зачаттю', 'Тропарь рождеству': 'Тропар різдву',
    'Тропарь первому и второму обретению главы': 'Тропар першому і другому знайденню глави',
    'Тропарь третьему обретению главы': 'Тропар третьому знайденню глави',
    'Тропарь на перенесение десной руки': 'Тропар на перенесення правиці',
    'Кондак собору': 'Кондак собору', 'Кондак зачатию': 'Кондак зачаттю', 'Кондак рождеству': 'Кондак різдву',
    'Кондак усекновению': 'Кондак усікновенню', 'Ин кондак усекновению': 'Інший кондак усікновенню',
    'Кондак первому и второму обретению главы': 'Кондак першому і другому знайденню глави',
    'Кондак третьему обретению главы': 'Кондак третьому знайденню глави',
    'Кондак на перенесение десной руки': 'Кондак на перенесення правиці',
    'Ин тропарь на прославление': 'Інший тропар на прославлення', 'Тропарь обретение мощей': 'Тропар знайдення мощей',
    'Кондак на преставление': 'Кондак на преставлення', 'Тропарь на преставление': 'Тропар на преставлення',
    'Кондак обретение мощей': 'Кондак знайдення мощей',
    'Ин тропарь на перенесение мощей': 'Інший тропар на перенесення мощей',
    'Ин тропарь на обретение мощей': 'Інший тропар на знайдення мощей',
    'Ин кондак на обретение мощей': 'Інший кондак на знайдення мощей',
    'Ин кондак на перенесение мощей': 'Інший кондак на перенесення мощей',
    'Ин тропарь мученику Адриану': 'Інший тропар мученику Адріану',
    'Тропарь преподобному Зосиме Соловецкому': 'Тропар преподобному Зосимі Соловецькому',
    'Кондак преподобному Зосиме Соловецкому': 'Кондак преподобному Зосимі Соловецькому',
    'Величание преподобному Зосиме Соловецкому': 'Величання преподобному Зосимі Соловецькому',
    'Тропарь преподобному Савватию Соловецкому': 'Тропар преподобному Савватію Соловецькому',
    'Кондак преподобному Савватию Соловецкому': 'Кондак преподобному Савватію Соловецькому',
    'Величание преподобному Савватию Соловецкому': 'Величання преподобному Савватію Соловецькому',
    'Тропарь преподобному Герману Соловецкому': 'Тропар преподобному Герману Соловецькому',
    'Кондак преподобному Герману Соловецкому': 'Кондак преподобному Герману Соловецькому',
    'Величание преподобному Герману Соловецкому': 'Величання преподобному Герману Соловецькому',
    'Ин тропарь': 'Інший тропар', 'Ин кондак': 'Інший кондак', 'Глас': 'Глас', 'Тропарь': 'Тропар', 'Кондак': 'Кондак',
}
MISS = {}


def tail_num(s):
    """'Кондак 12, глас 4' → окремо база і «глас N»."""
    m = re.match(r'^(.*?),?\s*(?:глас\s*(\d+))?$', s.strip())
    return m.group(1).strip(), m.group(2)


def head(ru, aid):
    s = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', ru).replace('́', '')).strip().rstrip(':')
    s = re.sub(r'^(Кондак)\s*(\d+)$', r'\1 \2', s)
    m = re.fullmatch(r'Кондак (\d+)', s)
    if m: return 'Кондак ' + m[1]
    m = re.fullmatch(r'Икос (\d+)', s)
    if m: return 'Ікос ' + m[1]
    # «Глас 4 ⏎ Кондак 1»
    m = re.fullmatch(r'Глас (\d+)\s*Кондак (\d+)', s)
    if m: return f'Кондак {m[2]}, глас {m[1]}'
    m = re.fullmatch(r'Кондак (\d+), глас (\d+)', s)
    if m: return f'Кондак {m[1]}, глас {m[2]}'
    base, glas = tail_num(s)
    if base in HEAD_EXACT:
        out = HEAD_EXACT[base]
        return out + (f', глас {glas}' if glas else '')
    m = re.fullmatch(r'Молитва (\d+)-я', base)
    if m: return f'Молитва {m[1]}-а'
    m = re.fullmatch(r'Молитва (\w+)', base)
    if m and m[1] in ORD: return 'Молитва ' + ORD[m[1]]
    MISS.setdefault(s, []).append(aid)
    return s


RUB_TWICE = re.compile(r'^Этот кондак читается трижды, затем икос (\d+) и кондак (\d+)\.?$')
RUB_EXACT = {
    'Этот кондак читается трижды. Затем:': 'Цей кондак промовляй тричі. Потім:',
    '(имена)': '(імена)', '(имя рек)': '(ім’я)', '(имя)': '(ім’я)', 'Или:': 'Або:',
    'Святителю Иулиану молятся о покровительстве детям и при тяжелых болезнях младенцев.':
        'Святителя Іуліана благають про покровительство дітям і при тяжких хворобах немовлят.',
}
RUB_DROP = re.compile(r'утвержд|утверждён|Разрешено Издательским|Синод', re.I)


def rubric(ru, aid):
    s = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', ru).replace('́', '')).strip()
    m = RUB_TWICE.match(s)
    if m: return f'Цей кондак промовляй тричі, потім {m[1]}-й ікос і {m[2]}-й кондак.'
    if s in RUB_EXACT: return RUB_EXACT[s]
    if RUB_DROP.search(s): return None  # довідка про затвердження Синодом РПЦ
    MISS.setdefault('РУБРИКА: ' + s, []).append(aid)
    return s


# ---------------------------------------------------------------- вибір форм у «гражданці»
ACUTE = '\u0301'
LOC = {'в', 'во', 'на', 'о', 'об', 'обо', 'при'}      # після них -е → місцевий відмінок: -і
DAT = {'к', 'ко'}                                      # давальний: -е → -і
GEN = {'от', 'ото', 'у', 'без', 'безо', 'ради', 'для', 'до', 'из', 'изо', 'около', 'кроме', 'вместо', 'мимо', 'против', 'противу', 'после', 'за', 'про', 'под', 'через', 'сквозь'}
GLORY = {'слава', 'хвала', 'честь', 'благодарение', 'благодаря', 'поклонение'}
LAT = dict(zip('aceopxyBCEHKMOPTXaeiop', 'асеорхуВСЕНКМОРТХаеіор'))
LAT.update({'A': 'А', 'a': 'а', 'c': 'с', 'e': 'е', 'o': 'о', 'p': 'р', 'x': 'х', 'y': 'у', 'i': 'і', 'I': 'І', 'T': 'Т', 'H': 'Н', 'K': 'К', 'M': 'М', 'n': 'п', 'r': 'г', 'u': 'и',
            'э': 'е', 'Э': 'Е', 'ё': 'е', 'Ё': 'Е'})


def strip_ac(s):
    return s.replace(ACUTE, '')


def cased(src, cand):
    return cand[:1].upper() + cand[1:] if src[:1].isupper() else cand


_orig_civil = T.translit_civil_word


def _civil(word, use_lexicon=True, prev_key='^', next_key='$'):
    r = _orig_civil(word, use_lexicon, prev_key, next_key)
    w = T.civil_key(word)
    pk, nk = prev_key, next_key
    out, plain = r.out, strip_ac(r.out).lower()
    alts = [strip_ac(v).lower() for v in r.variants]
    if w in ('тебе', 'себе'):
        if pk in GLORY or pk in DAT or pk in LOC or pk in ('по', 'в', 'во'): form = 'і'
        elif pk == '^' or pk in GEN or nk == 'ради': form = 'е'
        else: form = None
        if form:
            r.out = cased(out, w[:-1] + ('і' if form == 'і' else 'е') + ACUTE)
        return r
    if r.how == 'civil-index' and r.variants and w.endswith('е'):
        loc = pk in LOC or pk in DAT
        pairs = [(v, a) for v, a in zip(r.variants, alts) if a[:-1] == plain[:-1] and {a[-1], plain[-1]} == {'е', 'і'}]
        if pairs:
            want = 'і' if loc else 'е'
            if plain[-1] != want: r.out = cased(out, pairs[0][0])
        return r
    if r.how == 'civil-rule' and w.endswith('е') and pk in LOC and not w.endswith(('ие', 'ее')):
        r.out = cased(out, strip_ac(out)[:-1] + 'і') if ACUTE not in out else cased(out, out[:-1] + 'і')
    if strip_ac(r.out).lower().endswith('ех') and len(plain) > 4 and not r.out.endswith('ех' + ACUTE):
        r.out = r.out[:-2] + 'іх'
    return r


T.translit_civil_word = _civil


def fix_latin(s):
    """Латинські двійники кирилиці в джерелі (Aнгел, гpex) → кирилиця; э → е."""
    def tok(m):
        t = m.group(0)
        if t in ('c', 'C'): return 'сС'[t == 'C']  # однолітерний прийменник «с»
        if t == 'ecu': return 'еси'
        if not re.search(r'[\u0400-\u04FF]', t): return t
        return unicodedata.normalize('NFC', ''.join(LAT.get(ch, ch) for ch in t))
    s = unicodedata.normalize('NFD', s).replace('е\u0308', 'е').replace('Е\u0308', 'Е')
    s = re.sub(r"[A-Za-z\u0400-\u04FF\u0300-\u036F']+", tok, s)
    return unicodedata.normalize('NFC', s)


# ---------------------------------------------------------------- розбір HTML
FONT = re.compile(r'<FONT COLOR=#aa2c2c>(.*?)</FONT>', re.S | re.I)


INLINE = {'(имена)': '(імена)', '(имя рек)': '(ім’я)', '(имя)': '(ім’я)', '(имена́)': '(імена)'}


def parse(t):
    """→ [('h'|'r'|'p', текст)]; підстановки в рядку — «(імена)», «(ім’я)» — лишаються в абзаці як {N}."""
    items, buf = [], []
    inl = []
    pos = 0

    def flush():
        chunk = html.unescape(re.sub(r'<[^>]+>', '', ''.join(buf)))
        buf.clear()
        for line in chunk.split('\n'):
            line = re.sub(r'[ \t\u00a0]+', ' ', line).strip()
            if line: items.append(('p', line))

    for m in FONT.finditer(t):
        buf.append(t[pos:m.start()])
        inner = m.group(1).strip()
        txt = html.unescape(re.sub(r'<[^>]+>', '', inner)).strip()
        key = txt.replace('\u0301', '')
        if re.match(r'<i>', inner, re.I) and key in INLINE:
            buf.append('{%d}' % len(inl)); inl.append(INLINE[key])
        else:
            flush()
            if re.match(r'<b>', inner, re.I): items.append(('h', txt))
            elif re.match(r'<i>', inner, re.I): items.append(('r', txt))
            else: items.append(('p', txt))
        pos = m.end()
    buf.append(t[pos:])
    flush()
    # {N} → підстановка (після транслітерації)
    return [(k, x) for k, x in items], inl


def slash(s):
    """Межі колонів «/» і «//»: по пробілу з обох боків (як у молитвослові)."""
    s = re.sub(r'/\s*/', '//', s)
    s = re.sub(r'\s*(//|/)\s*([,.;:!?])', r'\2 \1', s)
    s = re.sub(r'\s*(//|/)\s*', r' \1 ', s).strip()
    return re.sub(r'\(\s+', '(', re.sub(r'\s+([,.;:!?)])', r'\1', s))


def convert(items, aid, inl=()):
    """[(вид, текст)] розбору HTML → розділи MvBook; слова зі звіту — окремо."""
    paras = [fix_latin(x[1]) for x in items if x[0] == 'p']
    out, words, enc = translit_text('\n'.join(paras), enc='civil')
    out = re.sub(r'(?i)(аллилу́?)їя', r'\1я', out)
    out = re.sub(r'\{(\d+)\}', lambda m: inl[int(m[1])], out)
    lines = out.split('\n')
    assert len(lines) == len(paras), (aid, len(lines), len(paras))
    amb = [(w.src, w.out, w.variants, w.ambig) for w in words if w.ambig]
    secs, cur = [], {'ps': []}
    k = 0
    for kind, txt in items:
        if kind == 'h':
            if cur['ps'] or cur.get('h'): secs.append(cur)
            cur = {'h': head(txt, aid), 'ps': []}
        elif kind == 'r':
            r = rubric(txt, aid)
            if r: cur['ps'].append('§' + r)
        else:
            cur['ps'].append(slash(re.sub(r'\s+', ' ', lines[k]).strip())); k += 1
    if cur['ps'] or cur.get('h'): secs.append(cur)
    return secs, amb


def build(aid, u, e, db):
    src = db.execute('select text_prayers from prayers_ru_ak where _id=?', (aid,)).fetchone()[0]
    items, inl = parse(src)
    tr = os.path.join(HERE, 'kozlovskiy', 'translated', f'{aid}.json')
    if os.path.exists(tr):
        # сучасний російський текст: переклад українською; завершальні церковнослов'янські розділи — транслітерація
        d = json.load(open(tr, encoding='utf8'))
        secs = d['secs']
        amb = []
        if d.get('translit_from'):
            at = next(i for i, x in enumerate(items) if x[0] == 'h' and x[1].strip() == d['translit_from'])
            tail, amb = convert(items[at:], aid, inl)
            secs = secs + tail
        return {'u': u, 'e': e, 'secs': secs, 'notes': []}, amb, []
    secs, amb = convert(items, aid, inl)
    return {'u': u, 'e': e, 'secs': secs, 'notes': []}, amb, []


def main():
    db = sqlite3.connect(DB)
    os.makedirs(OUT, exist_ok=True)
    books, meta, rep = [], [], {}
    for aid, u, e in TITLES:
        g = db.execute('select id_group from prayers_ru_ak where _id=?', (aid,)).fetchone()[0]
        b, amb, unk = build(aid, u, e, db)
        books.append((aid, GROUP[g], b))
        rep[aid] = {'ambig': amb, 'unknown': unk}
    # шарди ≤ ~450 КБ, не перетинають меж груп
    shards, cur, size, last = [], [], 0, None
    for aid, g, b in books:
        n = len(json.dumps(b, ensure_ascii=False, separators=(',', ':')).encode())
        if cur and (g != last or size + n > 450_000):
            shards.append(cur); cur, size = [], 0
        cur.append((aid, g, b)); size += n; last = g
    shards.append(cur)
    for si, sh in enumerate(shards):
        js = json.dumps([b for _, _, b in sh], ensure_ascii=False, separators=(',', ':'))
        with open(os.path.join(OUT, f'ak{si}.ts'), 'w', encoding='utf8') as f:
            f.write("// Акафісти з AlexandrKozlovskiy/OrthodoxCalendar (Apache-2.0), Київський ізвод: транслітерація правилами віра.укр.\n"
                    "// Файл згенеровано scripts/build_kz_akafisty.py. Абзац з префіксом § — рубрика, з префіксом # — підзаголовок.\n"
                    "import type { MvBook } from '../molytvoslov';\n"
                    f"const D: MvBook[] = {js};\nexport default D;\n")
        for ix, (aid, g, b) in enumerate(sh):
            meta.append((aid, si, ix, g, b['u'], b['e']))
    with open(os.path.join(OUT, 'akMeta.ts'), 'w', encoding='utf8') as f:
        f.write("// Перелік акафістів з ./ak<N>.ts (генерує scripts/build_kz_akafisty.py): [id у джерелі, шард, номер у шарді, група, назва, назва англ.].\n"
                "// Тексти шардів завантажуються за потреби — див. KZ_LOAD.\n"
                f"export const KZ_AK: [number, number, number, number, string, string][] = {json.dumps(meta, ensure_ascii=False, separators=(',', ':'))};\n"
                "import type { MvBook } from '../molytvoslov';\n"
                "/** Ліниве завантаження шарда з текстами акафістів. */\n"
                "export const KZ_LOAD: (() => Promise<MvBook[]>)[] = [\n"
                + ''.join(f"  () => import('./ak{i}').then((m) => m.default),\n" for i in range(len(shards))) + "];\n")
    print(len(books), 'книг,', len(shards), 'шардів')
    if MISS:
        print('НЕ ПЕРЕКЛАДЕНО:'); [print(' ', k, v[:3]) for k, v in sorted(MISS.items())]
    if REPORT: json.dump(rep, open(REPORT, 'w', encoding='utf8'), ensure_ascii=False)


main()
