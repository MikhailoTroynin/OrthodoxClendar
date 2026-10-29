#!/usr/bin/env python3
"""Збирає «Мысли на каждый день года» свт. Феофана Затворника з azbyka.ru.

Використання: python3 -I scripts/feofan/crawl.py <каталог-кешу>
  1) для кожної дати 2026–2027 бере https://azbyka.ru/days/РРРР-ММ-ДД і запам'ятовує номер сторінки думки;
  2) завантажує потрібні сторінки книги. Пише <кеш>/days.json (дата -> номер) і <кеш>/pages/<номер>.html.
"""
import datetime, json, os, re, sys, time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BOOK = 'https://azbyka.ru/otechnik/Feofan_Zatvornik/mysli-na-kazhdyj-den-goda-po-tserkovnym-chtenijam-iz-slova-bozhija'
LINK = re.compile(r'mysli-na-kazhdyj-den-goda-po-tserkovnym-chtenijam-iz-slova-bozhija/(\d+)')


def get(url):
    for i in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=40) as r:
                return r.read().decode('utf-8')
        except Exception:
            time.sleep(2 * (i + 1))
    return ''


def main(cache):
    os.makedirs(f'{cache}/pages', exist_ok=True)
    dates = []
    d = datetime.date(2026, 1, 1)
    while d.year <= 2027:
        dates.append(d.isoformat())
        d += datetime.timedelta(days=1)
    path = f'{cache}/days.json'
    days = json.load(open(path)) if os.path.exists(path) else {}
    todo = [x for x in dates if x not in days]
    with ThreadPoolExecutor(8) as ex:
        for x, h in zip(todo, ex.map(lambda x: get(f'https://azbyka.ru/days/{x}'), todo)):
            ids = sorted(set(LINK.findall(h)), key=int)
            if h:
                days[x] = ids
    json.dump(days, open(path, 'w'))
    ids = sorted({i for v in days.values() for i in v}, key=int)
    need = [i for i in ids if not os.path.exists(f'{cache}/pages/{i}.html')]
    with ThreadPoolExecutor(8) as ex:
        for i, h in zip(need, ex.map(lambda i: get(f'{BOOK}/{i}'), need)):
            if h:
                open(f'{cache}/pages/{i}.html', 'w').write(h)
    print(len(days), 'днів,', len(ids), 'сторінок; без думки:', sum(1 for v in days.values() if not v))


main(sys.argv[1])
