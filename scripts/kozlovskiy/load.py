"""Завантажує SQL-дампи джерела в SQLite. Використання: load.py <каталог_із_розпакованими_zip> <файл.db>"""
import sqlite3,glob,sys,os
db=sqlite3.connect(sys.argv[2]); n=0; err=0
for f in sorted(glob.glob(sys.argv[1]+'/*/*.sql')):
    s=open(f,encoding='utf-8').read()
    for st in s.split(';;'):
        st=st.strip()
        if not st: continue
        try: db.execute(st); n+=1
        except Exception as e: err+=1
db.commit(); print(n,err)
for (t,) in db.execute("select name from sqlite_master where type='table' order by 1"):
    print(t, db.execute(f'select count(*) from "{t}"').fetchone()[0])
