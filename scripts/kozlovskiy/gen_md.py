"""Генерує CHECKLIST.md із classified.json. Використання: gen_md.py <робочий_каталог>"""
import os,sys
os.chdir(sys.argv[1])
import json,collections,re
rows=json.load(open('classified.json'))
tot=collections.Counter(); out=[]
by=collections.OrderedDict()
for r in rows: by.setdefault((r[0],r[2],r[3]),[]).append(r)
TBL={'prayers_ru_pr':'Молитви (prayers_ru_pr)','prayers_ru_ak':'Акафісти й канони (prayers_ru_ak)'}
summary=[]
body=[]
cur=None
for (t,g,gn),items in by.items():
    if t!=cur: body.append(f'\n## {TBL[t]}\n'); cur=t
    miss=[i for i in items if i[6]=='miss']; part=[i for i in items if i[6]=='part']; ok=[i for i in items if i[6] in('ok','dup')]; skip=[i for i in items if i[6]=='skip']
    summary.append((TBL[t].split(' (')[0],gn,len(items),len(ok),len(part),len(miss),sum(i[5] for i in miss),len(skip)))
    body.append(f'\n### {g}. {gn} — бракує {len(miss)}, частково {len(part)}, є {len(ok)}' + (f', відкладено {len(skip)}' if skip else '') + '\n')
    for i in items:
        if i[6]=='miss': body.append(f'- [ ] `{t[11:]}#{i[1]}` {i[4]} · {round(i[5]/1000) or "<1"} тис. зн.')
        elif i[6]=='part': body.append(f'- [ ] `{t[11:]}#{i[1]}` {i[4]} · **частково:** {i[7]}')
    if skip: body.append('- Відкладено: '+'; '.join(f'`#{i[1]}` {i[4]}' for i in skip))
    if ok: body.append('- Уже є: '+'; '.join(f'`#{i[1]}` {i[4]} → {i[7]}' for i in ok))
md=['# Чеклист перенесення молитов з AlexandrKozlovskiy/OrthodoxCalendar','',
'Джерело: [AlexandrKozlovskiy/OrthodoxCalendar](https://github.com/AlexandrKozlovskiy/OrthodoxCalendar) (Apache-2.0), бази `app/src/main/assets/db/create*.zip`.',
'Тексти в таблицях `prayers_ru_*` — церковнослов’янська синодальна редакція «гражданкою» з наголосами; рубрики — російською.',
'Мета — додати до додатка все, чого в ньому ще немає, у транслітерації Київського ізводу (правила віра.укр). План робіт і правила — у [PLAN.md](PLAN.md).','',
'«Відкладено» — рішення редактора від 2026-10-28: поки не переносити тексти про новомучеників XX ст. і Росію та повні служби (Літургії, Всенічне, Утреня, Вечерня, Полуношниці, Велике повечір’я, Страсні Євангелія).','',
'Позначки: `[ ]` — не зроблено; `[x]` — текст транслітеровано, вичитано і додано в додаток. `pr#N` / `ak#N` — `_id` у таблицях `prayers_ru_pr` / `prayers_ru_ak`. Обсяг — тисячі знаків із HTML-розміткою джерела.','',
'## Підсумок','','| Таблиця | Група | Усього | Є | Частково | Бракує | Відкладено | Обсяг відсутніх, тис. зн. |','| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |']
for s in summary: md.append(f'| {s[0]} | {s[1]} | {s[2]} | {s[3]} | {s[4]} | {s[5]} | {s[7]} | {round(s[6]/1000)} |')
T=[sum(x[k] for x in summary) for k in range(2,8)]
md.append(f'| **Разом** | | **{T[0]}** | **{T[1]}** | **{T[2]}** | **{T[3]}** | **{T[5]}** | **{round(T[4]/1000)}** |')
md+=['','## Додаткові таблиці джерела','',
'- [ ] `prayers_day_month` — 31 молитовне прохання до Ангела Хранителя на кожен день місяця (одна позиція з `pr#262`, переносити як одну книгу з 31 розділом)',
'- [ ] `prayers_day_sedmits` — 7 молитов до Богородиці на дні седмиці прп. Нила Сорського (`pr#169`)',
'- [ ] `tropari_kondaki_day_sedmits` — 14 записів: тропарі й кондаки дня седмиці (звірити з `WK` у `src/data/prayerLists.ts`)',
'- [ ] `tropari_kondaki_holiday_one` (60) і `tropari_kondaki_holiday_multi` (21) — тропарі й кондаки свят; дати в таблиці лише на 2022–2025, у додатку брати дати з власного календаря',
]
open('CHECKLIST.md','w').write('\n'.join(md+body)+'\n')
print(T)
for s in summary: print(s)
