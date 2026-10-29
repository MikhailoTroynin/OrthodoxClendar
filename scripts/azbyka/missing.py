#!/usr/bin/env python3
"""Відбирає з units.json (compare.py) молитви azbyka.ru, яких немає в додатку.

Використання: python3 -I scripts/azbyka/missing.py <каталог-кешу> [каталог src/data]
Пише <кеш>/missing.json (кандидати на перенесення), <кеш>/missing_ru.json (сучасні російські молитви, потрібен переклад) і <кеш>/MISSING.md (звіт).

Уривок — кандидат, якщо
  1. покриття текстом додатка < ПОРІГ (за замовчуванням 0,25), і
  2. серед назв/заголовків додатка немає такої, що містить усі ключові слова заголовка уривка
     (назви «Молитва пред иконою «Барской»» і «Молитва перед іконою «Барська»» збігаються за основами слів), і
  3. сторінка не з розділів, що не є молитвами для перенесення: книги й дубль церковнослов'янським шрифтом,
     іноземні мови, словники, Псалтир (у додатку повний), Біблія.
Уривки з покриттям ПОРІГ…0,55 — «варіанти»: та сама молитва в іншій редакції, окремо в звіті.
"""
import glob, json, os, re, sys
from collections import Counter, defaultdict

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from compare import status, skel, W  # noqa: E402

SKIP_CAT = ('Церковнославянский шрифт', 'Молитвы на английском', 'Толковые', 'Псалтирь')
SKIP_TITLE = ('Перевод текстов Постной Триоди', 'Современный перевод Октоиха', 'Большой Афонский',
              'Псалтирь церковнославянским', 'Словарь', 'Псалтирь по кафизмам', 'Чин пения 12-ти псалмов')
STOP = set('молитва молитвы молитву молитве молитвы пред перед иконою иконы иконе иному иная иное иной '
           'тропарь тропари кондак кондаки глас гласа святому святаго святого св'.split())
POR = 0.25
# Сучасні російські молитви (мова 'ru'): зачин-звертання до Бога, Богородиці чи святого; сторінки з перекладами й тлумаченнями не беремо
INV = re.compile(r'^[\ufeff\s\u00ab"\u201c]*(О[,!]?\s|Господ|Боже|Бог |Отче|Влады|Пресвят|Милосерд|Иисус|Свят|Преподобн|Всемилост|Царю|Вседерж|Спас|Христ|Ангел|Всеблаг|Благословен|Благодар|Помилуй|Слава|Да\s|Тебе|Тя\s|Упов|Дево|Богородиц|Мати|Пречист)', re.I)
RU_SKIP_TITLE = re.compile(r'перевод|толкован|аудио', re.I)


def key_of(r):
    import hashlib
    return f"{r['id']}#{hashlib.md5(r['text'][:80].encode()).hexdigest()[:6]}"


def imported():
    """Ключі вже перенесених уривків (manifest_*.tsv, tropari_titles.tsv): у звіт «немає в додатку» не потрапляють."""
    out = set()
    for name in ('manifest_cs.tsv', 'manifest_ru.tsv', 'tropari_titles.tsv'):
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), name)
        if os.path.exists(p):
            out |= {l.split('\t')[0] for l in open(p, encoding='utf-8') if l.strip()}
    return out


def keys(text):
    ws = [skel(w) for w in W.findall(text.lower().replace('́', ''))]
    return {w[:5] for w in ws if len(w) >= 4 and w not in {skel(x) for x in STOP}}


def app_titles(data_dir):
    pool = []
    files = [f for f in glob.glob(data_dir + '/**/*.ts', recursive=True)
             if '/bible/' not in f and '/tlum/' not in f and 'calendar' not in f]
    for f in files:
        txt = open(f, encoding='utf-8').read()
        for m in re.finditer(r'"((?:[^"\\]|\\.)*)"|\'((?:[^\'\\]|\\.)*)\'', txt):
            p = (m.group(1) or m.group(2) or '').lstrip('§#')
            if 6 <= len(p) <= 140 and '.' not in p[:-1]:
                k = keys(p)
                if k:
                    pool.append(k)
    return pool


def main(cache, data_dir):
    res = json.load(open(cache + '/units.json', encoding='utf-8'))
    pool = app_titles(data_dir)
    done = imported()
    # той самий текст на іншій сторінці (id інший, початок тексту той самий) теж уже перенесено
    done_fp = {u['text'][:60] for e in res for u in e['units'] if key_of({'id': e['id'], 'text': u['text']}) in done}
    inv = defaultdict(set)
    for i, k in enumerate(pool):
        for x in k:
            inv[x].add(i)
    print('назв у додатку:', len(pool))

    def has_title(head):
        k = keys(head)
        if len(k) < 2:
            return False  # «Молитва 2-я» — за назвою не розрізнити
        cand = set.intersection(*(inv.get(x, set()) for x in k))
        return bool(cand)

    miss, var, seen = [], [], set()
    for e in res:
        if e['cat'].startswith(SKIP_CAT) or e['title'].startswith(SKIP_TITLE):
            continue
        for u in e['units']:
            if u['words'] < 25 or u['cov'] is None or u['lang'] != 'cs':
                continue
            row = {'cat': e['cat'], 'sub': e['sub'], 'page': e['title'], 'url': e['url'], 'id': e['id'],
                   'head': u['head'], 'words': u['words'], 'cov': u['cov'], 'text': u['text'], 'orig': u['orig']}
            row['key'] = key_of(row)
            fp = u['text'][:80]
            if fp in seen or key_of(row) in done or u['text'][:60] in done_fp:
                continue  # той самий текст на кількох сторінках або вже перенесено
            seen.add(fp)
            if u['cov'] >= 0.55:
                continue
            if u['cov'] < POR and not has_title(e['title'] + ' ' + u['head']):
                miss.append(row)
            else:
                var.append(row)
    json.dump(miss, open(cache + '/missing.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    ru, seen_ru = [], set()
    for e in res:
        if e['cat'].startswith(SKIP_CAT) or e['title'].startswith(SKIP_TITLE) or RU_SKIP_TITLE.search(e['title']):
            continue
        for u in e['units']:
            if u['lang'] != 'ru' or not 25 <= u['words'] <= 900 or u['cov'] is None or u['cov'] >= 0.3 or not INV.match(u['text']):
                continue
            fp = u['text'][:60]
            if fp in seen_ru or key_of({'id': e['id'], 'text': u['text']}) in done or fp in done_fp:
                continue
            seen_ru.add(fp)
            rr = {'cat': e['cat'], 'sub': e['sub'], 'page': e['title'], 'url': e['url'], 'id': e['id'],
                  'head': u['head'], 'words': u['words'], 'cov': u['cov'], 'text': u['text'], 'orig': u['orig']}
            rr['key'] = key_of(rr)
            ru.append(rr)
    json.dump(ru, open(cache + '/missing_ru.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    out = ['# Молитви azbyka.ru, яких немає в додатку', '', f'Кандидатів: {len(miss)}; варіантів (є в іншій редакції або за назвою): {len(var)}.', '']
    by = defaultdict(list)
    for r in miss:
        by[(r['cat'], r['page'], r['url'])].append(r)
    for (c, p, url), rs in by.items():
        out.append(f'- **{c} / {p}** — {url}')
        for r in rs:
            out.append(f"    - `{r['key']}` {r['cov']:.2f} · {r['words']} сл. · {r['head']}")
    out += ['', '## Сучасні російські молитви (для перекладу українською)', '']
    for r in ru:
        out.append(f"- `{r['key']}` {r['words']} сл. · {r['page']} / {r['head']}")
    out += ['', '## Варіанти (не переносити)', '']
    for r in var:
        out.append(f"- {r['cov']:.2f} · {r['page']} / {r['head']}")
    open(cache + '/MISSING.md', 'w', encoding='utf-8').write('\n'.join(out))
    print(len(ru), 'сучасних російських молитов;', len(miss), 'кандидатів,', len(var), 'варіантів;', Counter(r['cat'] for r in miss).most_common(8))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'src/data')
