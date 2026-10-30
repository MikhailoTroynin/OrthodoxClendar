#!/usr/bin/env python3
"""Друкує главу Євангелія в перекладі Патріарха Філарета (як у додатку): bible.py <matt|mark|luke|john> <глава> — для цитат у перекладі тлумачень."""
import json, os, re, sys
f = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'data', 'bible', 'b', sys.argv[1] + '.ts')
chaps = json.loads(re.search(r'const C: BChap\[\] = (\[.*\]);', open(f, encoding='utf-8').read(), re.S).group(1))
n = 0
for v in chaps[int(sys.argv[2]) - 1]['v']:
    n = v[0] if isinstance(v, list) else n + 1
    print(n, v[1] if isinstance(v, list) else v)
