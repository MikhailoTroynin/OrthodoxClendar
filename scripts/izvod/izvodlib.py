"""Спільне для перевірки Київського ізводу: розбиття на слова, нормалізація, читання текстів додатка з src/data."""
import glob, json, os, re

ACC = '́'
APOS = "'’ʼʼ"
LET = 'а-щьюяіїєґА-ЩЬЮЯІЇЄҐ' + 'ъыэёЪЫЭЁѣѢѧѦѵѴѳѲѡѠѯѮѱѰꙋꙊѿѾꙗꙖ' + 'a-zA-Z'  # укр. + російські/ЦС і латинські літери, щоб їх ловити
CYR = re.compile('[а-яіїєґА-ЯІЇЄҐ]')
WORD = re.compile('[' + LET + ACC + ']+(?:[' + APOS + '][' + LET + ACC + ']+)*')
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, 'src', 'data')


def words_of(s):
    """Слова (кириличні, зокрема з латинськими двійниками всередині); суто латинські слова пропускаються."""
    return [w for w in WORD.findall(s) if CYR.search(w)]


def plain(w):
    """Нижній регістр, без наголосу, апостроф — '."""
    w = w.lower().replace(ACC, '')
    for a in APOS[1:]:
        w = w.replace(a, "'")
    return w


def skel(w):
    """«Скелет» слова: стерто різницю и/і/ї, е/є, апостроф, ь — так збігаються варіанти написання одного слова."""
    w = plain(w)
    return w.translate(str.maketrans({'і': 'и', 'ї': 'и', 'є': 'е', "'": None, 'ь': None, 'й': 'и'}))


# --- Джерела ---------------------------------------------------------------------------------------------
# id джерела, файл, чи це еталон віра.укр (тексти завантажено з сайту без транслітерації)
def sources():
    out = [('molytvoslov', 'molytvoslov.ts', True), ('psaltyr', 'psaltyr.ts', True),
           ('akafisty', 'akafisty.ts', True), ('kanonnyk', 'kanonnyk.ts', True),
           ('channel', 'channel.ts', False), ('prayers', 'prayers.ts', False)]
    for f in sorted(glob.glob(os.path.join(DATA, 'kz', '*.ts')), key=lambda p: (re.sub(r'\d', '', p), int(re.sub(r'\D', '', os.path.basename(p)) or 0))):
        b = os.path.basename(f)
        if 'Meta' in b:
            continue
        out.append(('kz/' + b[:-3], 'kz/' + b, False))
    return out


def _json_array(s, start):
    return json.JSONDecoder().raw_decode(s, start)


def _str_spans(s):
    """Рядки JSON/JS у вихідному тексті файлу з позиціями — для правок на місці."""
    for m in re.finditer(r'"((?:[^"\\\n]|\\.)*)"|\'((?:[^\'\\\n]|\\.)*)\'', s):
        yield m


def load(fname):
    return open(os.path.join(DATA, fname), encoding='utf-8').read()


def units(src_id, fname):
    """Абзаци джерела: (шлях, вид, текст). Вид: 't' — текст, 'r' — рубрика (§), 'h' — заголовок/назва."""
    s = load(fname)
    if fname == 'channel.ts':
        i = s.index('= [', s.index('export const CH')) + 2
        txt = s[i:s.rindex(']') + 1]
        txt = re.sub(r',\s*\]$', ']', txt)
        for it in json.loads(txt):
            yield (f'id={it["id"]}', 'h', it['u'])
            for j, p in enumerate(it['t'].split('\n')):
                yield (f'id={it["id"]}/{j}', 't', p)
        return
    if fname == 'prayers.ts':
        # у prayers.ts текстами є лише рядки з наголосами (Заповіді, Блаженства тощо)
        for m in _str_spans(s):
            v = m.group(1) if m.group(1) is not None else m.group(2)
            if ACC in v:
                yield (f'@{m.start()}', 't', v)
        return
    i = s.index('= [') + 2
    arr, _ = _json_array(s, i)
    for bi, b in enumerate(arr):
        yield (f'{bi}', 'h', b['u'])
        for si, sec in enumerate(b['secs']):
            if sec.get('h'):
                yield (f'{bi}/{si}', 'h', sec['h'])
            for pi, p in enumerate(sec['ps']):
                kind = 't'
                if p.startswith('§'):
                    kind = 'r'
                elif p.startswith('#'):
                    kind = 'h'
                elif p.startswith('@'):
                    p = re.sub(r'^@\d+\s*', '', p)
                yield (f'{bi}/{si}/{pi}', kind, p)
        for ni, n in enumerate(b.get('notes') or []):
            yield (f'{bi}/n{ni}', 'r', n)


def book_titles(fname):
    s = load(fname)
    if fname in ('channel.ts', 'prayers.ts'):
        return {}
    i = s.index('= [') + 2
    arr, _ = _json_array(s, i)
    return {str(i): b['u'] for i, b in enumerate(arr)}
