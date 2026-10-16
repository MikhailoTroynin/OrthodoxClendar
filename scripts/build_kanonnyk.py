#!/usr/bin/env python3
"""Генерує src/data/kanonnyk.ts зі збережених HTML-сторінок Канонника і Шестопсалмія (Київський ізвод).
Сторінки: https://xn--80ad6b1e.xn--j1amh/b/kanonnyk-cs-ukr/<slug> і https://xn--80ad6b1e.xn--j1amh/b/shestopsalmiye-cs-ukr/psalom-<n>
(файли Шестопсалмія зберігати як psalom-<n>.html).
Використання: python3 -I scripts/build_kanonnyk.py <каталог_з_html> src/data/kanonnyk.ts"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_molytvoslov import conv
from build_psaltyr import conv as conv_ps  # сторінки псалмів: вірші з номерами (@N)

VK = 'velykyy-pokayannyy-kanon-svyatoho-andriya-krytskoho-'
# (u, e, [(сторінка, заголовок розділу або None — лишити розділи сторінки)])
BOOKS = [
 ('Великий канон — у понеділок першої седмиці Великого посту','Great Canon — Monday of the first week of Great Lent',[(VK+'v-ponedilok-pershoyi-sedmytsi-velykoho-postu',None)]),
 ('Великий канон — у вівторок першої седмиці Великого посту','Great Canon — Tuesday of the first week of Great Lent',[(VK+'u-vivtorok-pershoyi-sedmytsi-velykoho-postu',None)]),
 ('Великий канон — у середу першої седмиці Великого посту','Great Canon — Wednesday of the first week of Great Lent',[(VK+'u-seredu-pershoyi-sedmytsi-velykoho-postu',None)]),
 ('Великий канон — у четвер першої седмиці Великого посту','Great Canon — Thursday of the first week of Great Lent',[(VK+'v-chetver-pershoyi-sedmytsi-velykoho-postu',None)]),
 ("Великий канон — у четвер п'ятої седмиці Великого посту",'Great Canon — Thursday of the fifth week of Great Lent',[(VK+'v-seredu-pyatoyi-sedmytsi-velykoho-postu',None)]),
 ('Канон Воскресінню Христовому (Святої Пасхи)','Canon of the Resurrection of Christ (Holy Pascha)',[('kanon-voskreseniyu-khrystovu-svyatoyi-paskhy',None)]),
 ('Часи Святої Пасхи','Paschal Hours',[('chasy-svyatoyi-paskhy',None)]),
 ('Стихири Пасхи','Paschal stichera',[('stykhyry-paskhy-hlas-5',None)]),
 ('Канон Пресвятій Богородиці перед іконою «Скоропослушниця»','Canon to the Theotokos before her icon “Quick to Hearken”',[('kanon-presvyatiy-bohorodytsi-pered-ikonoyu-ckoroposlushnytsya',None)]),
 ('Шестопсалміє','The Six Psalms',[(f'psalom-{n}',f'Псалом {n}') for n in (3,37,62,87,102,142)]),
]

def main(d,out):
    res=[]
    for u,e,pages in BOOKS:
        secs=[]; notes=[]
        for slug,h in pages:
            src=open(f'{d}/{slug}.html',encoding='utf8').read()
            a=src.find('<h1'); b=src.find('chapter-navigation-menu',a)
            ss,nn=(conv_ps if slug.startswith('psalom-') else conv)(src[a:b])
            # кілька сторінок в одній книзі: примітки нумеруються наскрізно
            k=len(notes)
            for x in ss: x['ps']=[re.sub(r'⁽(\d+)⁾',lambda m:'⁽'+str(int(m[1])+k)+'⁾',p) for p in x['ps']]
            notes+=nn
            if h: ss=[{'h':h,'ps':[p for x in ss for p in ([('#'+x['h'])] if x.get('h') else [])+x['ps']]}]
            secs+=[x for x in ss if x['ps'] or x.get('h')]
        res.append({'u':u,'e':e,'secs':secs,'notes':notes})
    js=json.dumps(res,ensure_ascii=False,separators=(',',':'))
    open(out,'w',encoding='utf8').write(
"""// Канонник і Шестопсалміє (Київський ізвод, церковнослов'янські тексти українською транслітерацією) — https://xn--80ad6b1e.xn--j1amh/b/kanonnyk-cs-ukr, https://xn--80ad6b1e.xn--j1amh/b/shestopsalmiye-cs-ukr
// Файл згенеровано scripts/build_kanonnyk.py. Абзац з префіксом § — рубрика (напис), з префіксом # — підзаголовок; ⁽n⁾ — примітка n зі списку notes.
import type { MvBook } from './molytvoslov';
export const KANONNYK: MvBook[] = """+js+";\n")
    print(len(js))
main(sys.argv[1],sys.argv[2])
