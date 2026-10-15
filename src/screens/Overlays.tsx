import React, { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FE, LIVES } from '../data/calendar';
import { CH_IMG } from '../data/channelImages';
import { MB, ROM, T } from '../data/prayers';
import { MOLYTVOSLOV } from '../data/molytvoslov';
import { VERS } from '../data/strings';
import { BackBar } from '../components/Chrome';
import { Body, Divider, Heading, Icon, Kicker, NavRow, NUM, OutlineButton, Press, Seg, Switch, card } from '../components/ui';
import { Rope } from './BookTab';
import { bookRow } from './BibleTab';
import { dayInfo, entryFor, fmtDate, fmtMD, addDays, searchYear, toKey, ymd, FULL_YEARS } from '../lib/calendar';
import { JAR_URL, Overlay, useStore } from '../store';
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
      {top.t === 'chap' && <Chapter o={top} />}
      {top.t === 'kath' && <Kathisma o={top} />}
      {top.t === 'pom' && <Pom />}
      {top.t === 'jesus' && <Jesus />}
      {top.t === 'search' && <Search />}
      {top.t === 'settings' && <Settings />}
      {top.t === 'donate' && <Donate />}
      {top.t === 'ver' && <Versions />}
    </View>
  );
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** Повний текст сторінки молитвослова (або лише розділів only): заголовки, рубрики (§), підзаголовки (#), примітки. */
function PrayerBook({ b, only, title, fs }: { b: (typeof MOLYTVOSLOV)[number]; only?: number[]; title?: string; fs: number }) {
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
  const { p, t, lang, fs, set } = useStore();
  const ul = lang === 'uk';
  const li = ul ? 0 : 1;
  const s = MB[o.s];
  const it = s.items[o.j];
  // Українською повний текст замінює план читання; англійською план лишається, а повний текст іде після нього.
  const outline = !it.mv || !ul;
  const sizeBtn = (label: string, delta: number) => (
    <Press
      label={label}
      onPress={() => set({ fs: Math.max(15, Math.min(25, fs + delta)) })}
      style={{ minWidth: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontFamily: FONT.headingBold, fontSize: 17, color: p.a700 }}>{label}</Text>
    </Press>
  );
  return (
    <>
      <BackBar
        kicker={ul ? s.u : s.e}
        right={
          <View style={{ flexDirection: 'row' }}>
            {sizeBtn('A−', -2)}
            {sizeBtn('A+', 2)}
          </View>
        }
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
            <Kicker style={{ marginBottom: 10 }}>{t.chapters}</Kicker>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Array.from({ length: b.ch }, (_, i) => i + 1).map((n) => (
                <Press
                  key={n}
                  onPress={() => push({ t: 'chap', title: `${name}, ${lang === 'uk' ? 'глава' : 'chapter'} ${n}` })}
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
      </Scroll>
    </>
  );
}

function Chapter({ o }: { o: Of<'chap'> }) {
  const { t } = useStore();
  return (
    <>
      <BackBar kicker={t.scripture} />
      <Scroll>
        <Title>{o.title}</Title>
        <Body size={14} mute={55}>{t.chapPh}</Body>
      </Scroll>
    </>
  );
}

function Kathisma({ o }: { o: Of<'kath'> }) {
  const { t, kd, set, p } = useStore();
  const done = kd.includes(o.k);
  const KATH = require('../data/prayers').KATH as string[];
  return (
    <>
      <BackBar kicker={t.psalter} />
      <Scroll>
        <Title>{`${t.kathisma} ${o.k}`}</Title>
        <Kicker style={{ marginBottom: 12 }}>{`${t.psalmsW} ${KATH[o.k - 1]}`}</Kicker>
        <Text style={{ fontFamily: FONT.body, fontStyle: 'italic', fontSize: 14, color: p.mute(65), marginBottom: 14 }}>{t.kathRubric}</Text>
        <Body size={14} mute={55} style={{ marginBottom: 24 }}>{t.kathPh}</Body>
        <OutlineButton
          label={done ? t.marked : t.markRead}
          onPress={() => set({ kd: done ? kd.filter((x) => x !== o.k) : [...kd, o.k] })}
          style={{ alignSelf: 'flex-start' }}
        />
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
  const { p, t, lang, cal, fs, nt, set } = useStore();
  const toggles: ['f' | 's' | 'n', string][] = [['f', t.nFeasts], ['s', t.nFasts], ['n', t.nNames]];
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
        <Kicker style={{ marginTop: 24, marginBottom: 4 }}>{t.notif}</Kicker>
        {toggles.map(([k, label]) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: p.divider }}>
            <Body size={15} style={{ flex: 1 }}>{label}</Body>
            <Switch on={nt[k]} label={label} onPress={() => set({ nt: { ...nt, [k]: !nt[k] } })} />
          </View>
        ))}
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
