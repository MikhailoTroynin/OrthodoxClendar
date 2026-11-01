#!/usr/bin/env python3
"""Перевірка транслітерації Київським ізводом у всіх текстах додатка (src/data).

  python3 -I scripts/izvod/check.py                  # звіт у консоль, код виходу 1, якщо є помилки
  python3 -I scripts/izvod/check.py --json out.json  # усі знахідки (для fix.py і вичитки)
  python3 -I scripts/izvod/check.py --md out.md      # звіт для людини
  python3 -I scripts/izvod/check.py --src kz/ak0 --src channel   # лише вибрані джерела

Що перевіряється (докладно — README.md поруч):
  1. Знаки: латинські двійники кирилиці, російські й ЦС-літери (ы, э, ъ, ё, ѣ, ѧ, ѵ…), наголос не тим знаком
     (U+200C, гравіс, ´), наголос не на голосній, два наголоси в слові.
  2. Правила віра.укр, що перевіряються однозначно: і на початку слова, ї після голосної, є на початку
     і після голосної, Ісус, -ться, -ця (Отця), -ць, без ь після ж ч ш щ б п в м ф р, Тройця, м'я, ні-.
  3. Словник: слово звіряється з еталонним корпусом віра.укр (data/gold.json.gz, crawl_gold.py) і з формами,
     виведеними з ЦС-написання (ѣ збережено) у словнику навички cs-kyiv-translit. Якщо такої форми немає,
     а є форма з тим самим «скелетом» (різниця лише в и/і/ї, е/є, ь, апостроф, ѣ→і, -ськ-) — помилка з підказкою.
  4. Контекст: для закінчень, що залежать від граматики (-и/-і, -ия/-ія, -ите/-іте, -им/-ім, -ии/-ії),
     вибір звіряється з тим, як ця форма вживається в корпусі з тим самим сусіднім словом.
Винятки (перевірені вручну правильні місця) — allow.tsv; виправлення — fixes.tsv (застосовує fix.py).
"""
import argparse, gzip, json, os, re, sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from izvodlib import ACC, APOS, words_of, plain, skel, sources, units, book_titles  # noqa: E402

VOW = 'аеєиіїоуюяАЕЄИІЇОУЮЯ'
LAT2CYR = dict(zip('aceopxiyABCEHIKMOPTXkm', 'асеорхіуАВСЕНІКМОРТХкм'))
LAT2CYR.update({'á': 'а\u0301', 'é': 'е\u0301', 'í': 'і\u0301', 'ó': 'о\u0301', 'ú': 'у\u0301', 'ý': 'у\u0301', 'ï': 'ї'})
RU_CS = 'ъыэёЪЫЭЁѣѢѧѦѵѴѳѲѡѠѯѮѱѰꙋꙊѿѾꙗꙖ'
BAD_ACC = '‌̀´ˊʹ́'
VOKO = re.compile('[' + VOW + ']' + ACC + '[вкВК]о$')
LAT_IN_WORD = re.compile(r'(?=[^\s]*[а-яіїєґА-ЯІЇЄҐ])[^\s,.;:!?«»"“”()\[\]/]*[a-zA-Záéíóúýï][^\s,.;:!?«»"“”()\[\]/]*')


def load_gold():
    d = json.load(gzip.open(os.path.join(HERE, 'data', 'gold.json.gz'), 'rt', encoding='utf-8'))
    return d


def load_derived():
    """Форми з навички cs-kyiv-translit: словник корпусу і індекс «гражданка → ЦС» (ѣ відновлено з ЦС-текстів).
    → (Counter plain → частота, dict plain → Counter форма з наголосом → частота)."""
    sk = os.environ.get('CS_KYIV_TRANSLIT') or ''
    cand = [sk] if sk else []
    cand += sorted(__import__('glob').glob('/root/.claude/skills/**/cs-kyiv-translit/scripts', recursive=True))
    for c in cand:
        p = os.path.join(c, 'data', 'civil_index.json.gz')
        if os.path.exists(p):
            out = Counter(); acc = defaultdict(Counter)
            for fn in ('civil_index.json.gz', 'lexicon.json.gz'):
                for k, v in json.load(gzip.open(os.path.join(c, 'data', fn), 'rt', encoding='utf-8')).items():
                    for u, n in zip(v['ua'], v['n']):
                        out[plain(u)] += n; acc[plain(u)][u.lower()] += n
            return out, acc
    # без навички — лише корпус віра.укр
    return Counter(), defaultdict(Counter)


def read_tsv(name):
    p = os.path.join(HERE, name)
    rows = []
    if os.path.exists(p):
        for ln in open(p, encoding='utf-8'):
            ln = ln.rstrip('\n')
            if not ln or ln.startswith('#'):
                continue
            rows.append(ln.split('\t'))
    return rows


# --- чи абзац церковнослов'янський (а не сучасний український переклад) ---------------------------------
CS_MARK = set('яко єси іже яже єже аще ібо паче понеже даждь днесь паки вопієм глаголя рече єсть суть тя мя м\'я ся '
              'іли нине ніже аки зане убо єлика єлики єгда тогда отонуди сей сія сіє обаче ниже'.split())
UK_MARK = set('що щоб який яка які яке якого якій якою цей ця це ці цього цієї його її їхній був була було були буде '
              'будуть є від у та також через коли тому щоби своїм ваш ви вас тебе себе зі із й мені мене твого свого '
              'моєї твоєї дай допоможи прошу просимо'.split())


_UK = None


def uk_vocab():
    """Словник сучасної української з текстів самого додатка: Біблія (пер. Патріарха Філарета), тлумачення, календар,
    інтерфейс. Потрібен, щоб відрізнити ЦС-абзац без наголосів від українського перекладу."""
    global _UK
    if _UK is None:
        import glob as _g
        from izvodlib import DATA as _D
        _UK = set()
        for f in _g.glob(os.path.join(_D, 'bible', 'b', '*.ts')) + _g.glob(os.path.join(_D, 'tlum', '*.ts')) + \
                _g.glob(os.path.join(_D, 'tlumEv', '*.ts')) + [os.path.join(_D, x) for x in ('calendar2026.ts', 'calendar2027.ts', 'strings.ts')]:
            if os.path.exists(f):
                _UK.update(plain(w) for w in words_of(open(f, encoding='utf-8').read()))
    return _UK


def is_cs(t, ws, known=None):
    """Чи абзац церковнослов'янський. Ознаки: наголоси (≥ 25 % слів), ЦС-маркери (яко, єси, -аго…) і — якщо передано
    known (Checker.known) — частка слів, відомих лише ЦС-словникам (немає в українській лексиці додатка): ≥ 40 %
    при ≤ 10 % суто українських слів і щонайменше 5 словах («Воскресеніє Христово видівше…» без наголосів)."""
    if not ws:
        return False
    acc = sum(ACC in w for w in ws)
    if acc >= max(1, 0.25 * len(ws)):
        return True
    pl = [plain(w) for w in ws]
    cs = sum(w in CS_MARK for w in pl) + sum(w.endswith(('аго', 'яго', 'ися')) for w in pl)
    uk = sum(w in UK_MARK for w in pl)
    if cs > uk and cs >= 1:
        return True
    if known is not None:
        lw = [w for w in pl if len(w) > 2]
        if len(lw) >= 5:
            V = uk_vocab()
            cs_only = sum(1 for w in lw if known(w) and w not in V)
            uk_only = sum(1 for w in lw if w in V and not known(w))
            return cs_only >= 0.4 * len(lw) and uk_only <= 0.1 * len(lw)
    return False


# --- правила --------------------------------------------------------------------------------------------
FOREIGN_E = re.compile(r'^(едем|едом|ефіоп|е[мл]|ев[аеу]|ек[кл]|ел[еіл]|ет|еп|ер[ао]|ерм|ес[кп]|ез|еф|ех|ен[еко]|ег)')


def rule_checks(w, p, g_has, pref=lambda x: 0):
    """Однозначні правила. w — слово (з наголосом), p — plain. Повертає [(код, підказка-plain|None, пояснення)]."""
    out = []
    if p in ('их', 'им', 'ихже', 'ими'):
        out.append(('init-i', 'ї' + p[1:], 'займенник и҆́хъ, и҆́мъ → їх, їм'))
    elif p.startswith('и'):
        out.append(('init-i', 'і' + p[1:], 'на початку слова и → і'))
    if re.search('[аеєиіїоуюя]и', p):
        # після голосної и → ї (твої́, Струї́), але після префікса чи першої частини складного слова на голосну → і
        # (проізволе́ніє, тезоімени́тий, воі́стину), після пре-/на- перед -ид-/-им- → й (прейдо́х, найпа́че)
        q = p
        for m in reversed(list(re.finditer('[аеєиіїоуюя]и', p))):
            j = m.start() + 1
            rest = p[j + 1:]
            if p[:j] in ('пре', 'на') and (pref('й' + rest[:3]) or rest[:1] in 'дм') and pref(p[:j] + 'й' + rest[:2]):
                c = 'й'
            elif p[j - 1] in 'ое' and len(rest) >= 3 and pref('і' + rest[:3]):
                c = 'і'
            else:
                c = 'ї'
            q = q[:j] + c + q[j + 1:]
        out.append(('vow-i', q, 'після голосної и → ї; після префікса/першої частини складного слова → і'))
    if p.startswith('е') and not FOREIGN_E.match(p) and not g_has(p):
        out.append(('init-e', 'є' + p[1:], 'на початку слова е → є'))
    if re.search('[аеєиіїоуюя]е', p):
        out.append(('vow-e', re.sub('([аеєиіїоуюя])е', r'\1є', p), 'після голосної е → є'))
    if re.match("^і?исус|^іисус", p):
        out.append(('isus', re.sub('^і?исус', 'ісус', p), 'Іисус → Ісус'))
    if re.search('т(ся|сь)$', p):
        out.append(('tsya', re.sub('т(ся|сь)$', r'ть\1', p), 'дієслово -тся → -ться'))
    if re.search('ца(|м|ми|х)$', p) and not re.search('цар|зерца|мерца|цат', p):
        # іменники: Отця́, се́рдця, в конця́х; у дієсловах (нарица́ти, налѧца́ти) а лишається, як у корпусі віра.укр
        out.append(('tsa', re.sub('ца(|м|ми|х)$', r'ця\1', p), 'після ц а → я (Отця, сердця, в концях)'))
    if p == 'єсмь':
        out.append(('soft', 'єсьм', 'єсьм (так у правилах віра.укр)'))
    elif re.search('[жчшщбпвмфр]ь', p) and p not in ('воньми',):
        out.append(('soft', re.sub('([жчшщбпвмфр])ь', r'\1', p), 'ь не пишеться після ж ч ш щ б п в м ф р'))
    if p.endswith('ц'):
        out.append(('ts-end', p + 'ь', 'кінцеве -ць'))
    if re.match('^троиц|^троіц|^тройц[аи]', p):
        out.append(('troytsya', None, 'Троица → Тройця'))
    if p == 'мя':
        out.append(('mya', "м'я", "займенник мя → м'я"))
    if p == 'тайн':
        # род. мн. та́инъ → та́їн (у корпусі віра.укр: таїн 28, тайн 1); знайдено звіркою kz-текстів з віра.укр
        out.append(('tain', 'таїн', 'род. мн. та́инъ → та́їн'))
    return out


# --- наголоси й знаки --------------------------------------------------------------------------------------
def char_checks(text, cs_ok=False, acc_fix=None):
    """Знаки в абзаці: [(код, фрагмент, підказка, пояснення)]. cs_ok — ЦС-літери дозволені (цитати в примітках, вступ)."""
    out = []
    text = re.sub(r"<span class=.cs.>.*?</span>", ' ', text)  # ЦС-цитата шрифтом UCS у примітці
    text = re.sub(r'<[^>]*>', ' ', text)
    for m in LAT_IN_WORD.finditer(text):
        frag = m.group(0)
        if re.fullmatch(r'[A-Za-z0-9.\-]+', frag):
            continue
        fixd = ''.join(LAT2CYR.get(c, c) for c in frag)
        out.append(('latin', frag, fixd if not re.search('[a-zA-Z]', fixd) else None, 'латинська літера в кириличному слові'))
    for w in words_of(text):
        bad = [c for c in w if c in RU_CS]
        if bad and not cs_ok:
            out.append(('ru-cs', w, None, 'літера не з українського алфавіту: ' + ''.join(sorted(set(bad)))))
    for m in re.finditer('[' + BAD_ACC + ']', text):
        a = m.start()
        frag = text[max(0, a - 6):a + 4]
        prev = text[a - 1] if a else ''
        if prev in VOW:
            out.append(('acc-char', frag, frag.replace(m.group(0), ACC), 'наголос позначено знаком U+%04X замість U+0301' % ord(m.group(0))))
        elif m.group(0) == '‌':
            out.append(('zw', frag, frag.replace('‌', ''), 'зайвий невидимий знак U+200C'))
    for w in words_of(text):
        if ACC in w and not any(c in RU_CS or c in LAT2CYR for c in w):
            bad = any(c == ACC and (i == 0 or w[i - 1] not in VOW) for i, c in enumerate(w))
            if bad:
                out.append(('acc-pos', w, acc_fix(w) if acc_fix else None, 'наголос не на голосній'))
            elif w.count(ACC) > 1:
                out.append(('acc-two', w, acc_fix(w) if acc_fix else None, 'два наголоси в слові'))
    return out


# --- основна перевірка ------------------------------------------------------------------------------------
import difflib  # noqa: E402

ZONE = 3  # останні літери слова (без -ся) — зона закінчення: там и/і/й/ї залежать від граматики, а не від правопису
CONS_SOFT = set('лнтдсзцк')
CONS_HARD = set('жчшщбпвмфр')


def zone_start(p):
    n = len(p) - (2 if len(p) > 5 and p.endswith(('ся', 'сь')) else 0)
    return n - ZONE


def classify(p, x):
    """Різниця між словом p і відомою формою x → список (вид, позиція в p) або None, якщо різниця не орфографічна.
    Види: yat (е→і, ѣ), ie (е/є), ji (і/ї), ii (и/і в основі), end (и/і/й/ї в закінченні), soft+ / soft- (ь), apos."""
    out = []
    zs = zone_start(p)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, p, x, autojunk=False).get_opcodes():
        if tag == 'equal':
            continue
        a, b = p[i1:i2], x[j1:j2]
        if tag == 'replace' and len(a) == len(b):
            for k, (c, d) in enumerate(zip(a, b)):
                pos = i1 + k
                if c == d:
                    continue
                pair = {c, d}
                if pos >= zs and pair <= set('иіїй'):
                    out.append(('end', pos))
                elif c == 'е' and d == 'і':
                    out.append(('yat', pos) if pos < len(p) - 1 else ('end', pos))
                elif pair == {'е', 'є'}:
                    out.append(('ie', pos))
                elif pair == {'і', 'ї'} or pair == {'и', 'ї'}:
                    out.append(('ji', pos))
                elif pair == {'и', 'і'}:
                    out.append(('ii', pos))
                elif pair == {'ь', "'"}:
                    out.append(('apos', pos))
                else:
                    return None
        elif tag == 'insert' and b in ('ь', "'"):
            out.append(('soft+' if b == 'ь' else 'apos', i1))
        elif tag == 'delete' and a in ('ь', "'"):
            out.append(('soft-' if a == 'ь' else 'apos', i1))
        else:
            return None
    return out


def ok_by_rule(kind, pos, p, x):
    """Чи відповідає виправлення правилам віра.укр (а не лише словнику)."""
    prev = p[pos - 1] if pos else ''
    if kind == 'yat':
        return True
    if kind == 'ie':      # є — на початку, після голосної, після апострофа/ь; е — після приголосної
        if pos == 0 and FOREIGN_E.match(p.replace('є', 'е', 1)):
            return False  # іншомовні імена: Еммануїл, Едем, Ефіопія
        want_ye = pos == 0 or prev in 'аеєиіїоуюя\'ь'
        return (p[pos] == 'е') == want_ye
    if kind == 'ji':      # ї — після голосної чи апострофа; і/и — інакше
        want_ji = pos > 0 and prev in 'аеєиіїоуюя\''
        return (p[pos] != 'ї') == want_ji
    if kind == 'soft+':   # ь пишеться після л н т д с з ц (Господь, хвальний)
        return prev in CONS_SOFT
    if kind == 'soft-':   # і не пишеться після ж ч ш щ б п в м ф р
        return prev in CONS_HARD
    return False


KIND_UK = {'yat': 'ѣ → і', 'ie': 'е/є', 'ji': 'і/ї', 'ii': 'и/і в основі', 'soft+': 'ь', 'soft-': 'зайвий ь', 'apos': 'апостроф'}


# Прийменники, після яких іменник ІІІ відміни на -ость/-есть стоїть у певному відмінку
PREP_LOC = {'в', 'во', 'о', 'об', 'при', 'на'}            # місцевий → -ості
PREP_GEN = {'от', 'из', 'із', 'без', 'до', 'кромі', 'ради', 'для', 'у', 'вмісто', 'ізнутрь', 'посреді', 'внутрь'}  # родовий → -ости
PREP_DAT = {'к', 'ко', 'по'}                               # давальний → -ості
# узгодження займенників (Checker.agree)
AG_GEN = {'от', 'ото', 'из', 'із', 'ізо', 'без', 'безо', 'до', 'у'}
AG_DAT = {'к', 'ко'}
AG_LOC = {'о', 'об', 'обо', 'при'}
AG_LOCV = {'в', 'во', 'на', 'по'}
AG_ALL = AG_GEN | AG_DAT | AG_LOC | AG_LOCV | {'ради'}
AG_POSS = set('моєй моєя твоєй твоєя своєй своєя нашей нашея вашей вашея'.split())


class Checker:
    def __init__(s):
        g = load_gold()
        s.uni = g['uni']; s.bi = g['bi']; s.ngold = g['n']
        s.der, s.dacc = load_derived()
        s.gacc = g['acc']
        s.sk = defaultdict(list)    # скелет (без різниці и/і/ї/й, е/є, ь, ') → відомі форми
        for k in s.uni:
            s.sk[skel(k)].append(k)
        for k, n in s.der.items():
            if n >= 2 and k not in s.uni:
                s.sk[skel(k)].append(k)
        # початки слів (від 4 літер) → кількість різних відомих слів; для скелетів — окремо, з префіксом «~»
        s.pref = Counter()
        for k in set(s.uni) | {k for k, n in s.der.items() if n >= 2}:
            for L in range(4, len(k) + 1):
                s.pref[k[:L]] += 1
            sk_ = skel(k)
            for L in range(4, len(sk_) + 1):
                s.pref['~' + sk_[:L]] += 1
        s.allow_w = set(); s.allow_ctx = set(); s.allow_code = set()
        for r in read_tsv('allow.tsv'):
            # формати: «слово» | «слово<TAB>код» | «попереднє слово наступне» (контекст, plain; _ — будь-яке)
            if len(r) >= 2 and r[1]:
                s.allow_code.add((plain(r[0]), r[1]))
            elif ' ' in r[0]:
                s.allow_ctx.add(r[0])
            else:
                s.allow_w.add(plain(r[0]))

    def acc_fix(s, w):
        """Слово з хибним/подвійним наголосом → написання з одним наголосом за корпусом (зберігаючи регістр)."""
        p = plain(w)
        c = Counter()
        for k, n in (s.gacc.get(p) or {}).items():
            c[k] += n * 100
        for k, n in (s.dacc.get(p) or {}).items():
            c[k] += n
        c = [k for k, n in c.most_common() if k.count(ACC) == 1 and k[k.index(ACC) - 1] in VOW]
        letters = [ch for ch in w if ch != ACC]
        if not c:
            # корпус не знає: лишаємо останній наголос, що стоїть на голосній
            pos = [i for i, ch in enumerate(w) if ch == ACC and i and w[i - 1] in VOW]
            if pos:
                k = pos[-1] - w[:pos[-1]].count(ACC)
                return ''.join(letters[:k]) + ACC + ''.join(letters[k:])
            # наголос зсунуто з голосної: ставимо на найближчу наступну голосну
            k = w.index(ACC)
            m = re.search('[' + VOW + ']', ''.join(letters[k:]))
            if not m:
                return None
            k += m.end()
            return ''.join(letters[:k]) + ACC + ''.join(letters[k:])
        out = []; j = 0
        for ch in c[0]:
            if ch == ACC:
                out.append(ACC); continue
            out.append(letters[j] if j < len(letters) else ch); j += 1
        return ''.join(out)

    def known(s, p):
        return p in s.uni or s.der.get(p, 0) >= 2

    def gold_has(s, p):
        return p in s.uni

    def allowed(s, p, code, prv, nxt):
        if p in s.allow_w or (p, code) in s.allow_code:
            return True
        for c in (f'{prv} {p} {nxt}', f'{prv} {p} _', f'_ {p} {nxt}'):
            if c in s.allow_ctx:
                return True
        return False

    def freq(s, x):
        return s.uni.get(x, 0) * 100 + s.der.get(x, 0)

    def lex(s, p, orig=''):
        """Форма відсутня в корпусі й словнику: шукаємо правильне написання тієї самої форми.
        → (код, підказка, пояснення, серйозність) | None."""
        if s.known(p) or len(p) < 3:
            return None
        cap = orig[:1].isupper()
        cands = set(s.sk.get(skel(p), []))
        # ѣ → і, втрачене в «гражданці»: одна-дві заміни е → і (крім останньої літери — там -е закінчення)
        # е → і лише поза закінченням: у ньому е/і — граматика (крі́постею, ста́рице), а не ѣ
        pos = [i for i, ch in enumerate(p[:zone_start(p)]) if ch == 'е'] if len(p) >= 5 else []
        for i in pos:
            cands.update(s.sk.get(skel(p[:i] + 'і' + p[i + 1:]), []))
            for j in pos:
                if i < j:
                    cands.update(s.sk.get(skel(p[:i] + 'і' + p[i + 1:j] + 'і' + p[j + 1:]), []))
        best = []
        if not cands:
            # ѣ за основою: слова немає, але основа з і (укріп-, благовіщ-) відома, а з е — ні
            for i in pos:
                if 0 < i < len(p) - 2:
                    L = i + 3
                    q = p[:i] + 'і' + p[i + 1:]
                    if s.pref.get(q[:L], 0) >= 3 and not s.pref.get(p[:L], 0) and not s.pref.get('~' + skel(p[:L]), 0):
                        return ('yat', q, f'ѣ → і: основа «{q[:L]}-» є в словниках ({s.pref[q[:L]]} слів), «{p[:L]}-» — немає', 'error')
            # складні слова (благо|свѣтлый, не|исцѣльный): та сама перевірка для другої частини після сполучного -о-/-е-
            for j in range(3, len(p) - 4):
                if p[j - 1] not in 'ое' or s.pref.get(p[:j], 0) < 20:
                    continue
                t = p[j:]
                for i in range(1, min(4, len(t) - 2)):
                    if t[i] != 'е':
                        continue
                    if (t[i + 1:i + 3] == 'нн' or (t[i + 1] == 'н' and t[i + 2:i + 3] in ('і', 'и', 'ь', 'я'))) and not t.startswith('зрен'):
                        continue  # суфікс -енн-/-ені- (дерзнове́нний, принесе́ніє) — без ѣ
                    L = i + 3
                    q = t[:i] + 'і' + t[i + 1:]
                    if s.pref.get(q[:L], 0) >= 3 and not s.pref.get(t[:L], 0) and not s.pref.get('~' + skel(t[:L]), 0):
                        return ('yat', p[:j] + q, f'ѣ → і: друга частина складного слова — основа «{q[:L]}-» є в словниках, «{t[:L]}-» — немає', 'error')
        for x in cands:
            if p.endswith('ться') and x.endswith('тся'):
                continue  # правило віра.укр: дієслова на -тсѧ → -ться
            if x == p or (cap and x not in s.uni):
                continue  # власні назви — лише за корпусом віра.укр
            if any(c not in ('init-e',) for c, _, _ in rule_checks(x, x, s.gold_has, lambda y: s.pref.get(y, 0) >= 3)):
                continue  # форма корпусу сама порушує правило (описка на сайті) — не підказка
            d = classify(p, x)
            if not d or any(k == 'end' for k, _ in d):
                continue  # інше слово або інше закінчення — не орфографія
            sure = all(ok_by_rule(k, i, p, x) or (k == 'apos' and x in s.uni) for k, i in d)
            # -т/-ть у кінці: дієслово (бу́дуть) чи дієприкметник (об'ят, покрит) — певно лише для -ут/-ют/-ет/-єт
            if any(k == 'soft+' and i == len(p) and p.endswith('т') for k, i in d) and not re.search('(ут|ют|ет|єт)$', p):
                sure = False
            kinds = sorted({k for k, _ in d})
            best.append((sure, s.freq(x), x, kinds))
        if not best:
            return None
        best.sort(key=lambda t: (not t[0], -t[1]))
        sure, _, x, kinds = best[0]
        src = 'корпусі віра.укр' if x in s.uni else 'словнику ЦС-форм'
        code = 'yat' if kinds == ['yat'] else 'lex'
        why = f'такої форми немає; у {src} — «{x}» (' + ', '.join(KIND_UK[k] for k in kinds) + ')'
        return (code, x, why, 'error' if sure else 'review')

    def grammar(s, pl, i):
        """Закінчення, що однозначно визначає прийменник: -ости/-ості в іменниках ІІІ відміни."""
        p = pl[i]
        prv = pl[i - 1] if i else ''
        m = re.fullmatch(r'(.{2,}?)(ост|ест)(и|і)', p)
        if not m:
            return None
        noun = m.group(1) + m.group(2) + 'ь'
        if not (noun in s.uni or (m.group(2) == 'ост' and s.known(noun))):
            return None  # не іменник ІІІ відміни (ізвести, принести — дієслова)
        stem = m.group(1) + m.group(2)
        if prv in PREP_LOC or prv in PREP_DAT:
            want = stem + 'і'; why = f'після «{prv}» — місцевий/давальний відмінок: -і'
        elif prv in PREP_GEN:
            # -ости лише після двох приголосних (ми́лости, че́сти); після голосної+т — так само «-ости» (радости)
            want = stem + 'и'; why = f'після «{prv}» — родовий відмінок однини ІІІ відміни: -и'
        else:
            return None
        if want != p:
            return ('case', want, why)
        return None

    def agree(s, pl, i):
        """Закінчення, яке визначає прийменник (перевірено на корпусі віра.укр, selftest.py):
          - тебе/тебі, себе/себі: після к, ко, в, во, о, об, при, по — дав./місц. «-і»; після от, из, без, до, у і перед «ради» — «-е»
            (на корпусі: 425 з 427 збігів; обидва винятки — описки сайту «от Тебі»);
          - моєй/моєя, твоєй/твоєя, своєй/своєя, нашей/нашея, вашей/вашея: після прийменника (або прийменник + іменник
            ж. р. на -і/-и) родового відмінка — «-ея», дав./місц. — «-ей» (148 з 148);
          - іменник одразу після к, ко, об, при — «-і», якщо форма на «-і» є в словнику (34 з 36 — тому лише на вичитку).
        → (код, підказка, пояснення, серйозність) | None."""
        p = pl[i]
        prv = pl[i - 1] if i else '^'
        pp = pl[i - 2] if i > 1 else '^'
        nxt = pl[i + 1] if i + 1 < len(pl) else '$'
        if p in ('тебе', 'тебі', 'себе', 'себі'):
            st = p[:-1]
            if prv in AG_DAT | AG_LOC | {'в', 'во', 'по'}:
                want, why = st + 'і', f'після «{prv}» — давальний/місцевий відмінок: {st}і'
            elif prv in AG_GEN or nxt == 'ради':
                want, why = st + 'е', f'після «{prv if prv in AG_GEN else "ради"}» — родовий відмінок: {st}е'
            else:
                return None
            return ('agree', want, why, 'error') if want != p else None
        if p in AG_POSS:
            st = p[:-1]
            cand = [prv]
            if pp in AG_ALL and prv not in AG_ALL and prv[-1:] in 'иі' and not (nxt[-1:] in 'иеі' and nxt not in ('і', 'и')):
                cand.append(pp)  # в утро́бі моє́й, от ю́ности моєя́ (але не «в служе́ніє твоєя́ сла́ви»)
            for x in cand:
                if x in AG_GEN:
                    want = st + 'я'; why = f'після «{x}» — родовий відмінок: -{p[-2]}я'
                elif x in AG_DAT | AG_LOC | AG_LOCV:
                    want = st + 'й'; why = f'після «{x}» — давальний/місцевий відмінок: -{p[-2]}й'
                else:
                    continue
                return ('agree', want, why, 'error') if want != p else None
            return None
        if prv in AG_DAT | {'об', 'обо', 'при'} and len(p) > 3 and p.endswith('и') and not p.endswith('ии'):
            q = p[:-1] + 'і'
            if s.known(q):
                return ('agree', q, f'після «{prv}» — давальний/місцевий відмінок: -і', 'review')
        return None

    def check_para(s, ws):
        """Слова абзацу → [(індекс, код, підказка-plain|None, пояснення, серйозність)]."""
        pl = [plain(w) for w in ws]
        res = []
        for i, w in enumerate(ws):
            p = pl[i]
            prv = pl[i - 1] if i else '^'
            nxt = pl[i + 1] if i + 1 < len(pl) else '$'
            if not p:
                continue
            hit = None
            for code, sug, why in rule_checks(w, p, s.gold_has, lambda x: s.pref.get(x, 0) >= 3):
                n_own = s.uni.get(p, 0)
                if code != 'isus' and n_own >= 3 and s.uni.get(sug or '', 0) < 5 * n_own:
                    continue  # форма неодноразово є в еталоні — правило має виняток (рідкісна форма може бути опискою)
                hit = (code, sug, why); break
            if not hit and p not in s.uni and nxt != '$' and VOKO.search(w) and (not s.known(p[:-1] + 'а') or (p[:-1] in s.uni and not any(s.known(p[:-1] + e) for e in ('ий', 'ая', 'ую', 'ое', 'оє')))) \
                    and ((p[-2] == 'в' and nxt[:1] in 'вф') or (p[-2] == 'к' and nxt[:1] in 'кгх')):
                # збій навички cs-kyiv-translit: правило «въ/къ → во/ко перед тим самим звуком» не бачить наголосу
                # (U+0301 — не \w) і вважає кінцеве -в/-к наголошеного слова прийменником: враго́в ви́димих → враго́во;
                # «челові́ко ко», «покро́во всім»: основа (челові́к, покро́в) — відоме слово, а не прикметник/прислівник
                hit = ('vo-ko', p[:-1], f'зайве «о»: «{w[:-1]}» — не прийменник (збій правила во/ко після наголосу)')
            if not hit and w[:1].isupper() and re.search('[нр]ск$', p):
                # назви міст: -скъ → -ськ, як -ськ- у прикметниках (Бря́нськ, Смоле́нськ, Курськ); звірка з віра.укр
                hit = ('sk-end', p[:-2] + 'ськ', 'кінцеве -ск у назві → -ськ (Брянськ, Смоленськ)')
            if not hit and re.search('[^аеєиіїоуюя]еіх$', p):
                hit = ('eih', p[:-3] + 'ех', 'місцевий відмінок множини -ехъ → -ех')
            if not hit:
                hit = s.grammar(pl, i)
            if not hit:
                hit = s.agree(pl, i)
            if not hit:
                hit = s.lex(p, w)
            if not hit and len(p) > 4 and p.endswith('ей') and not s.known(p) and p[-3] in 'нтвлрдскгхмбпз' \
                    and (s.known(p[:-2] + 'ая') or p[:-2] + 'ий' in s.uni) and not s.known(p[:-2] + 'яя'):
                hit = ('adj-ey', p[:-2] + 'ій', 'прикметник ж. р. дав./місц. відмінка: -ѣй → -ій (святі́й, тщесла́вній)')
            if not hit and len(p) > 5 and p.endswith('ем') and not s.known(p) and p[-3] in 'нтвлрдз' \
                    and not p[:-2].endswith('йш') and (s.known(p[:-2] + 'аго') or p[:-2] + 'ий' in s.uni) \
                    and not s.known(p[:-2] + 'яя'):
                hit = ('adj-em', p[:-2] + 'ім', 'прикметник ч./с. р. місцевого відмінка: -ѣмъ → -ім (во благоче́стнім)')
            if hit:
                code, sug, why = hit[:3]
                sev = hit[3] if len(hit) > 3 else 'error'
                if not s.allowed(p, code, prv, nxt):
                    res.append((i, code, sug, why, sev))
                continue
            if s.known(p):
                continue
            alts = [x for x in s.sk.get(skel(p), []) if x != p]
            if alts:
                alts.sort(key=lambda x: -s.freq(x))
                if not s.allowed(p, 'end', prv, nxt):
                    res.append((i, 'end', alts[0], 'форми немає в словниках, є «%s» — інше закінчення; перевірити відмінок/число/спосіб' % '/'.join(alts[:3]), 'info'))
            elif not s.allowed(p, 'unk', prv, nxt):
                res.append((i, 'unk', None, 'слова немає ні в корпусі, ні в словнику — не перевірено', 'info'))
        return res


def with_case(orig, sug):
    """Перенести регістр і наголос з orig на підказку (plain); наголос, що опинився після приголосної
    (твоєя́ → твоєй́), переноситься на попередню голосну (твоє́й)."""
    r = _with_case(orig, sug)
    return re.sub('([' + VOW + '])([^' + VOW + ACC + ']+)' + ACC, lambda m: m.group(1) + ACC + m.group(2), r)


def _with_case(orig, sug):
    letters = [c for c in orig if c != ACC]
    out = []
    accpos = [i for i, c in enumerate([c for c in orig]) if c == ACC]
    # позиції наголосу в літерах
    idx = []
    k = 0
    for c in orig:
        if c == ACC:
            idx.append(k)
        else:
            k += 1
    for j, c in enumerate(sug):
        o = letters[j] if j < len(letters) else ''
        if o.isupper():
            c = c.upper()
        if o in APOS and c == "'":
            c = o
        out.append(c)
        if (j + 1) in idx and len(sug) == len(letters):
            out.append(ACC)
    if len(sug) != len(letters) and idx:
        # довжина змінилась (ь, апостроф): ставимо наголос на ту саму за ліком голосну
        vo = [i for i, c in enumerate(letters) if c.lower() in VOW]
        nth = [vo.index(i - 1) for i in idx if (i - 1) in vo]
        res = ''.join(out)
        vs = [i for i, c in enumerate(res) if c.lower() in VOW]
        for n in sorted(nth, reverse=True):
            if n < len(vs):
                res = res[:vs[n] + 1] + ACC + res[vs[n] + 1:]
        return res
    return ''.join(out)


def run(srcs=None):
    ck = Checker()
    findings = []
    stats = Counter()
    for sid, fname, gold in sources():
        if srcs and sid not in srcs:
            continue
        titles = book_titles(fname)
        for path, kind, text in units(sid, fname):
            intro = titles.get(path.split('/')[0], '') == 'Вступ' or '/n' in path
            for code, frag, sug, why in char_checks(text, cs_ok=intro, acc_fix=ck.acc_fix):
                if ck.allowed(plain(frag), code, '', ''):
                    continue
                findings.append(dict(src=sid, path=path, book=titles.get(path.split('/')[0], ''), kind=kind,
                                     word=frag, code=code, sug=sug, why=why, sev='error', ctx=text[:0]))
            if kind != 't':
                continue
            ws = words_of(text)
            if not is_cs(text, ws, ck.known):
                stats['uk-paras'] += 1
                continue
            stats['words'] += len(ws)
            for i, code, sug, why, sev in ck.check_para(ws):
                stats[sev] += 1
                ctx = ' '.join(ws[max(0, i - 5):i]) + ' [' + ws[i] + '] ' + ' '.join(ws[i + 1:i + 6])
                findings.append(dict(src=sid, path=path, book=titles.get(path.split('/')[0], ''), kind=kind, n=i,
                                     word=ws[i], code=code, sug=with_case(ws[i], sug) if sug else None,
                                     why=why, sev=sev, ctx=ctx))
    for f in findings:
        if f['code'] in ('latin', 'ru-cs', 'acc-char', 'zw', 'acc-pos', 'acc-two'):
            stats['error'] += 1
    return findings, stats


def write_md(findings, stats, out):
    by = defaultdict(list)
    for f in findings:
        by[f['sev']].append(f)
    L = ['# Перевірка Київського ізводу', '',
         f"Перевірено слів у ЦС-абзацах: {stats['words']}. Помилок: {len(by['error'])}, на вичитку: {len(by['review'])}, "
         f"не перевірено (немає в словниках): {len(by['info'])}.", '']
    for sev, title in (('error', 'Помилки'), ('review', 'На вичитку'), ('info', 'Невідомі слова (частота)')):
        L += ['## ' + title, '']
        if sev == 'info':
            c = Counter(plain(f['word']) for f in by[sev])
            L += [f'- {w} — {n}' for w, n in c.most_common(500)]
        else:
            for f in by[sev]:
                L.append(f"- `{f['src']}` {f['book'][:50]} · {f['path']} · **{f['word']}** → {f['sug'] or '?'} — {f['why']}"
                         + (f" · …{f['ctx']}…" if f.get('ctx') else ''))
        L.append('')
    open(out, 'w', encoding='utf-8').write('\n'.join(L))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', action='append')
    ap.add_argument('--json'); ap.add_argument('--md')
    ap.add_argument('--quiet', action='store_true')
    a = ap.parse_args()
    findings, stats = run(a.src)
    if a.json:
        json.dump(findings, open(a.json, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    if a.md:
        write_md(findings, stats, a.md)
    err = [f for f in findings if f['sev'] == 'error']
    rev = [f for f in findings if f['sev'] == 'review']
    if not a.quiet:
        c = Counter(f['code'] for f in err)
        print('слів у ЦС-абзацах:', stats['words'], '· сучасних українських абзаців пропущено:', stats['uk-paras'])
        print('помилок:', len(err), dict(c.most_common()))
        print('на вичитку:', len(rev), '· невідомих слів:', sum(f['sev'] == 'info' for f in findings))
        for f in err[:40]:
            print(f" {f['src']} {f['path']} {f['word']} → {f['sug']} [{f['code']}] {f.get('ctx', '')}")
    sys.exit(1 if err or rev else 0)


if __name__ == '__main__':
    main()
