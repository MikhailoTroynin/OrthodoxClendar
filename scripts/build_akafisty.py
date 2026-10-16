#!/usr/bin/env python3
"""Генерує src/data/akafisty.ts зі збережених HTML-сторінок акафістів (Київський ізвод).
Сторінки: https://xn--80ad6b1e.xn--j1amh/b/akafisty-cs-ukr/<slug>
Використання: python3 -I scripts/build_akafisty.py <каталог_з_html> src/data/akafisty.ts"""
import json, re, sys, html
from html.parser import HTMLParser

PAGES = [
 ('akafist-naysolodshomu-hospodu-nashomu-isusu-khrystu','Акафіст Сладчайшому Господу нашому Ісусу Христу','Akathist to our Sweetest Lord Jesus Christ'),
 ('akafist-presvyatiy-vladychytsi-nashiy-bohorodytsi-hlas-8','Акафіст Пресвятій Владичиці нашій Богородиці','Akathist to our Most Holy Lady the Theotokos'),
 ('akafist-svyatiy-velykomuchenytsi-varvari','Акафіст святій великомучениці Варварі','Akathist to the Holy Great Martyr Barbara'),
 ('akafist-rizdvu-khrystovomu','Акафіст Різдву Христовому','Akathist to the Nativity of Christ'),
 ('akafist-uspinnyu-presvyatoyi-vladychytsi-nashoyi-bohorodytsi','Акафіст Успінню Пресвятої Владичиці нашої Богородиці','Akathist to the Dormition of the Theotokos'),
 ('akafist-neopalyma-kupyna','Акафіст Пресвятій Богородиці перед Її чудотворною іконою «Неопалима Купина»','Akathist to the Theotokos before her icon “The Unburnt Bush”'),
 ('akafist-presvyatiy-bohorodytsi-pered-yiyi-chudotvornoyu-ikonoyu-izbavytelnytsya','Акафіст Пресвятій Богородиці перед Її чудотворною іконою «Ізбавительниця»','Akathist to the Theotokos before her icon “The Deliverer”'),
 ('akafist-presvyatiy-bohorodytsi-na-chest-yiyi-chudotvornoyi-ikony-neuvyadayemyy-tsvit','Акафіст Пресвятій Богородиці на честь Її чудотворної ікони «Неув\'ядаємий Цвіт»','Akathist to the Theotokos in honour of her icon “The Unfading Bloom”'),
 ('akafist-hospodu-bohu-pro-myr-i-vzayemnu-lyubov-sered-lyudey','Акафіст Господу Богу про мир і взаємну любов серед людей','Akathist to the Lord God for peace and mutual love among people'),
 ('akafist-prepodobnomu-ottsyu-nashomu-serhiyu-ihumenu-radonezkomu-chudotvortsyu','Акафіст преподобному отцю нашому Сергію, ігумену Радонезькому, чудотворцю','Akathist to our Venerable Father Sergius, Abbot of Radonezh, Wonderworker'),
]

class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True)
        s.on=False; s.h1=False; s.items=[]; s.cur=None; s.kind=None; s.skip=0
        s.red=0; s.notes=[]; s.in_sup=False; s.tagstack=[]
    def handle_starttag(s,t,a):
        a=dict(a)
        if t=='h1': s.on=True; s.h1=True; return
        if not s.on: return
        if t in('style','iframe','hide','script'): s.skip+=1
        if t in('h2','h3','p','li','div'):
            s.flush()  # у джерелі трапляються незакриті <p> — не губимо попередній текст
        if t in('h2','h3','p','li'):
            s.start(t)
        elif t=='br' and s.cur is not None: s.cur.append('\n')
        elif t=='sup' and s.cur is not None:
            s.notes.append((a.get('data-bs-original-title') or a.get('title') or '').strip()); n=len(s.notes)
            s.cur.append('⁽'+str(n)+'⁾'); s.in_sup=True
        elif t=='span' and 'red' in (a.get('class') or ''): s.red+=1
        if t=='span': s.tagstack.append('red' in (a.get('class') or ''))
    def handle_endtag(s,t):
        if not s.on: return
        if t=='h1': s.h1=False
        if t in('style','iframe','hide','script'): s.skip-=1
        if t=='sup': s.in_sup=False
        if t=='span' and s.tagstack:
            if s.tagstack.pop(): s.red-=1
        if t in('h2','h3','p','li','div'): s.flush()
    def start(s,t):
        s.kind=t; s.cur=[]; s.redtxt=0; s.alltxt=0
    def flush(s):
        if s.cur is None: return
        t=s.kind
        txt=re.sub(r'[ \t\r\f\v]+',' ',''.join(s.cur)); txt=re.sub(r' ?\n ?','\n',txt).strip()
        if txt:
            rub = t in('p','li') and s.alltxt>0 and s.redtxt>=s.alltxt
            s.items.append((t,txt,rub))
        s.cur=None
    def handle_data(s,d):
        if not s.on or s.skip or s.in_sup or s.h1: return
        if s.cur is None:
            if not d.strip(): return
            s.start('p')  # текст поза <p> (напр. у <div>/<span>)
        s.cur.append(d)
        st=d.strip()
        if st:
            s.alltxt+=len(st)
            if s.red>0: s.redtxt+=len(st)

def conv(src):
    p=P(); p.feed(src)
    secs=[]; cur={'ps':[]}; notes=p.notes
    for t,txt,rub in p.items:
        if t=='h2':
            if cur['ps'] or cur.get('h'): secs.append(cur)
            cur={'h':txt,'ps':[]}
        elif t=='h3': cur['ps'].append('#'+txt)
        else:
            # буквиця (перша літера в червоному): склеюється з рештою — вже склеєно, бо тексти йдуть підряд
            cur['ps'].append(('§'+txt) if rub else txt)
    if cur['ps'] or cur.get('h'): secs.append(cur)
    used=[]
    # перенумерувати примітки: лише ті, що потрапили в текст
    for s in secs:
        s['ps']=[x for x in s['ps']]
    return secs, notes

def fix(secs):
    """Огріхи джерела: описки й зайве в заголовках; кондак без заголовка, що злився з попереднім ікосом."""
    for x in secs:
        if x.get('h'): x['h']=re.sub(r'^І (?=Кондак)','',x['h'].replace('Конлак','Кондак')).rstrip(':').strip()
    out=[]
    for i,x in enumerate(secs):
        out.append(x)
        m=re.fullmatch(r'Ікос (\d+)',x.get('h',''))
        nxt=secs[i+1].get('h','') if i+1<len(secs) else ''
        if not m or nxt==f'Кондак {int(m[1])+1}' or nxt.startswith('Ікос 1') or not nxt: continue
        ps=x['ps']
        k=next((j for j in range(1,len(ps)) if ps[j-1].startswith('Ра́дуйся') and not ps[j].startswith(('Ра́дуйся','§','#'))),None)
        if k is not None:
            x['ps']=ps[:k]; out.append({'h':f'Кондак {int(m[1])+1}','ps':ps[k:]})
    return out

def main(d,out):
    res=[]
    for slug,u,e in PAGES:
        h=open(f'{d}/{slug}.html',encoding='utf8').read()
        a=h.find('<h1'); b=h.find('chapter-navigation-menu',a)
        secs,notes=conv(h[a:b]); secs=fix(secs)
        res.append({'u':u,'e':e,'secs':secs,'notes':notes})
    js=json.dumps(res,ensure_ascii=False,separators=(',',':'))
    open(out,'w',encoding='utf8').write(
"""// Акафісти (Київський ізвод, церковнослов'янські тексти українською транслітерацією) — https://xn--80ad6b1e.xn--j1amh/b/akafisty-cs-ukr
// Файл згенеровано scripts/build_akafisty.py. Абзац з префіксом § — рубрика (напис), з префіксом # — підзаголовок; ⁽n⁾ — примітка n зі списку notes.
import type { MvBook } from './molytvoslov';
export const AKAFISTY: MvBook[] = """+js+";\n")
    print(len(js))
main(sys.argv[1],sys.argv[2])
