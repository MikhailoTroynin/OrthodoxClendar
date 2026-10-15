#!/usr/bin/env python3
"""Генерує src/data/psaltyr.ts зі збережених HTML-сторінок Слідуваного Псалтиря (Київський ізвод).
Сторінки: https://xn--80ad6b1e.xn--j1amh/b/psaltyr-sliduvany/<slug>
Використання: python3 -I scripts/build_psaltyr.py <каталог_з_html> src/data/psaltyr.ts"""
import json, re, sys
from html.parser import HTMLParser

PAGES = [
 ('yak-chytaty-psaltyr','Як читати Псалтир','How to read the Psalter'),
 ('molytvy-pered-chytannya-psaltyrya','Молитви перед читанням Псалтиря','Prayers before reading the Psalter'),
]+[(f'kafyzma-{k}',f'Кафизма {k}',f'Kathisma {k}') for k in range(1,21)]+[
 ('pislya-zavershennya-chytannya-kilkokh-kafyzm-abo-vsoho-psaltyrya-i-pisen','Після завершення читання кількох кафизм або всього Псалтиря','After reading several kathismas or the whole Psalter'),
 ('pisni-svyashchennoho-pysannya','Пісні Священного Писання','Canticles of Holy Scripture'),
]

BLOCK=('h2','h3','h4','h5','p','li','div')

class P(HTMLParser):
    """Абзаци сторінки: ('h2'|'sub'|'p'|'v', текст, рубрика?, номер вірша)."""
    def __init__(s):
        super().__init__(convert_charrefs=True)
        s.on=False; s.h1=False; s.items=[]; s.cur=None; s.skip=0
        s.red=0; s.notes=[]; s.in_sup=False; s.spans=[]; s.num=None; s.in_num=False
    def handle_starttag(s,t,a):
        a=dict(a); cls=a.get('class') or ''
        if t=='h1': s.on=True; s.h1=True; return
        if not s.on: return
        if t in('style','iframe','hide','script'): s.skip+=1
        if t in BLOCK: s.flush()  # у джерелі трапляються незакриті <p> — не губимо попередній текст
        if t in BLOCK and t!='div': s.start(t)
        elif t=='br' and s.cur is not None: s.cur.append('\n')
        elif t=='sup' and s.cur is not None:
            s.notes.append(a.get('data-bs-original-title','').strip())
            s.cur.append('⁽'+str(len(s.notes))+'⁾'); s.in_sup=True
        elif t=='span':
            k=''
            if 'bible-verse' in cls: s.flush(); s.start('v'); k='v'
            elif 'verse-number-ps' in cls: s.in_num=True; s.num=''; k='n'
            elif 'slava-text' in cls: s.flush(); s.start('p'); k='slava'
            if 'red' in cls.split(): s.red+=1; k+='r'
            s.spans.append(k)
    def handle_endtag(s,t):
        if not s.on: return
        if t=='h1': s.h1=False; return
        if t in('style','iframe','hide','script'): s.skip-=1
        if t=='sup': s.in_sup=False
        if t=='span' and s.spans:
            k=s.spans.pop()
            if k.endswith('r'): s.red-=1; k=k[:-1]
            if k=='n': s.in_num=False
            if k in('v','slava'): s.flush()
        if t in BLOCK: s.flush()
    def start(s,t):
        s.kind=t; s.cur=[]; s.redtxt=0; s.alltxt=0; s.num=None
    def flush(s):
        if s.cur is None: return
        txt=re.sub(r'[ \t\r\f\v]+',' ',''.join(s.cur)); txt=re.sub(r' ?\n ?','\n',txt).strip()
        if txt:
            rub = s.kind in('p','li','v') and s.alltxt>0 and s.redtxt>=s.alltxt
            # текст поза <p> іде абзацами через порожній рядок
            for part in ([txt] if s.kind=='v' else re.split(r'\n{2,}',txt)):
                if part.strip(): s.items.append((s.kind,part.strip(),rub,(s.num or '').strip()))
        s.cur=None
    def handle_data(s,d):
        if not s.on or s.skip or s.in_sup or s.h1: return
        if s.in_num: s.num+=d; return
        if s.cur is None:
            if not d.strip(): return
            s.start('p')  # текст поза <p> (напр. у <div>/<span>)
        s.cur.append(d)
        st=d.strip()
        if st:
            s.alltxt+=len(st)
            if s.red>0: s.redtxt+=len(st)

def conv(src):
    p=P(); p.feed(src); p.flush()
    secs=[]; cur={'ps':[]}
    for t,txt,rub,num in p.items:
        if t=='h2':
            if cur['ps'] or cur.get('h'): secs.append(cur)
            cur={'h':txt,'ps':[]}
        elif t in('h3','h4','h5'): cur['ps'].append('#'+txt)
        elif t=='v' and num and not rub: cur['ps'].append('@'+num+' '+txt)
        else: cur['ps'].append(('§'+txt) if rub else txt)
    if cur['ps'] or cur.get('h'): secs.append(cur)
    return secs, p.notes

def main(d,out):
    res=[]
    for slug,u,e in PAGES:
        h=open(f'{d}/{slug}.html',encoding='utf8').read()
        a=h.find('<h1'); b=h.find('chapter-navigation-menu',a)
        secs,notes=conv(h[a:b])
        res.append({'u':u,'e':e,'secs':secs,'notes':notes})
    js=json.dumps(res,ensure_ascii=False,separators=(',',':'))
    open(out,'w',encoding='utf8').write(
"""// Слідуваний Псалтир (Київський ізвод, церковнослов'янські тексти українською транслітерацією) — https://xn--80ad6b1e.xn--j1amh/b/psaltyr-sliduvany
// Файл згенеровано scripts/build_psaltyr.py. Порядок: як читати, молитви перед читанням, кафизми 1–20, молитви після читання, пісні Писання.
// Абзац з префіксом § — рубрика, # — підзаголовок, @N — вірш N псалма; ⁽n⁾ — примітка n зі списку notes.
import type { MvBook } from './molytvoslov';
export const PSALTYR: MvBook[] = """+js+";\n"
"/** Індекс кафизми k (1–20) у PSALTYR. */\nexport const kathIdx = (k: number) => k + 1;\n")
    print(len(js))
main(sys.argv[1],sys.argv[2])
