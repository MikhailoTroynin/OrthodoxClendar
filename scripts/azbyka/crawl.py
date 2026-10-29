#!/usr/bin/env python3
"""Збирає індекс https://azbyka.ru/molitvoslov/ і тексти сторінок у кеш.

Використання: python3 -I scripts/azbyka/crawl.py <каталог-кешу>
Пише <кеш>/index.json (розділ, підрозділ, назва, url) і <кеш>/pages/<id>.html.
Сторінки зовнішніх розділів (otechnik тощо) пропускаються — це книги, а не молитви.
"""
import html, json, os, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = 'https://azbyka.ru/molitvoslov/'
UA = {'User-Agent': 'Mozilla/5.0 (OrthodoxCalendar prayers comparison)'}


def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return r.read().decode('utf-8', 'replace')
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(2 * (i + 1))
    raise err


def strip(s):
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', s))).strip()


def parse_index(h):
    body = h[h.find('main-page-section'):]
    out, h2, h3 = [], '', ''
    for m in re.finditer(r'<h([23]) id="([^"]*)"[^>]*>(.*?)</h\1>|<li data-id="(\d+)"[^>]*>\s*<a href="([^"]+)">(.*?)</a>', body, re.S):
        if m.group(1):
            t = strip(m.group(3)).split('(см')[0].strip()
            if m.group(1) == '2':
                h2, h3 = t, ''
            else:
                h3 = t
        else:
            out.append({'id': int(m.group(4)), 'cat': h2, 'sub': h3, 'title': strip(m.group(6)), 'url': m.group(5)})
    return out


def main(cache):
    os.makedirs(cache + '/pages', exist_ok=True)
    idx = parse_index(get(BASE))
    json.dump(idx, open(cache + '/index.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    todo = [e for e in idx if e['url'].startswith(BASE) and not os.path.exists(f"{cache}/pages/{e['id']}.html")]
    print(len(idx), 'у індексі,', len(todo), 'до завантаження')

    def one(e):
        try:
            open(f"{cache}/pages/{e['id']}.html", 'w', encoding='utf-8').write(get(e['url']))
        except Exception as ex:  # noqa: BLE001
            print('ПОМИЛКА', e['url'], ex)
        time.sleep(0.2)

    with ThreadPoolExecutor(4) as ex:
        list(ex.map(one, todo))


if __name__ == '__main__':
    main(sys.argv[1])
