#!/usr/bin/env python3
"""Генерує src/data/molytvoslov.ts зі збережених HTML-сторінок молитвослова (Київський ізвод).
Використання: python3 -I scripts/build_molytvoslov.py <каталог_з_html> src/data/molytvoslov.ts"""
import json, re, sys, html
from html.parser import HTMLParser

PAGES = [
 ('vstup','Вступ','Introduction'),
 ('molytvy-ranishni','Молитви ранішні','Morning prayers'),
 ('molytvy-vechirni','Молитви на сон грядущим','Prayers before sleep'),
 ('pomyannyk',"Пом'янник",'Commemoration book'),
 ('pravylo-do-svyatoho-prychastya','Правило до святого Причастя','Rule for Holy Communion'),
 ('molytvy-pered-prychastyam','Молитви перед Причастям','Prayers before Communion'),
 ('molytvy-podyachni-pislya-prychastya','Молитви подячні після Причастя','Thanksgiving prayers after Communion'),
 ('kanon-pokayannyy-do-hospoda-nashoho-isusa-khrysta','Канон покаянний до Господа нашого Ісуса Христа','Canon of Repentance to our Lord Jesus Christ'),
 ('kanon-molebnyy-do-presvyatoyi-bohorodytsi','Канон молебний до Пресвятої Богородиці','Supplicatory Canon to the Most Holy Theotokos'),
 ('kanon-anhelu-khranytelyu','Канон Ангелу Хранителю','Canon to the Guardian Angel'),
 ('molytvy-na-vsyaku-potrebu','Молитви на всяку потребу','Prayers for every need'),
 ('zapovidi','Заповіді','Commandments'),
 ('pisnespivy','Піснеспіви','Hymns'),
 ('litiya-shcho-zvershuyetsya-myryanynom-vdoma-i-na-kladovyshchi','Заупокійна літія, що звершується мирянином','Litiya for the departed served by a layman'),
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

def main(d,out):
    res=[]
    for slug,u,e in PAGES:
        h=open(f'{d}/{slug}.html',encoding='utf8').read()
        a=h.find('<h1'); b=h.find('chapter-navigation-menu',a)
        secs,notes=conv(h[a:b])
        res.append({'u':u,'e':e,'secs':secs,'notes':notes})
    js=json.dumps(res,ensure_ascii=False,separators=(',',':'))
    open(out,'w',encoding='utf8').write(
"""// Молитвослов (Київський ізвод, церковнослов'янські тексти українською транслітерацією) — https://xn--80ad6b1e.xn--j1amh/b/molytvoslov-cs-ukr
// Файл згенеровано scripts/build_molytvoslov.py. Абзац з префіксом § — рубрика (напис), з префіксом # — підзаголовок; ⁽n⁾ — примітка n зі списку notes.
export interface MvSection { h?: string; ps: string[] }
export interface MvBook { u: string; e: string; secs: MvSection[]; notes: string[] }
export const MOLYTVOSLOV: MvBook[] = """+js+";\n")
    print(len(js))
if __name__=='__main__': main(sys.argv[1],sys.argv[2])
