#!/usr/bin/env python3
"""Виправляє в src/data помилки Київського ізводу, знайдені check.py.

  python3 -I scripts/izvod/fix.py            # виправити все, що check.py визначає однозначно, + рішення з fixes.tsv
  python3 -I scripts/izvod/fix.py --dry      # лише показати, що буде змінено

Що змінюється:
  - знахідки check.py з серйозністю «error», для яких є підказка (знаки, правила, словник, відмінок);
  - рішення вичитки з fixes.tsv: «слово<TAB>заміна» або «попереднє слово наступне<TAB>заміна»
    (слова — без наголосу, малими; _ — будь-яке слово), лише в церковнослов'янських абзацах.
Після виправлення check.py запускається знову, доки не лишиться нічого, що можна виправити автоматично.
Файли переписуються тим самим форматом, у якому їх згенеровано (JSON в одному рядку), тож diff показує лише правки.
"""
import argparse, json, os, re, sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from izvodlib import ACC, WORD, CYR, DATA, plain, sources, load, words_of  # noqa: E402
import check  # noqa: E402

CHAR_CODES = {'latin', 'acc-char', 'zw', 'acc-two', 'acc-pos'}


def word_spans(text):
    return [(m.start(), m.end()) for m in WORD.finditer(text) if CYR.search(m.group(0))]


# --- доступ до абзаців у файлах -------------------------------------------------------------------------------
class Doc:
    """Файл даних: читання й запис абзаців за шляхом із check.py/izvodlib.units."""

    def __init__(s, fname):
        s.fname = fname
        s.src = load(fname)
        s.changed = False
        if fname == 'channel.ts':
            s.kind = 'channel'
            s.lines = s.src.split('\n')
            s.items = {}
            for li, l in enumerate(s.lines):
                if l.startswith('  {'):
                    it = json.loads(l[2:].rstrip(','))
                    s.items[it['id']] = (li, it)
        elif fname == 'prayers.ts':
            s.kind = 'raw'
            s.edits = []
        else:
            s.kind = 'mv'
            s.i0 = s.src.index('= [') + 2
            s.arr, s.i1 = json.JSONDecoder().raw_decode(s.src, s.i0)

    def get(s, path):
        if s.kind == 'channel':
            m = re.fullmatch(r'id=(\d+)(?:/(\d+))?', path)
            it = s.items[int(m.group(1))][1]
            if m.group(2) is None:
                return it['u']
            return it['t'].split('\n')[int(m.group(2))]
        if s.kind == 'raw':
            off = int(path[1:])
            q = s.src[off]
            end = off + 1
            while s.src[end] != q or s.src[end - 1] == '\\':
                end += 1
            return s.src[off + 1:end]
        parts = path.split('/')
        b = s.arr[int(parts[0])]
        if len(parts) == 1:
            return b['u']
        if parts[1].startswith('n'):
            return b['notes'][int(parts[1][1:])]
        sec = b['secs'][int(parts[1])]
        if len(parts) == 2:
            return sec['h']
        return sec['ps'][int(parts[2])]

    def set(s, path, val):
        s.changed = True
        if s.kind == 'channel':
            m = re.fullmatch(r'id=(\d+)(?:/(\d+))?', path)
            li, it = s.items[int(m.group(1))]
            if m.group(2) is None:
                it['u'] = val
            else:
                t = it['t'].split('\n'); t[int(m.group(2))] = val; it['t'] = '\n'.join(t)
            return
        if s.kind == 'raw':
            old = s.get(path)
            s.edits.append((int(path[1:]) + 1, len(old), val))
            return
        parts = path.split('/')
        b = s.arr[int(parts[0])]
        if len(parts) == 1:
            b['u'] = val
        elif parts[1].startswith('n'):
            b['notes'][int(parts[1][1:])] = val
        elif len(parts) == 2:
            b['secs'][int(parts[1])]['h'] = val
        else:
            b['secs'][int(parts[1])]['ps'][int(parts[2])] = val

    def save(s):
        if not s.changed:
            return
        if s.kind == 'channel':
            for li, it in s.items.values():
                s.lines[li] = '  ' + json.dumps(it, ensure_ascii=False) + ','
            out = '\n'.join(s.lines)
        elif s.kind == 'raw':
            out = s.src
            for off, n, val in sorted(s.edits, reverse=True):
                out = out[:off] + val + out[off + n:]
        else:
            out = s.src[:s.i0] + json.dumps(s.arr, ensure_ascii=False, separators=(',', ':')) + s.src[s.i1:]
        open(os.path.join(DATA, s.fname), 'w', encoding='utf-8').write(out)


def prefix_len(raw):
    """Довжина службового префікса абзацу (@N у Псалтирі), який units() відкидає."""
    m = re.match(r'@\d+\s*', raw)
    return m.end() if m else 0


# --- рішення вичитки ----------------------------------------------------------------------------------------
def load_fixes():
    glob_, ctx = {}, {}
    for r in check.read_tsv('fixes.tsv'):
        if len(r) < 2:
            continue
        k, v = r[0].strip(), r[1].strip()
        if ' ' in k:
            ctx[k] = v
        else:
            glob_[plain(k)] = v
    return glob_, ctx


def match_case(orig, rep):
    """Регістр першої літери й наголос з orig, якщо в заміні наголосу немає."""
    if ACC not in rep and ACC in orig:
        rep = check.with_case(orig, plain(rep))
    if orig[:1].isupper():
        rep = rep[:1].upper() + rep[1:]
    return rep


def apply_round(dry, log):
    findings, _ = check.run()
    fx_glob, fx_ctx = load_fixes()
    by_unit = defaultdict(list)
    for f in findings:
        if f['sev'] == 'error' and f.get('sug'):
            by_unit[(f['src'], f['path'])].append(f)
    # рішення з fixes.tsv: шукаємо слова в ЦС-абзацах
    n_manual = 0
    if fx_glob or fx_ctx:
        for sid, fname, _ in sources():
            for path, kind, text in check.units(sid, fname):
                if kind != 't':
                    continue
                ws = words_of(text)
                if not check.is_cs(text, ws):
                    continue
                pl = [plain(w) for w in ws]
                for i, p in enumerate(pl):
                    prv = pl[i - 1] if i else '^'
                    nxt = pl[i + 1] if i + 1 < len(pl) else '$'
                    rep = None
                    for c in (f'{prv} {p} {nxt}', f'{prv} {p} _', f'_ {p} {nxt}'):
                        if c in fx_ctx:
                            rep = fx_ctx[c]; break
                    if rep is None:
                        rep = fx_glob.get(p)
                    if rep and plain(rep) != p:
                        by_unit[(sid, path)].append(dict(src=sid, path=path, n=i, word=ws[i], code='manual',
                                                         sug=match_case(ws[i], rep)))
                        n_manual += 1
    docs = {}
    fmap = {sid: fname for sid, fname, _ in sources()}
    changed = Counter()
    for (sid, path), fs in by_unit.items():
        d = docs.get(sid) or docs.setdefault(sid, Doc(fmap[sid]))
        raw = d.get(path)
        pre = prefix_len(raw) if '@' not in path else 0
        head, text = raw[:pre], raw[pre:]
        # спершу знаки (фрагменти), потім слова за номером — від кінця, щоб не зсувати позиції
        for f in fs:
            if f['code'] in CHAR_CODES and f['word'] in text:
                text = text.replace(f['word'], f['sug'])
                changed[f['code']] += 1
                log.append((sid, path, f['word'], f['sug'], f['code']))
        words = [f for f in fs if f['code'] not in CHAR_CODES and 'n' in f]
        if words and any(f['code'] in CHAR_CODES for f in fs):
            if head + text != raw:
                d.set(path, head + text)
            continue  # після правки знаків номери слів могли зсунутися — слова виправить наступний прохід
        spans = word_spans(text)
        done = set()
        for f in sorted(words, key=lambda f: (-f['n'], f['code'] != 'manual')):  # рішення вичитки — першими
            if f['n'] in done or f['n'] >= len(spans):
                continue
            a, b = spans[f['n']]
            if text[a:b] != f['word']:
                continue
            text = text[:a] + f['sug'] + text[b:]
            done.add(f['n'])
            changed[f['code']] += 1
            log.append((sid, path, f['word'], f['sug'], f['code']))
        if head + text != raw:
            d.set(path, head + text)
    if not dry:
        for d in docs.values():
            d.save()
    return changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry', action='store_true')
    ap.add_argument('--log', help='записати перелік правок (TSV)')
    a = ap.parse_args()
    log = []
    total = Counter()
    for rnd in range(5):
        ch = apply_round(a.dry, log)
        print(f'прохід {rnd + 1}:', sum(ch.values()), dict(ch.most_common()))
        total += ch
        if not ch or a.dry:
            break
    print('усього правок:', sum(total.values()))
    if a.log:
        with open(a.log, 'w', encoding='utf-8') as f:
            for r in log:
                f.write('\t'.join(r) + '\n')


if __name__ == '__main__':
    main()
