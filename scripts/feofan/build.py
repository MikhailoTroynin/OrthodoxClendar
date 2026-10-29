#!/usr/bin/env python3
"""Збирає src/data/feofan.ts з кешу scripts/feofan/crawl.py.

Використання: python3 -I scripts/feofan/build.py <каталог-кешу>
Формат: D — дата РРРР-ММ-ДД -> номери думок; T — номер -> [заголовок, читання, абзаци...].
Наголоси й м'які переноси прибрано; примітки відкинуто.
"""
import html, json, re, sys

cache = sys.argv[1]
days = json.load(open(f'{cache}/days.json'))


def clean(s):
    s = re.sub(r'<sup>.*?</sup>', '', s, flags=re.S)
    s = re.sub(r'<br\s*/?>', ' ', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s)
    s = s.replace('­', '').replace('́', '')
    return re.sub(r'\s+', ' ', s).strip()


def parse(n):
    h = open(f'{cache}/pages/{n}.html').read()
    i = h.find('<h1')
    h = h[i:h.find('<h2 class="related-header"', i)]
    title = clean(re.search(r'<h1.*?</h1>', h, re.S).group(0))
    k = h.find('<h2')
    sec = h[max(k, 0):]
    m = re.search(r'<h2.*?</h2>', sec, re.S)
    head = clean(m.group(0)) if m else ''
    paras = [clean(p) for p in re.findall(r'<p[^>]*class="txt"[^>]*>(.*?)</p>', sec, re.S)]
    return [title, head] + [p for p in paras if p]


ids = sorted({i for v in days.values() for i in v}, key=int)
texts = {i: parse(i) for i in ids}
D = {k: v for k, v in sorted(days.items()) if v}
out = ['// Свт. Феофан Затворник, «Мысли на каждый день года по церковным чтениям из Слова Божия».',
       '// Джерело: https://azbyka.ru/otechnik/Feofan_Zatvornik/mysli-na-kazhdyj-den-goda-po-tserkovnym-chtenijam-iz-slova-bozhija/',
       '// Файл згенеровано scripts/feofan/build.py; правте дані обережно.',
       '//   D — цивільна дата -> номери думок (за сторінкою дня на azbyka.ru/days);',
       '//   T — номер -> [заголовок, читання, ...абзаци].',
       'export const D: Record<string, string[]> = ' + json.dumps(D, ensure_ascii=False) + ';',
       'export const T: Record<string, string[]> = ' + json.dumps(texts, ensure_ascii=False) + ';', '']
open('src/data/feofan.ts', 'w').write('\n'.join(out))
print(len(D), 'днів', len(texts), 'текстів', sum(len(' '.join(v)) for v in texts.values()) // 1000, 'КБ')
print(texts['281'][:3] if '281' in texts else '')
print([i for i, v in texts.items() if len(v) < 3])
