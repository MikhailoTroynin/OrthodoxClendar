# Інвентар молитов AlexandrKozlovskiy/OrthodoxCalendar

Скрипти, якими зібрано `docs/prayers-import/CHECKLIST.md`. Робочий каталог `W` — будь-який порожній каталог поза репозиторієм.

```bash
git clone --depth 1 https://github.com/AlexandrKozlovskiy/OrthodoxCalendar.git "$W/src"
mkdir -p "$W/unz" && for z in "$W"/src/app/src/main/assets/db/*.zip; do unzip -o -q "$z" -d "$W/unz/$(basename "$z" .zip)"; done
mkdir -p "$W/ext" && python3 -I scripts/kozlovskiy/load.py "$W/unz" "$W/ext/src.db"   # двічі: дампи залежать від порядку
python3 -I scripts/kozlovskiy/load.py "$W/unz" "$W/ext/src.db"
python3 -I scripts/kozlovskiy/classify.py "$W"     # → $W/classified.json; статуси «є/частково» задано вручну в PR і AK
python3 -I scripts/kozlovskiy/gen_md.py "$W"       # → $W/CHECKLIST.md
```

Після кожного перенесеного тексту додайте його `_id` у `PR`/`AK` у `classify.py` зі статусом `ok` і перегенеруйте чеклист.

Акафісти збирає `scripts/build_kz_akafisty.py` (див. PLAN.md, розділ «Акафісти»): `python3 -I scripts/build_kz_akafisty.py "$W/ext/src.db" <каталог scripts навички cs-kyiv-translit> src/data/kz "$W/report.json"`.
Назви — `akafisty_titles.tsv`, переклади сучасних російських текстів — `translated/<id>.json`.

Канони збирає `scripts/build_kz_kanony.py` (див. PLAN.md, розділ «Канони»): `python3 -I scripts/build_kz_kanony.py "$W/ext/src.db" <каталог scripts навички cs-kyiv-translit> src/data/kz "$W/report.json"`.
Назви — `kanony_titles.tsv`, переклад тексту сучасною російською (ак#74) — `translated/74.json`.

Молитви збирає `scripts/build_kz_molytvy.py` (див. PLAN.md, розділ «Молитви»): `python3 -I scripts/build_kz_molytvy.py "$W/ext/src.db" <каталог scripts навички cs-kyiv-translit> src/data/kz "$W/report.json"`.
Назви — `molytvy_titles.tsv`, переклад заголовків і рубрик — `molytvy_rubrics.py`, переклад абзаців сучасною російською — `translated/pr_*.json` (`{"<id>": {"<номер абзацу>": "текст"}}`).
Щоб побачити, які абзаци ще схожі на сучасну російську і не перекладені: `RU_DUMP=$W/ru python3 -I scripts/build_kz_molytvy.py "$W/ext/src.db" <каталог scripts cs-kyiv-translit> /tmp/x` (потім `<id>.tsv` у `$W/ru`; визначення — `rusc.py`).

