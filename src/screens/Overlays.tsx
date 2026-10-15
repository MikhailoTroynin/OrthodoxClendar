import React, { useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FE, LIVES } from '../data/calendar';
import { CH_IMG } from '../data/channelImages';
import { MB, ROM, T } from '../data/prayers';
import { MOLYTVOSLOV, MvBook } from '../data/molytvoslov';
import { PSALTYR, kathIdx } from '../data/psaltyr';
import { VERS } from '../data/strings';
import { BackBar } from '../components/Chrome';
import { Body, Divider, Heading, Icon, Kicker, NavRow, NUM, OutlineButton, Press, Seg, Switch, card } from '../components/ui';
import { Rope } from './BookTab';
import { bookRow } from './BibleTab';
import { refOverlay, Verses } from '../components/Scripture';
import { BOOKS, bookItem, bookName, chapTitle, chapter, parseRefs, passage } from '../lib/bible';
import { dayInfo, entryFor, fmtDate, fmtMD, addDays, searchYear, toKey, ymd, FULL_YEARS } from '../lib/calendar';
import { JAR_URL, Overlay, useStore } from '../store';
import { NATIVE, notifPermission, Reminders } from '../lib/notify';
import { FONT, RADIUS } from '../theme';

type Of<K extends Overlay['t']> = Extract<Overlay, { t: K }>;

const Scroll = ({ children }: { children: React.ReactNode }) => (
  <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
    {children}
  </ScrollView>
);

const Title = ({ children }: { children: React.ReactNode }) => {
  const { p } = useStore();
  return (
    <Text style={{ fontFamily: FONT.heading, fontSize: 34, lineHeight: 38, letterSpacing: -0.5, color: p.text, marginBottom: 16 }}>
      {children}
    </Text>
  );
};

export function OverlayHost() {
  const { ov, p } = useStore();
  const top = ov[ov.length - 1];
  if (!top) return null;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: p.bg }}>
      {top.t === 'life' && <Life />}
      {top.t === 'sec' && <Sec o={top} />}
      {top.t === 'read' && <Reader o={top} />}
      {top.t === 'book' && <BookOv o={top} />}
      {top.t === 'chap' && <Chapter key={`${top.b}.${top.c}.${top.v ?? 0}`} o={top} />}
      {top.t === 'pass' && <Passage o={top} />}
      {top.t === 'kath' && <Kathisma o={top} />}
      {top.t === 'ps' && <PsPage o={top} />}
      {top.t === 'pom' && <Pom />}
      {top.t === 'jesus' && <Jesus />}
      {top.t === 'search' && <Search />}
      {top.t === 'settings' && <Settings />}
      {top.t === 'remind' && <Remind />}
      {top.t === 'donate' && <Donate />}
      {top.t === 'ver' && <Versions />}
    </View>
  );
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** Кнопки розміру тексту для читання. */
function SizeBtns() {
  const { p, fs, set } = useStore();
  const btn = (label: string, delta: number) => (
    <Press
      key={label}
      label={label}
      onPress={() => set({ fs: Math.max(15, Math.min(25, fs + delta)) })}
      style={{ minWidth: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontFamily: FONT.headingBold, fontSize: 17, color: p.a700 }}>{label}</Text>
    </Press>
  );
  return <View style={{ flexDirection: 'row' }}>{[btn('A−', -2), btn('A+', 2)]}</View>;
}

/** Повний текст сторінки молитвослова чи Псалтиря (або лише розділів only): заголовки, рубрики (§), підзаголовки (#), вірші (@N), примітки. */
function PrayerBook({ b, only, title, fs }: { b: MvBook; only?: number[]; title?: string; fs: number }) {
  const { p } = useStore();
  const body = { fontFamily: FONT.body, fontSize: fs, lineHeight: fs * 1.65, color: p.text } as const;
  const secs = only ? only.map((i) => b.secs[i]) : b.secs;
  // Примітки, на які посилаються показані розділи (⁽n⁾ у тексті).
  const used = new Set([...secs.flatMap((s) => [s.h ?? '', ...s.ps]).join('\n').matchAll(/⁽(\d+)⁾/g)].map((m) => +m[1] - 1));
  return (
    <View>
      {!!title && <Heading size={24} style={{ marginTop: 10, marginBottom: 4 }}>{title}</Heading>}
      {secs.map((s, i) => (
        <View key={i} style={{ marginBottom: 12 }}>
          {!!s.h && <Heading size={20} style={{ marginTop: 14, marginBottom: 8 }}>{s.h}</Heading>}
          {s.ps.map((t, j) =>
            t[0] === '§' ? (
              <Text key={j} style={{ ...body, fontStyle: 'italic', fontSize: fs - 2, lineHeight: (fs - 2) * 1.5, color: p.mute(65), marginBottom: 10 }}>{t.slice(1)}</Text>
            ) : t[0] === '#' ? (
              <Kicker key={j} style={{ marginTop: 6, marginBottom: 6 }}>{t.slice(1)}</Kicker>
            ) : t[0] === '@' ? (
              <Text key={j} style={{ ...body, marginBottom: 6 }}>
                <Text style={[{ fontFamily: FONT.headingBold, fontSize: fs - 3, color: p.a700 }, NUM]}>{t.slice(1, t.indexOf(' '))}</Text>
                {'\u2002' + t.slice(t.indexOf(' ') + 1)}
              </Text>
            ) : (
              <Text key={j} style={{ ...body, marginBottom: 10 }}>{t}</Text>
            ),
          )}
        </View>
      ))}
      {b.notes.some((n, k) => !!n && used.has(k)) && (
        <View style={{ borderTopWidth: 1, borderTopColor: p.divider, paddingTop: 12, marginBottom: 18, gap: 6 }}>
          {b.notes.map((n, k) => !!n && used.has(k) && (
            <Text key={k} style={{ fontFamily: FONT.body, fontSize: fs - 4, lineHeight: (fs - 4) * 1.5, color: p.mute(65) }}>
              {`⁽${[...String(k + 1)].map((c) => SUP[+c]).join('')}⁾ ${n.replace(/<[^>]+>/g, '')}`}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function Life() {
  const { t, lang, cal, date, p } = useStore();
  const day = dayInfo(date, cal, lang);
  const paras = day.lifeKey ? LIVES[day.lifeKey][lang] : [];
  return (
    <>
      <BackBar kicker={t.life2} />
      <Scroll>
        <Title>{day.title}</Title>
        <Kicker style={{ marginBottom: 14 }}>{fmtDate(date, lang)}</Kicker>
        {paras.map((x, i) => (
          <Text key={i} style={{ fontFamily: FONT.body, fontSize: 17, lineHeight: 28, color: p.text, marginBottom: 14 }}>
            {x}
          </Text>
        ))}
      </Scroll>
    </>
  );
}

function Sec({ o }: { o: Of<'sec'> }) {
  const { p, t, lang, push } = useStore();
  const ul = lang === 'uk';
  const s = MB[o.s];
  return (
    <>
      <BackBar kicker={t.prayerBook} />
      <Scroll>
        <Kicker style={{ marginBottom: 6 }}>{ROM[o.s]}</Kicker>
        <Title>{ul ? s.u : s.e}</Title>
        <View style={card(p)}>
          {s.items.map((it, j) => (
            <NavRow
              key={j}
              title={ul ? it.u : it.e}
              sub={ul ? it.mu : it.me}
              onPress={() => push({ t: 'read', s: o.s, j })}
              last={j === s.items.length - 1}
            />
          ))}
        </View>
      </Scroll>
    </>
  );
}

function Reader({ o }: { o: Of<'read'> }) {
  const { p, t, lang, fs } = useStore();
  const ul = lang === 'uk';
  const li = ul ? 0 : 1;
  const s = MB[o.s];
  const it = s.items[o.j];
  // Українською повний текст замінює план читання; англійською план лишається, а повний текст іде після нього.
  const outline = !it.mv || !ul;
  return (
    <>
      <BackBar
        kicker={ul ? s.u : s.e}
        right={<SizeBtns />}
      />
      <Scroll>
        <Title>{ul ? it.u : it.e}</Title>
        {!!(ul ? it.mu : it.me) && <Body size={12.5} mute={60} style={{ marginBottom: 14 }}>{ul ? it.mu : it.me}</Body>}
        {it.img && CH_IMG[it.img.id] && (
          <Image
            source={CH_IMG[it.img.id]}
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            style={{ width: '100%', aspectRatio: it.img.w / it.img.h, maxHeight: 420, marginBottom: 18, borderRadius: RADIUS, backgroundColor: p.divider }}
          />
        )}
        {!!it.x && <Text style={{ fontFamily: FONT.body, fontSize: fs, lineHeight: fs * 1.65, color: p.text }}>{it.x}</Text>}
        {it.r && (
          <Text style={{ fontFamily: FONT.body, fontStyle: 'italic', fontSize: fs - 3, lineHeight: (fs - 3) * 1.5, color: p.mute(65), marginBottom: 16 }}>
            {it.r[li]}
          </Text>
        )}
        {outline && (it.b ?? []).map((b, i) => (
          <View key={i} style={{ marginBottom: 18 }}>
            {b.h && <Kicker style={{ marginBottom: 6 }}>{b.h[li]}</Kicker>}
            {b.r && (
              <Text style={{ fontFamily: FONT.body, fontStyle: 'italic', fontSize: fs - 3, lineHeight: (fs - 3) * 1.5, color: p.mute(65), marginBottom: 6 }}>
                {b.r[li]}
              </Text>
            )}
            {b.t && <Text style={{ fontFamily: FONT.body, fontSize: fs, lineHeight: fs * 1.65, color: p.text }}>{T[b.t][li]}</Text>}
          </View>
        ))}
        {outline && it.p && it.p.length > 0 && (
          <>
            <Kicker style={{ marginBottom: 6 }}>{t.order}</Kicker>
            {it.p.map((x, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.divider }}>
                <Text style={[{ width: 22, fontFamily: FONT.headingBold, fontSize: 17, color: p.a700 }, NUM]}>{i + 1}</Text>
                <Text style={{ flex: 1, fontFamily: FONT.body, fontSize: 15, color: p.text }}>{x[li]}</Text>
              </View>
            ))}
          </>
        )}
        {it.mv && (
          <View style={{ marginTop: outline && (it.b || it.p) ? 24 : 0 }}>
            {outline && (it.b || it.p) && <Kicker style={{ marginBottom: 6 }}>{t.fullText}</Kicker>}
            {it.mv.map((m, k) => (
              <PrayerBook key={k} b={MOLYTVOSLOV[m.b]} only={m.s} title={it.mv!.length > 1 && !m.s ? MOLYTVOSLOV[m.b].u : undefined} fs={fs} />
            ))}
          </View>
        )}
        {!it.full && <Body size={12.5} mute={55} style={{ marginTop: 18 }}>{t.outlineNote}</Body>}
      </Scroll>
    </>
  );
}

function BookOv({ o }: { o: Of<'book'> }) {
  const { p, t, lang, push } = useStore();
  const b = o.b;
  const name = lang === 'uk' ? b.u : b.e;
  return (
    <>
      <BackBar kicker={t.scripture} />
      <Scroll>
        <Title>{name}</Title>
        {b.ch ? (
          <>
            <Kicker style={{ marginBottom: 10 }}>{b.i !== undefined && BOOKS[b.i][0] === 'ps' ? t.psalmsW : t.chapters}</Kicker>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Array.from({ length: b.ch }, (_, i) => i + 1).map((n) => (
                <Press
                  key={n}
                  onPress={() => b.i !== undefined && push({ t: 'chap', b: b.i, c: n })}
                  style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: p.divider }}
                >
                  <Text style={[{ fontFamily: FONT.headingBold, fontSize: 20, color: p.text }, NUM]}>{n}</Text>
                </Press>
              ))}
            </View>
          </>
        ) : (
          <View style={card(p)}>
            {b.books!.map((x, i) => {
              const r = bookRow(x, lang, t, () => push({ t: 'book', b: x }), i === b.books!.length - 1);
              return <NavRow key={i} title={r.title} sub={r.sub} onPress={r.go} last={r.last} />;
            })}
          </View>
        )}
        {(b.books ?? [b]).some((x) => x.u.endsWith('*')) && <Body size={12.5} mute={55} style={{ marginTop: 16 }}>{t.deutero}</Body>}
      </Scroll>
    </>
  );
}

/** Глава Біблії: вірші з номерами й паралельними місцями, перехід до сусідніх глав. */
function Chapter({ o }: { o: Of<'chap'> }) {
  const { p, t, lang, push, replace } = useStore();
  const ul = lang === 'uk';
  const ref = useRef<ScrollView>(null);
  const done = useRef(false);
  const top = useRef(0);
  const { h, vs } = chapter(o.b, o.c);
  const last = BOOKS[o.b][5];
  const prev = o.c > 1 ? { b: o.b, c: o.c - 1 } : o.b > 0 ? { b: o.b - 1, c: BOOKS[o.b - 1][5] } : null;
  const next = o.c < last ? { b: o.b, c: o.c + 1 } : o.b < BOOKS.length - 1 ? { b: o.b + 1, c: 1 } : null;
  const label = (x: { b: number; c: number }) => (x.b === o.b ? chapTitle(x.b, x.c, ul) : `${BOOKS[x.b][2]} ${x.c}`);
  const book = bookItem(o.b);
  return (
    <>
      <BackBar right={<SizeBtns />} />
      <ScrollView ref={ref} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 40 }}>
        <Press onPress={() => push({ t: 'book', b: book })} style={{ alignSelf: 'flex-start', marginBottom: 6 }}>
          <Kicker>{`${bookName(o.b, ul)} · ${t.translation}`}</Kicker>
        </Press>
        <Title>{chapTitle(o.b, o.c, ul)}</Title>
        {h ? <Text style={{ fontFamily: FONT.body, fontStyle: 'italic', fontSize: 14, color: p.mute(65), marginBottom: 10 }}>{h}</Text> : null}
        <View onLayout={(e) => (top.current = e.nativeEvent.layout.y)}>
        <Verses
          vs={vs}
          b={o.b}
          c={o.c}
          hl={o.v ? [o.v, o.v2 ?? o.v] : undefined}
          onY={(n, y) => {
            // y — відносно списку віршів; зсув самого списку знаємо з onLayout обгортки.
            if (o.v && n === o.v && !done.current) {
              done.current = true;
              setTimeout(() => ref.current?.scrollTo({ y: Math.max(0, top.current + y - 12), animated: false }), 50);
            }
          }}
        />
        </View>
        <Body size={12} mute={55} style={{ marginTop: 14 }}>{t.xrefHelp}</Body>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 18 }}>
          {prev ? <OutlineButton label={`← ${label(prev)}`} onPress={() => replace({ t: 'chap', ...prev })} /> : <View />}
          {next ? <OutlineButton label={`${label(next)} →`} onPress={() => replace({ t: 'chap', ...next })} /> : <View />}
        </View>
      </ScrollView>
    </>
  );
}

/** Читання дня або інше місце Писання за посиланням: усі уривки підряд. */
function Passage({ o }: { o: Of<'pass'> }) {
  const { t, push } = useStore();
  const refs = parseRefs(o.s);
  return (
    <>
      <BackBar right={<SizeBtns />} />
      <Scroll>
        <Kicker style={{ marginBottom: 6 }}>{`${o.title} · ${t.translation}`}</Kicker>
        <Title>{o.s}</Title>
        {refs.length === 0 && <Body size={14} mute={60}>{t.refNotFound}</Body>}
        {refs.map((r, i) => (
          <View key={i} style={{ marginBottom: 18 }}>
            <Press onPress={() => push(refOverlay(r))} style={{ alignSelf: 'flex-start', marginBottom: 6 }}>
              <Heading size={18}>{`${r.label} ›`}</Heading>
            </Press>
            <Verses vs={passage(r)} b={r.b} c={r.c} />
          </View>
        ))}
        {refs.length > 0 && <Body size={12} mute={55}>{t.xrefHelp}</Body>}
      </Scroll>
    </>
  );
}

function Kathisma({ o }: { o: Of<'kath'> }) {
  const { t, kd, set, p, fs, lang, push } = useStore();
  const done = kd.includes(o.k);
  const KATH = require('../data/prayers').KATH as string[];
  const mark = (
    <OutlineButton
      label={done ? t.marked : t.markRead}
      onPress={() => set({ kd: done ? kd.filter((x) => x !== o.k) : [...kd, o.k] })}
      style={{ alignSelf: 'flex-start' }}
    />
  );
  return (
    <>
      <BackBar right={<SizeBtns />} />
      <Scroll>
        <Kicker style={{ marginBottom: 6 }}>{t.psalter}</Kicker>
        <Title>{`${t.kathisma} ${o.k}`}</Title>
        <Kicker style={{ marginBottom: 12 }}>{`${t.psalmsW} ${KATH[o.k - 1]}`}</Kicker>
        <Text style={{ fontFamily: FONT.body, fontStyle: 'italic', fontSize: 14, color: p.mute(65), marginBottom: 14 }}>{t.kathRubric}</Text>
        <Press onPress={() => push({ t: 'ps', i: 1 })} style={{ marginBottom: 18 }}>
          <Text style={{ fontFamily: FONT.body, fontSize: 14, color: p.a700, textDecorationLine: 'underline' }}>{lang === 'uk' ? PSALTYR[1].u : PSALTYR[1].e}</Text>
        </Press>
        <PrayerBook b={PSALTYR[kathIdx(o.k)]} fs={fs} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          {mark}
          {o.k < 20 && <OutlineButton label={`${t.kathisma} ${o.k + 1} →`} onPress={() => push({ t: 'kath', k: o.k + 1 })} />}
        </View>
      </Scroll>
    </>
  );
}

/** Інші сторінки Слідуваного Псалтиря: як читати, молитви перед і після читання, пісні Писання. */
function PsPage({ o }: { o: Of<'ps'> }) {
  const { t, fs, lang } = useStore();
  const b = PSALTYR[o.i];
  return (
    <>
      <BackBar right={<SizeBtns />} />
      <Scroll>
        <Kicker style={{ marginBottom: 6 }}>{t.psalter}</Kicker>
        <Title>{lang === 'uk' ? b.u : b.e}</Title>
        {lang !== 'uk' && <Body size={12.5} mute={60} style={{ marginBottom: 14 }}>{t.fullText}</Body>}
        <PrayerBook b={b} fs={fs} />
      </Scroll>
    </>
  );
}

function Pom() {
  const { p, t, pom, set } = useStore();
  const [inp, setInp] = useState({ h: '', r: '' });
  const lists: ['h' | 'r', string][] = [['h', t.health], ['r', t.repose]];
  return (
    <>
      <BackBar kicker={t.personal} />
      <Scroll>
        <Title>{t.pom}</Title>
        <Body size={13} mute={65} style={{ marginBottom: 20 }}>{t.pomHelp}</Body>
        {lists.map(([k, h]) => (
          <View key={k} style={{ marginBottom: 26 }}>
            <Kicker style={{ paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: p.divider }}>{h}</Kicker>
            {pom[k].map((name, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: p.divider }}>
                <Text style={{ fontFamily: FONT.headingBold, fontSize: 19, color: p.text, paddingVertical: 10 }}>{name}</Text>
                <Press label="×" onPress={() => set({ pom: { ...pom, [k]: pom[k].filter((_, j) => j !== i) } })} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="x" size={18} color={p.mute(60)} />
                </Press>
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TextInput
                value={inp[k]}
                onChangeText={(v) => setInp((s) => ({ ...s, [k]: v }))}
                placeholder={t.namePh}
                placeholderTextColor={p.mute(45)}
                style={{ flex: 1, minHeight: 40, paddingHorizontal: 10, borderWidth: 1, borderColor: p.divider, borderRadius: RADIUS, color: p.text, fontFamily: FONT.body, fontSize: 15 }}
              />
              <OutlineButton
                label={t.add}
                onPress={() => {
                  const v = inp[k].trim();
                  if (!v) return;
                  set({ pom: { ...pom, [k]: [...pom[k], v] } });
                  setInp((s) => ({ ...s, [k]: '' }));
                }}
              />
            </View>
          </View>
        ))}
      </Scroll>
    </>
  );
}

function Jesus() {
  const { p, t, jc, jt, set } = useStore();
  return (
    <>
      <BackBar kicker={t.jesusSub} />
      <Scroll>
        <Title>{t.jesus}</Title>
        <Text style={{ fontFamily: FONT.body, fontStyle: 'italic', fontSize: 17, lineHeight: 26, color: p.text, textAlign: 'center', marginVertical: 8 }}>
          {t.jesusText}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.jTapHint}
          onPress={() => set({ jc: jc >= jt ? 1 : jc + 1 })}
          style={{ alignSelf: 'center', marginVertical: 24, width: 240, height: 240, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ position: 'absolute' }}>
            <Rope progress={Math.min(jc, jt) / jt} size={240} />
          </View>
          <Text style={[{ fontFamily: FONT.heading, fontSize: 72, color: p.text }, NUM]}>{jc}</Text>
          <Body size={13} mute={60}>{`${t.of} ${jt}`}</Body>
        </Pressable>
        <Body size={13} mute={65} style={{ textAlign: 'center', marginBottom: 20 }}>{jc >= jt ? t.jDone : t.jTapHint}</Body>
        <Seg opts={[33, 100, 500].map((n) => ({ label: String(n), on: jt === n, onPress: () => set({ jt: n }) }))} />
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <OutlineButton label={t.reset} onPress={() => set({ jc: 0 })} />
        </View>
      </Scroll>
    </>
  );
}

function Search() {
  const { p, t, lang, cal, q, setQ, openDay, openFeasts, setDate, push, today } = useStore();
  const ul = lang === 'uk';
  const li = ul ? 0 : 1;
  const ql = q.trim().toLowerCase();
  const results: { title: string; sub: string; go: () => void }[] = [];
  if (ql.length >= 2) {
    // Повний календар (2026 і 2027): шукаємо по всій пам'яті кожного дня, спершу поточний рік.
    const y = today.getFullYear();
    const seen = new Set<string>();
    [...FULL_YEARS].sort((a, b) => Number(b === y) - Number(a === y) || a - b).forEach((yr) =>
      searchYear(yr, cal, ql, 40).forEach(({ text, date }) => {
        seen.add(toKey(date));
        results.push({ title: text, sub: fmtDate(date, lang), go: () => openDay(date) });
      }),
    );
    // Ручні дані (вересень і жовтень): назва й іменини, зокрема для днів поза повним календарем.
    for (let i = -20; i <= 40; i++) {
      const dt = addDays(ymd(y, 9, 15), i);
      if (seen.has(toKey(dt))) continue;
      const e = entryFor(dt, cal);
      if (e && ((e[li] as string).toLowerCase().includes(ql) || (e[li + 2] as string).toLowerCase().includes(ql)))
        results.push({ title: e[li] as string, sub: fmtDate(dt, lang), go: () => openDay(dt) });
    }
    FE.forEach((f) => {
      if (f[lang].toLowerCase().includes(ql))
        results.push({ title: f[lang], sub: `${t.sFeasts} · ${fmtMD(f[cal][0], f[cal][1], lang)}`, go: openFeasts });
    });
    MB.forEach((s, si) =>
      s.items.forEach((it, j) => {
        const n = ul ? it.u : it.e;
        if (n.toLowerCase().includes(ql)) results.push({ title: n, sub: ul ? s.u : s.e, go: () => push({ t: 'read', s: si, j }) });
      }),
    );
    // Посилання на Писання («Ін. 3:16», «Gal 5:22–6:2») і назви книг Біблії.
    parseRefs(q.trim()).forEach((r) =>
      results.push({ title: r.label, sub: `${bookName(r.b, ul)} · ${t.scripture}`, go: () => push(refOverlay(r)) }),
    );
    BOOKS.forEach((_, i) => {
      const n = bookName(i, ul);
      if (n.toLowerCase().includes(ql)) results.push({ title: n, sub: t.scripture, go: () => push({ t: 'book', b: bookItem(i) }) });
    });
    // «Псалом 50», «пс 50», «psalm 50» — точно цей псалом; інакше — збіг у назвах сторінок і розділів Псалтиря.
    const psN = ql.match(/^(?:psalm|ps|псалом|пс)\.?\s*(\d{1,3})$/)?.[1];
    PSALTYR.forEach((b, i) => {
      const go = () => push(i >= 2 && i <= 21 ? { t: 'kath', k: i - 1 } : { t: 'ps', i });
      const n = ul ? b.u : b.e;
      if (n.toLowerCase().includes(ql)) results.push({ title: n, sub: t.psalter, go });
      b.secs.forEach((x) => {
        if (x.h && (psN ? x.h === `Псалом ${psN}` : x.h.toLowerCase().includes(ql))) results.push({ title: x.h, sub: `${t.psalter} · ${n}`, go });
      });
    });
  }
  void setDate;
  return (
    <>
      <BackBar kicker={t.search} />
      <Scroll>
        <TextInput
          autoFocus
          value={q}
          onChangeText={setQ}
          placeholder={t.searchPh}
          placeholderTextColor={p.mute(45)}
          style={{ minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: p.accent, borderRadius: RADIUS, color: p.text, fontFamily: FONT.body, fontSize: 16 }}
        />
        {ql.length < 2 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {(t.sgs as string[]).map((s) => (
              <Press key={s} onPress={() => setQ(s)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: p.divider }}>
                <Text style={{ fontFamily: FONT.body, fontSize: 13, color: p.text }}>{s}</Text>
              </Press>
            ))}
          </View>
        )}
        {ql.length >= 2 && results.length === 0 && <Body size={14} mute={60} style={{ marginTop: 20 }}>{t.noRes}</Body>}
        <View style={{ marginTop: 12 }}>
          {results.map((r, i) => (
            <NavRow key={i} title={r.title} sub={r.sub} onPress={r.go} last={i === results.length - 1} />
          ))}
        </View>
      </Scroll>
    </>
  );
}

function Settings() {
  const { p, t, lang, cal, fs, rm, set, push } = useStore();
  const on = [rm.eve && rm.eveT, rm.morn && rm.mornT].filter(Boolean) as string[];
  const rmSub = on.length || rm.pre ? [...on, rm.pre ? t.rPre : ''].filter(Boolean).join(' · ') : t.rOffAll;
  return (
    <>
      <BackBar kicker={t.app} />
      <Scroll>
        <Title>{t.settings}</Title>
        <Kicker style={{ marginBottom: 8 }}>{t.lang}</Kicker>
        <Seg opts={[{ label: 'Українська', on: lang === 'uk', onPress: () => set({ lang: 'uk' }) }, { label: 'English', on: lang === 'en', onPress: () => set({ lang: 'en' }) }]} />
        <Kicker style={{ marginTop: 24, marginBottom: 8 }}>{t.calendar}</Kicker>
        <Seg opts={[{ label: t.nj, on: cal === 'nj', onPress: () => set({ cal: 'nj' }) }, { label: t.oj, on: cal === 'oj', onPress: () => set({ cal: 'oj' }) }]} />
        <Body size={12.5} mute={65} style={{ marginTop: 8 }}>{(cal === 'nj' ? t.helpNj : t.helpOj) + t.helpP}</Body>
        <Kicker style={{ marginTop: 24, marginBottom: 4 }}>{t.textSize}</Kicker>
        <Seg opts={[17, 19, 21].map((v, i) => ({ label: t.sizes[i], on: fs === v, onPress: () => set({ fs: v }) }))} />
        <Kicker style={{ marginTop: 24, marginBottom: 8 }}>{t.notif}</Kicker>
        <View style={card(p)}>
          <NavRow title={t.rTitle} sub={rmSub} onPress={() => push({ t: 'remind' })} last />
        </View>
        <Kicker style={{ marginTop: 24, marginBottom: 8 }}>{t.about}</Kicker>
        <View style={card(p)}>
          <NavRow title={t.versions} value={VERS[0].n} onPress={() => push({ t: 'ver' })} last />
        </View>
      </Scroll>
    </>
  );
}

const EVE_TIMES = ['19:00', '20:00', '21:00'];
const MORN_TIMES = ['06:00', '07:00', '08:00'];

/** Зсув часу «ГГ:ХХ» на n хвилин у межах доби. */
const shiftTime = (hhmm: string, n: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const v = (((h * 60 + m + n) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};

/** Налаштування нагадувань: увечері — про завтра, вранці — про сьогодні, перед святом. */
function Remind() {
  const { p, t, rm, set } = useStore();
  const [other, setOther] = useState<{ eveT: boolean; mornT: boolean }>({
    eveT: !EVE_TIMES.includes(rm.eveT),
    mornT: !MORN_TIMES.includes(rm.mornT),
  });
  const [denied, setDenied] = useState(false);
  const upd = (patch: Partial<Reminders>) => {
    const next = { ...rm, ...patch };
    set({ rm: next });
    // Дозвіл питаємо, коли людина вмикає нагадування.
    if (NATIVE && (next.eve || next.morn || next.pre || next.show.p)) notifPermission(true).then((r) => setDenied(r === 'denied'));
  };

  const chip = (label: string, on: boolean, onPress: () => void, num = true) => (
    <Press
      key={label}
      onPress={onPress}
      style={{ paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: on ? p.accent : p.divider, justifyContent: 'center' }}
    >
      <Text style={[num ? { fontFamily: FONT.headingBold, fontSize: 17 } : { fontFamily: FONT.body, fontSize: 14 }, { color: on ? p.a700 : p.text }, NUM]}>
        {label}
      </Text>
    </Press>
  );

  const block = (k: 'eve' | 'morn', title: string, sub: string, key: 'eveT' | 'mornT', presets: string[]) => {
    const cur = rm[key];
    const isOther = other[key];
    return (
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: p.divider }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Heading size={19}>{title}</Heading>
            <Body size={12.5} mute={60} style={{ marginTop: 3 }}>{sub}</Body>
          </View>
          <Switch on={rm[k]} label={title} onPress={() => upd({ [k]: !rm[k] } as Partial<Reminders>)} />
        </View>
        {rm[k] && (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {presets.map((x) =>
                chip(x, !isOther && cur === x, () => {
                  setOther((o) => ({ ...o, [key]: false }));
                  upd({ [key]: x } as Partial<Reminders>);
                }),
              )}
              {chip(isOther ? cur : t.rOther, isOther, () => setOther((o) => ({ ...o, [key]: true })), isOther)}
            </View>
            {isOther && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                {chip('−1:00', false, () => upd({ [key]: shiftTime(cur, -60) } as Partial<Reminders>), false)}
                {chip('−0:15', false, () => upd({ [key]: shiftTime(cur, -15) } as Partial<Reminders>), false)}
                {chip('+0:15', false, () => upd({ [key]: shiftTime(cur, 15) } as Partial<Reminders>), false)}
                {chip('+1:00', false, () => upd({ [key]: shiftTime(cur, 60) } as Partial<Reminders>), false)}
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  const shows: ['f' | 'r' | 'n' | 'p', string][] = [['f', t.rFast], ['r', t.rRead], ['n', t.rNames], ['p', t.rPray]];
  return (
    <>
      <BackBar />
      <Scroll>
        <Title>{t.rTitle}</Title>
        <View style={card(p)}>
          {block('eve', t.rEve, t.rEveSub, 'eveT', EVE_TIMES)}
          {block('morn', t.rMorn, t.rMornSub, 'mornT', MORN_TIMES)}
          <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Heading size={19}>{t.rPre}</Heading>
              <Body size={12.5} mute={60} style={{ marginTop: 3 }}>{t.rPreSub}</Body>
            </View>
            <Switch on={rm.pre} label={t.rPre} onPress={() => upd({ pre: !rm.pre })} />
          </View>
        </View>
        <Kicker style={{ marginTop: 26, marginBottom: 8 }}>{t.rShow}</Kicker>
        <View style={card(p)}>
          {shows.map(([k, label], i) => (
            <Press
              key={k}
              onPress={() => upd({ show: { ...rm.show, [k]: !rm.show[k] } })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 0,
                borderBottomWidth: i === shows.length - 1 ? 0 : 1,
                borderBottomColor: p.divider,
              }}
            >
              <Body size={15} style={{ flex: 1 }}>{label}</Body>
              <Text accessibilityLabel={rm.show[k] ? '✓' : '—'} style={{ fontFamily: FONT.body, fontSize: 16, color: rm.show[k] ? p.a700 : p.mute(35) }}>
                {rm.show[k] ? '✓' : '—'}
              </Text>
            </Press>
          ))}
        </View>
        {(denied || !NATIVE) && (
          <Body size={12.5} mute={65} style={{ marginTop: 16 }}>{NATIVE ? t.rDenied : t.rWeb}</Body>
        )}
      </Scroll>
    </>
  );
}

function Donate() {
  const { p, t, amt, set } = useStore();
  const [copied, setCopied] = useState(false);
  return (
    <>
      <BackBar kicker={t.support} />
      <Scroll>
        <Title>{t.supportRow}</Title>
        <Body size={14} mute={75} style={{ marginBottom: 20 }}>{t.donateText}</Body>
        <Kicker style={{ marginBottom: 8 }}>{t.amount}</Kicker>
        <Seg opts={[50, 100, 200, 500].map((n) => ({ label: String(n), on: amt === n, onPress: () => set({ amt: n }) }))} />
        <Body size={12} mute={55} style={{ marginTop: 8, marginBottom: 20 }}>{t.amountHint}</Body>
        <OutlineButton label={`${t.donate}${amt} ₴`} onPress={() => Linking.openURL(JAR_URL)} style={{ alignItems: 'center' }} />
        <Divider />
        <Body size={12} mute={60}>{t.qrHint}</Body>
        <Text selectable style={{ fontFamily: FONT.body, fontSize: 13, color: p.a700, marginVertical: 8 }}>{JAR_URL.replace('https://', '')}</Text>
        <OutlineButton
          label={copied ? t.copied : t.copy}
          style={{ alignSelf: 'flex-start' }}
          onPress={async () => {
            await Clipboard.setStringAsync(JAR_URL);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
        />
        {copied && <Body size={13} style={{ color: p.a700, marginTop: 12 }}>{t.thanks}</Body>}
      </Scroll>
    </>
  );
}

function Versions() {
  const { p, t, lang } = useStore();
  const ul = lang === 'uk';
  return (
    <>
      <BackBar kicker={t.about} />
      <Scroll>
        <Title>{t.versions}</Title>
        <Body size={13} mute={65} style={{ marginBottom: 12 }}>{t.verHelp}</Body>
        {VERS.map((v, i) => (
          <View key={v.n} style={{ paddingVertical: 16, borderTopWidth: 1, borderTopColor: p.divider, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
              <Text style={{ fontFamily: FONT.headingBold, fontSize: 22, color: p.text }}>{v.n}</Text>
              <Body size={12} mute={60}>{`${fmtMD(v.m[0], v.m[1], lang)} 2026`}</Body>
              {i === 0 && <Kicker>{t.current}</Kicker>}
            </View>
            <Heading size={17}>{ul ? v.uk : v.en}</Heading>
            {(ul ? v.iu : v.ie).map((x, j) => (
              <Body key={j} size={13.5} mute={80}>{`• ${x}`}</Body>
            ))}
          </View>
        ))}
      </Scroll>
    </>
  );
}
