#!/usr/bin/env python3
"""Генерує src/data/bible/ зі збережених HTML-сторінок Біблії в перекладі Патріарха Філарета.
Сторінки: https://xn--80ad6b1e.xn--j1amh/b/bible-ukr-filaret/<slug>-ua-<глава>, файли <каталог>/<slug>-<глава>.html
Використання: python3 -I scripts/build_bible.py <каталог_з_html> src/data/bible"""
import html, json, os, re, sys

# slug, назва укр., скорочення (як на сайті), назва англ., група
BOOKS = [
 ('gen','Буття','Бут.','Genesis',0),('exod','Вихід','Вих.','Exodus',0),('lev','Левит','Лев.','Leviticus',0),
 ('num','Числа','Чис.','Numbers',0),('deut','Второзаконня','Втор.','Deuteronomy',0),
 ('josh','Ісуса Навина','Нав.','Joshua',1),('judg','Суддів','Суд.','Judges',1),('ruth','Руф','Руф.','Ruth',1),
 ('1-sam','1 Царств','1 Цар.','1 Kingdoms (1 Samuel)',1),('2-sam','2 Царств','2 Цар.','2 Kingdoms (2 Samuel)',1),
 ('1-kgs','3 Царств','3 Цар.','3 Kingdoms (1 Kings)',1),('2-kgs','4 Царств','4 Цар.','4 Kingdoms (2 Kings)',1),
 ('1-chr','1 Паралипоменон','1 Пар.','1 Chronicles',1),('2-chr','2 Паралипоменон','2 Пар.','2 Chronicles',1),
 ('ezra','1 Ездри','1 Езд.','Ezra',1),('2-ezra','2 Ездри*','2 Езд.','2 Esdras*',1),('3-ezra','3 Ездри*','3 Езд.','3 Esdras*',1),
 ('neh','Неємії','Неєм.','Nehemiah',1),('tob','Товита*','Тов.','Tobit*',1),('jud','Юдифи*','Юдиф.','Judith*',1),
 ('esth','Есфирі','Есф.','Esther',1),('1-mac','1 Маккавейська*','1 Мак.','1 Maccabees*',1),
 ('2-mac','2 Маккавейська*','2 Мак.','2 Maccabees*',1),('3-mac','3 Маккавейська*','3 Мак.','3 Maccabees*',1),
 ('job','Іова','Іов.','Job',2),('ps','Псалтир','Пс.','Psalms',2),('prov','Притчі','Притч.','Proverbs',2),
 ('eccl','Екклезіаст','Еккл.','Ecclesiastes',2),('song','Пісня пісень','Пісн.','Song of Songs',2),
 ('wisd','Премудрості Соломона*','Прем.','Wisdom of Solomon*',2),('sir','Сираха*','Сир.','Sirach*',2),
 ('isa','Ісаї','Іс.','Isaiah',3),('jer','Єремії','Єр.','Jeremiah',3),('lam','Плач Єремії','Плач.','Lamentations',3),
 ('let-jer','Послання Єремії*','Посл. Єр.','Letter of Jeremiah*',3),('bar','Варуха*','Вар.','Baruch*',3),
 ('ezek','Єзекиїля','Єз.','Ezekiel',3),('dan','Даниїла','Дан.','Daniel',3),
 ('hos','Осії','Ос.','Hosea',4),('joel','Іоїля','Іоїл.','Joel',4),('amos','Амоса','Ам.','Amos',4),('obad','Авдія','Авд.','Obadiah',4),
 ('jonah','Іони','Іона.','Jonah',4),('mic','Михея','Мих.','Micah',4),('nah','Наума','Наум.','Nahum',4),('hab','Аввакума','Авв.','Habakkuk',4),
 ('zeph','Софонії','Соф.','Zephaniah',4),('hag','Аггея','Агг.','Haggai',4),('zech','Захарії','Зах.','Zechariah',4),('mal','Малахії','Мал.','Malachi',4),
 ('matt','Від Матфея','Мф.','Matthew',5),('mark','Від Марка','Мк.','Mark',5),('luke','Від Луки','Лк.','Luke',5),('john','Від Іоана','Ін.','John',5),
 ('acts','Діяння апостолів','Діян.','Acts of the Apostles',6),
 ('jas','Якова','Як.','James',7),('1-pet','1 Петра','1 Пет.','1 Peter',7),('2-pet','2 Петра','2 Пет.','2 Peter',7),
 ('1-john','1 Іоана','1 Ін.','1 John',7),('2-john','2 Іоана','2 Ін.','2 John',7),('3-john','3 Іоана','3 Ін.','3 John',7),('jude','Іуди','Іуд.','Jude',7),
 ('rom','До римлян','Рим.','Romans',8),('1-cor','1 до коринфян','1 Кор.','1 Corinthians',8),('2-cor','2 до коринфян','2 Кор.','2 Corinthians',8),
 ('gal','До галатів','Гал.','Galatians',8),('eph','До ефесян','Еф.','Ephesians',8),('phil','До филип’ян','Флп.','Philippians',8),
 ('col','До колосян','Кол.','Colossians',8),('1-thess','1 до солунян','1 Сол.','1 Thessalonians',8),('2-thess','2 до солунян','2 Сол.','2 Thessalonians',8),
 ('1-tim','1 до Тимофія','1 Тим.','1 Timothy',8),('2-tim','2 до Тимофія','2 Тим.','2 Timothy',8),('titus','До Тита','Тит.','Titus',8),
 ('philem','До Филимона','Флм.','Philemon',8),('heb','До євреїв','Євр.','Hebrews',8),
 ('rev','Одкровення','Одкр.','Revelation',9),
]
IDX = {b[0]: i for i, b in enumerate(BOOKS)}
REF = re.compile(r'<a href="https://xn--80ad6b1e\.xn--j1amh/b/bible-ukr-filaret/([a-z0-9-]+)-ua-(\d+)#\1-ua-\2:(\d+)([-:]\d+)?">')
VERSE = re.compile(r'<div\s+class="bible-verse row([^"]*)">(.*?)<div\s+class="verse-body[^"]*">(.*?)</div>\s*</div>', re.S)


def clean(s):
    notes = [html.unescape(n).strip() for n in re.findall(r'<sup[^>]*data-bs-original-title="([^"]*)"[^>]*>.*?</sup>', s, re.S)]
    s = re.sub(r'<sup.*?</sup>', '*', s, flags=re.S)
    s = re.sub(r'<br\s*/?>|</?h5[^>]*>', '\n', s)
    s = html.unescape(re.sub(r'<[^>]+>', '', s)).replace('\xad', '')
    s = re.sub(r'[ \t\r\f\v]+', ' ', s)
    s = re.sub(r' ?\n ?', '\n', s)
    s = re.sub(r'\n{2,}', '\n', s).strip()
    return s, notes


def chapter(src):
    a = src.find('<h1'); b = src.find('chapter-navigation-menu', a)
    s = src[a:b]
    ch = {'v': []}
    m = re.search(r'class="bible-starting-text[^"]*">(.*?)</div>', s, re.S)
    if m: ch['h'] = clean(m.group(1))[0]
    x = {}
    nt = {}
    exp = 1
    for cls, head, body in VERSE.findall(s):
        if 'slava' in cls: continue  # «Слава…» — поділ кафизми, не текст Писання
        num = int(re.search(r'id="[a-z0-9-]+-ua-\d+:(\d+)"', head).group(1))
        txt, notes = clean(body)
        ch['v'].append(txt if num == exp else [num, txt])
        exp = num + 1
        t = re.search(r'title="([^"]*)"', head)
        refs = [f'{IDX[sl]}.{c}.{v}{e or ""}' for sl, c, v, e in REF.findall(html.unescape(t.group(1)))] if t else []
        if refs: x[num] = '|'.join(refs)
        if notes: nt[num] = notes
    if x: ch['x'] = x
    if nt: ch['n'] = nt
    return ch


def verse_nums(c):
    out, e = set(), 1
    for v in c['v']:
        n = v[0] if isinstance(v, list) else e
        out.add(n); e = n + 1
    return out


def main(d, out):
    os.makedirs(f'{out}/b', exist_ok=True)
    meta = []
    total = 0
    loaders = []
    books = []
    for sl, *_ in BOOKS:
        chs = []
        n = 1
        while os.path.exists(f'{d}/{sl}-{n}.html'):
            chs.append(chapter(open(f'{d}/{sl}-{n}.html', encoding='utf8').read())); n += 1
        assert chs and all(c['v'] for c in chs), sl
        books.append(chs)
    # Номери віршів кожної глави — щоб відкинути посилання сайту на неіснуючі вірші (їх кілька десятків).
    nums = [[verse_nums(c) for c in chs] for chs in books]
    dropped = 0
    for chs in books:
        for c in chs:
            for v, refs in list(c.get('x', {}).items()):
                ok = []
                for r in refs.split('|'):
                    b, cc, vv = map(int, re.match(r'(\d+)\.(\d+)\.(\d+)', r).groups())
                    if cc <= len(nums[b]) and vv in nums[b][cc - 1]: ok.append(r)
                    else: dropped += 1
                if ok: c['x'][v] = '|'.join(ok)
                else: del c['x'][v]
    print('відкинуто хибних посилань:', dropped)
    for i, (sl, u, ab, e, g) in enumerate(BOOKS):
        chs = books[i]
        meta.append([sl, u, ab, e, g, len(chs)])
        js = json.dumps(chs, ensure_ascii=False, separators=(',', ':'))
        total += len(js.encode())
        open(f'{out}/b/{sl}.ts', 'w', encoding='utf8').write(
            f"// {u} — Біблія, переклад Патріарха Філарета. Згенеровано scripts/build_bible.py, не правте вручну.\n"
            "import type { BChap } from '../types';\n"
            f"const C: BChap[] = {js};\nexport default C;\n")
        loaders.append(f"  () => require('./b/{sl}').default,")
    open(f'{out}/books.ts', 'w', encoding='utf8').write(
        "// Книги Біблії (переклад Патріарха Філарета): slug, назва, скорочення, назва англ., група, кількість глав.\n"
        "// Згенеровано scripts/build_bible.py. Тексти глав — у ./b/<slug>.ts, завантажуються за потреби.\n"
        "import type { BChap } from './types';\n"
        "export type BookMeta = [slug: string, u: string, abbr: string, e: string, group: number, chapters: number];\n"
        "export const BOOKS: BookMeta[] = " + json.dumps(meta, ensure_ascii=False) + ";\n"
        "/** Ліниве завантаження тексту книги (модуль виконується лише при першому зверненні). */\n"
        "export const LOAD: (() => BChap[])[] = [\n" + '\n'.join(loaders) + "\n];\n")
    print(len(BOOKS), 'книг,', total // 1024, 'КБ тексту')


main(sys.argv[1], sys.argv[2])
