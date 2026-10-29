import React, { useMemo, useRef, useState } from 'react';
import { Linking, PanResponder, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FE, LIVES } from '../data/calendar';
import type { MvBook } from '../data/molytvoslov';
import type { Section } from '../data/prayers';
import { KATH, ROM } from '../data/prayerLists';
import { PL, VERS } from '../data/strings';
import { BackBar } from '../components/Chrome';
import { Anchor, MarkBtn, ReadScroll, ReadScrollHandle, useToast } from '../components/ReadScroll';
import { Body, Divider, Heading, Icon, Kicker, NavRow, NUM, OutlineButton, Press, Seg, Switch, card } from '../components/ui';
import { Rope } from './BookTab';
import { bookRow, PsalterBlock } from './BibleTab';
import { refOverlay, Verses } from '../components/Scripture';
import { BOOK, BOOKS, bookItem, bookName, chapTitle, chapter, parseRefs, passage } from '../lib/bible';
import { Lazy, prayersL, psaltyrL, useLazy } from '../lib/lazy';
import { yearsL } from '../lib/calendar';
import { Gate, Loading } from '../components/Lazy';
import { dayInfo, entryFor, fmtDate, fmtMD, addDays, searchYear, toKey, ymd, FULL_YEARS, MN } from '../lib/calendar';
import { JAR_URL, Mark, Overlay, markKey, useStore } from '../store';
import { Angel, angelDate, NATIVE, notifPermission, Reminders } from '../lib/notify';
import { FONT, RADIUS } from '../theme';
import { entry, Entry, fuzzySearch } from '../lib/fuzzy';
import { bookText, speak, stopSpeaking, useSpeaking } from '../lib/speech';
import { TlumBtn, TlumMark } from '../components/Tlum';

type Of<K extends Overlay['t']> = Extract<Overlay, { t: K }>;

const Scroll = ({ children, scrollEnabled }: { children: React.ReactNode; scrollEnabled?: boolean }) => (
  <ScrollView scrollEnabled={scrollEnabled} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
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
  // Екрани з великими текстами з'являються, щойно завантажено потрібні дані.
  const need = (ls: Lazy<unknown>[], el: React.ReactNode) => (
    <Gate
      need={ls}
      fallback={
        <>
          <BackBar />
          <Loading />
        </>
      }
    >
      {el}
    </Gate>
  );
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: p.bg }}>
      {top.t === 'life' && <Life />}
      {top.t === 'sec' && need([prayersL], <Sec o={top} />)}
      {top.t === 'read' && need([prayersL], <ReaderGate key={`${top.s}.${top.j}`} o={top} />)}
      {top.t === 'book' && <BookOv o={top} />}
      {top.t === 'chap' && need([BOOK[top.b]], <Chapter key={`${top.b}.${top.c}.${top.v ?? 0}`} o={top} />)}
      {top.t === 'pass' && need([...new Set(parseRefs(top.s).map((r) => BOOK[r.b]))], <Passage o={top} />)}
      {top.t === 'kath' && need([psaltyrL], <Kathisma key={top.k} o={top} />)}
      {top.t === 'ps' && need([psaltyrL], <PsPage key={top.i} o={top} />)}
      {top.t === 'psalter' && need([psaltyrL], <Psalter />)}
      {top.t === 'pom' && <Pom />}
      {top.t === 'jesus' && <Jesus />}
      {top.t === 'search' && <Search />}
      {top.t === 'settings' && <Settings />}
      {top.t === 'remind' && <Remind />}
      {top.t === 'angels' && <Angels />}
      {top.t === 'donate' && <Donate />}
      {top.t === 'ver' && <Versions />}
      {top.t === 'marks' && <Marks />}
    </View>
  );
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** Кнопки розміру тексту для читання; з read — ще й кнопка читання вголос.
 *  Українською кнопку поки сховано: системний синтез мовлення ставить хибні наголоси й читає з англійським акцентом. */
function SizeBtns({ read, mark }: { read?: () => string[]; mark?: () => void }) {
  const { p, fs, set, t, lang } = useStore();
  const speaking = useSpeaking();
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
  return (
    <View style={{ flexDirection: 'row' }}>
      {mark && <MarkBtn onPress={mark} />}
      {read && lang !== 'uk' && (
        <Press
          label={speaking ? t.stopListen : t.listen}
          onPress={() => (speaking ? stopSpeaking() : speak(read(), lang))}
          style={{ minWidth: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name={speaking ? 'stop' : 'speaker'} color={p.a700} />
        </Press>
      )}
      {btn('A−', -2)}
      {btn('A+', 2)}
    </View>
  );
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
      {!!title && (
        <Anchor text={title} h>
          <Heading size={24} style={{ marginTop: 10, marginBottom: 4 }}>{title}</Heading>
        </Anchor>
      )}
      {secs.map((s, i) => {
        // Сторінка псалма: біля назви й номерів віршів — значок тлумачення.
        const psN = Number(/^Псалом (\d+)$/.exec(s.h ?? '')?.[1]) || 0;
        return (
        <View key={i} style={{ marginBottom: 12 }}>
          {!!s.h && (
            <Anchor text={s.h} h>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14, marginBottom: 8 }}>
                <Heading size={20}>{s.h}</Heading>
                {psN > 0 && <TlumBtn n={psN} />}
              </View>
            </Anchor>
          )}
          {s.ps.map((t, j) =>
            t[0] === '§' ? (
              <Anchor key={j} text={t.slice(1)}>
                <Text style={{ ...body, fontStyle: 'italic', fontSize: fs - 2, lineHeight: (fs - 2) * 1.5, color: p.mute(65), marginBottom: 10 }}>{t.slice(1)}</Text>
              </Anchor>
            ) : t[0] === '#' ? (
              <Anchor key={j} text={t.slice(1)} h>
                <Kicker style={{ marginTop: 6, marginBottom: 6 }}>{t.slice(1)}</Kicker>
              </Anchor>
            ) : t[0] === '@' ? (
              <Anchor key={j} text={t.slice(t.indexOf(' ') + 1)}>
                <Text style={{ ...body, marginBottom: 6 }}>
                  <Text style={[{ fontFamily: FONT.headingBold, fontSize: fs - 3, color: p.a700 }, NUM]}>{t.slice(1, t.indexOf(' '))}</Text>
                  {psN > 0 && <TlumMark n={psN} v={+t.slice(1, t.indexOf(' '))} size={fs * 0.7} />}
                  {'\u2002' + t.slice(t.indexOf(' ') + 1)}
                </Text>
              </Anchor>
            ) : (
              <Anchor key={j} text={t}>
                <Text style={{ ...body, marginBottom: 10 }}>{t}</Text>
              </Anchor>
            ),
          )}
        </View>
        );
      })}
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

/** Розділи, довші за цю кількість молитов, не вміщаються на екран — над ними поле пошуку. */
const SEC_SEARCH = 8;
/** Останній запит у кожному розділі: лишається, коли повертаєшся з молитви до переліку. */
const secQ: Record<number, string> = {};
/** Підготовлені до нечіткого пошуку назви молитов (обома мовами і з групою) за розділами. */
const secIdx = new WeakMap<object, Entry[]>();
const secEntries = (items: Section['items']) => {
  let es = secIdx.get(items);
  if (!es) secIdx.set(items, (es = items.map((it) => entry(it.u, it.e))));
  return es;
};
/** Усі молитви молитвослова одним переліком (для загального пошуку) і їхні підготовлені назви. */
const flatIdx = new WeakMap<object, { flat: { s: Section; si: number; it: Section['items'][number]; j: number }[]; es: Entry[] }>();
const prayerFlat = (MB: Section[]) => {
  let r = flatIdx.get(MB);
  if (!r) {
    const flat = MB.flatMap((s, si) => s.items.map((it, j) => ({ s, si, it, j })));
    flatIdx.set(MB, (r = { flat, es: flat.map((x) => entry(x.it.u, x.it.e)) }));
  }
  return r;
};

function Sec({ o }: { o: Of<'sec'> }) {
  const { p, t, lang, push, setQ } = useStore();
  const ul = lang === 'uk';
  const s = prayersL()!.MB[o.s];
  const [q, setSecQ] = useState(secQ[o.s] ?? '');
  const onQ = (v: string) => {
    secQ[o.s] = v;
    setSecQ(v);
  };
  const searchable = s.items.length > SEC_SEARCH;
  const qt = searchable ? q.trim() : '';
  const found = qt ? fuzzySearch(secEntries(s.items), qt) : [];
  // Молитви з тематичною групою (it.g) ідуть окремими картками з підзаголовком; решта — однією карткою.
  const groups: { g?: string; js: number[] }[] = [];
  s.items.forEach((it, j) => {
    const g = it.g?.[ul ? 0 : 1];
    const last = groups[groups.length - 1];
    if (last && last.g === g) last.js.push(j);
    else groups.push({ g, js: [j] });
  });
  return (
    <>
      <BackBar kicker={t.prayerBook} />
      <Scroll>
        <Kicker style={{ marginBottom: 6 }}>{ROM[o.s]}</Kicker>
        <Title>{ul ? s.u : s.e}</Title>
        {searchable && (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingLeft: 12, marginBottom: 20, borderWidth: 1, borderColor: q ? p.accent : p.divider, borderRadius: RADIUS }}
          >
            <Icon name="search" size={18} color={p.mute(55)} />
            <TextInput
              value={q}
              onChangeText={onQ}
              placeholder={t.secSearchPh}
              placeholderTextColor={p.mute(45)}
              returnKeyType="search"
              autoCorrect={false}
              style={{ flex: 1, minHeight: 44, color: p.text, fontFamily: FONT.body, fontSize: 16 }}
            />
            {!!q && (
              <Press onPress={() => onQ('')} label={t.clear} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ fontFamily: FONT.body, fontSize: 20, lineHeight: 22, color: p.mute(55) }}>×</Text>
              </Press>
            )}
          </View>
        )}
        {!!qt && (
          <>
            {found.length > 0 ? (
              <View style={card(p)}>
                {found.map((j, n) => {
                  const it = s.items[j];
                  return (
                    <NavRow
                      key={j}
                      title={ul ? it.u : it.e}
                      sub={it.g?.[ul ? 0 : 1] ?? (ul ? it.mu : it.me)}
                      onPress={() => push({ t: 'read', s: o.s, j })}
                      last={n === found.length - 1}
                    />
                  );
                })}
              </View>
            ) : (
              <Body size={14} mute={60}>{t.noRes}</Body>
            )}
            <Press
              onPress={() => {
                setQ(qt);
                push({ t: 'search' });
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingVertical: 8 }}
            >
              <Icon name="search" size={16} color={p.a700} />
              <Text style={{ fontFamily: FONT.body, fontSize: 14, color: p.a700 }}>{t.searchAll}</Text>
            </Press>
          </>
        )}
        {!qt && groups.map(({ g, js }, k) => (
          <View key={k} style={{ marginBottom: k === groups.length - 1 ? 0 : 22 }}>
            {!!g && <Kicker style={{ marginBottom: 8 }}>{g}</Kicker>}
            <View style={card(p)}>
              {js.map((j, n) => {
                const it = s.items[j];
                return (
                  <NavRow
                    key={j}
                    title={ul ? it.u : it.e}
                    sub={ul ? it.mu : it.me}
                    onPress={() => push({ t: 'read', s: o.s, j })}
                    last={n === js.length - 1}
                  />
                );
              })}
            </View>
          </View>
        ))}
      </Scroll>
    </>
  );
}

/** Тексти акафістів лежать у шардах (data/kz): перед читанням завантажує ті, що потрібні цій молитві. */
function ReaderGate({ o }: { o: Of<'read'> }) {
  const { MB, KZB } = prayersL()!;
  const zs = [...new Set((MB[o.s].items[o.j].mv ?? []).flatMap((m) => (m.z === undefined ? [] : [m.z])))];
  return (
    <Gate
      need={zs.map((z) => KZB[z])}
      fallback={
        <>
          <BackBar />
          <Loading />
        </>
      }
    >
      <Reader o={o} />
    </Gate>
  );
}

function Reader({ o }: { o: Of<'read'> }) {
  const { p, t, lang, fs } = useStore();
  const ul = lang === 'uk';
  const li = ul ? 0 : 1;
  const { MB, T, mvBook } = prayersL()!;
  const s = MB[o.s];
  const it = s.items[o.j];
  // Українською повний текст замінює план читання; англійською план лишається, а повний текст іде після нього.
  const outline = !it.mv || !ul;
  const rs = useRef<ReadScrollHandle>(null);
  return (
    <>
      <BackBar
        kicker={ul ? s.u : s.e}
        right={<SizeBtns mark={() => rs.current?.addMark()} read={() => [
          ul ? it.u : it.e,
          it.x ?? '',
          ...(outline ? (it.b ?? []).flatMap((b) => [b.h?.[li] ?? '', b.t ? T[b.t][li] : '']) : []),
          ...(outline ? (it.p ?? []).map((x) => x[li]) : []),
          ...(it.mv ?? []).flatMap((m) => bookText(mvBook(m), m.s)),
        ]} />}
      />
      <ReadScroll ref={rs} mark={{ o: { t: 'read', s: o.s, j: o.j }, title: ul ? it.u : it.e, kicker: ul ? s.u : s.e }} goto={o.m}>
        <Title>{ul ? it.u : it.e}</Title>
        {!!(ul ? it.mu : it.me) && <Body size={12.5} mute={60} style={{ marginBottom: 14 }}>{ul ? it.mu : it.me}</Body>}
        {!!it.x && (
          <Anchor text={it.x}>
            <Text style={{ fontFamily: FONT.body, fontSize: fs, lineHeight: fs * 1.65, color: p.text }}>{it.x}</Text>
          </Anchor>
        )}
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
            {b.t && (
              <Anchor text={T[b.t][li]}>
                <Text style={{ fontFamily: FONT.body, fontSize: fs, lineHeight: fs * 1.65, color: p.text }}>{T[b.t][li]}</Text>
              </Anchor>
            )}
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
              <PrayerBook key={k} b={mvBook(m)} only={m.s} title={it.mv!.length > 1 && !m.s ? mvBook(m).u : undefined} fs={fs} />
            ))}
          </View>
        )}
        {!it.full && <Body size={12.5} mute={55} style={{ marginTop: 18 }}>{t.outlineNote}</Body>}
      </ReadScroll>
    </>
  );
}

function BookOv({ o }: { o: Of<'book'> }) {
  const { p, t, lang, push, bd } = useStore();
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
              {Array.from({ length: b.ch }, (_, i) => i + 1).map((n) => {
                const read = bd.includes(`${b.i}.${n}`);
                return (
                  <Press
                    key={n}
                    onPress={() => b.i !== undefined && push({ t: 'chap', b: b.i, c: n })}
                    style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: p.divider, backgroundColor: read ? p.a100 : 'transparent' }}
                  >
                    <Text style={[{ fontFamily: FONT.headingBold, fontSize: 20, color: read ? p.a800 : p.text }, NUM]}>{n}</Text>
                  </Press>
                );
              })}
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

/** Псалтир окремою сторінкою (відкривається з меню). */
function Psalter() {
  const { t } = useStore();
  return (
    <>
      <BackBar kicker={t.scripture} />
      <Scroll>
        <Title>{t.psalter}</Title>
        <PsalterBlock />
      </Scroll>
    </>
  );
}

/** Глава Біблії: вірші з номерами й паралельними місцями, перехід до сусідніх глав. */
function Chapter({ o }: { o: Of<'chap'> }) {
  const { p, t, lang, push, replace, bd, set } = useStore();
  const ul = lang === 'uk';
  const key = `${o.b}.${o.c}`;
  const read = bd.includes(key);
  const ref = useRef<ScrollView>(null);
  const done = useRef(false);
  const top = useRef(0);
  const { h, vs } = chapter(o.b, o.c);
  const last = BOOKS[o.b][5];
  const prev = o.c > 1 ? { b: o.b, c: o.c - 1 } : o.b > 0 ? { b: o.b - 1, c: BOOKS[o.b - 1][5] } : null;
  const next = o.c < last ? { b: o.b, c: o.c + 1 } : o.b < BOOKS.length - 1 ? { b: o.b + 1, c: 1 } : null;
  const label = (x: { b: number; c: number }) => (x.b === o.b ? chapTitle(x.b, x.c, ul) : `${BOOKS[x.b][2]} ${x.c}`);
  const book = bookItem(o.b);
  // Псалми: значок тлумачення біля назви й номерів віршів.
  const psalm = BOOKS[o.b][0] === 'ps';
  return (
    <>
      <BackBar right={<SizeBtns />} />
      <ScrollView ref={ref} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 40 }}>
        <Press onPress={() => push({ t: 'book', b: book })} style={{ alignSelf: 'flex-start', marginBottom: 6 }}>
          <Kicker>{`${bookName(o.b, ul)} · ${t.translation}`}</Kicker>
        </Press>
        {psalm ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Title>{chapTitle(o.b, o.c, ul)}</Title>
            <View style={{ marginBottom: 16 }}>
              <TlumBtn n={o.c} />
            </View>
          </View>
        ) : (
          <Title>{chapTitle(o.b, o.c, ul)}</Title>
        )}
        {h ? <Text style={{ fontFamily: FONT.body, fontStyle: 'italic', fontSize: 14, color: p.mute(65), marginBottom: 10 }}>{h}</Text> : null}
        <View onLayout={(e) => (top.current = e.nativeEvent.layout.y)}>
        <Verses
          vs={vs}
          b={o.b}
          c={o.c}
          tl={psalm ? o.c : undefined}
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
        <OutlineButton
          label={read ? t.marked : t.markRead}
          onPress={() => set({ bd: read ? bd.filter((x) => x !== key) : [...bd, key] })}
          style={{ alignSelf: 'flex-start', marginTop: 18 }}
        />
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
  const { PSALTYR, kathIdx } = psaltyrL()!;
  const rs = useRef<ReadScrollHandle>(null);
  const mark = (
    <OutlineButton
      label={done ? t.marked : t.markRead}
      onPress={() => set({ kd: done ? kd.filter((x) => x !== o.k) : [...kd, o.k] })}
      style={{ alignSelf: 'flex-start' }}
    />
  );
  return (
    <>
      <BackBar right={<SizeBtns mark={() => rs.current?.addMark()} read={() => [`${t.kathisma} ${o.k}`, ...bookText(PSALTYR[kathIdx(o.k)])]} />} />
      <ReadScroll ref={rs} mark={{ o: { t: 'kath', k: o.k }, title: `${t.kathisma} ${o.k}`, kicker: t.psalter }} goto={o.m}>
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
      </ReadScroll>
    </>
  );
}

/** Інші сторінки Слідуваного Псалтиря: як читати, молитви перед і після читання, пісні Писання. */
function PsPage({ o }: { o: Of<'ps'> }) {
  const { t, fs, lang } = useStore();
  const b = psaltyrL()!.PSALTYR[o.i];
  const rs = useRef<ReadScrollHandle>(null);
  return (
    <>
      <BackBar right={<SizeBtns mark={() => rs.current?.addMark()} read={() => [lang === 'uk' ? b.u : b.e, ...bookText(b)]} />} />
      <ReadScroll ref={rs} mark={{ o: { t: 'ps', i: o.i }, title: lang === 'uk' ? b.u : b.e, kicker: t.psalter }} goto={o.m}>
        <Kicker style={{ marginBottom: 6 }}>{t.psalter}</Kicker>
        <Title>{lang === 'uk' ? b.u : b.e}</Title>
        {lang !== 'uk' && <Body size={12.5} mute={60} style={{ marginBottom: 14 }}>{t.fullText}</Body>}
        <PrayerBook b={b} fs={fs} />
      </ReadScroll>
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
  // Пошук охоплює календар, молитвослов і Псалтир: довантажуємо їх, результати доповнюються в міру готовності.
  useLazy(...yearsL, prayersL, psaltyrL);
  const MB = prayersL()?.MB ?? [];
  const PSALTYR = psaltyrL()?.PSALTYR ?? [];
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
    // Молитви — нечітким пошуком: «Николаю» знайде «Миколаю», «акафист» — «акафіст».
    const { flat, es } = prayerFlat(MB);
    fuzzySearch(es, q.trim(), 80).forEach((k) => {
      const { s, si, it, j } = flat[k];
      results.push({ title: ul ? it.u : it.e, sub: ul ? s.u : s.e, go: () => push({ t: 'read', s: si, j }) });
    });
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
  const { p, t, cal, fs, ang, set, push } = useStore();
  return (
    <>
      <BackBar kicker={t.app} />
      <Scroll>
        <Title>{t.settings}</Title>
        <Kicker style={{ marginBottom: 8 }}>{t.calendar}</Kicker>
        <Seg opts={[{ label: t.nj, on: cal === 'nj', onPress: () => set({ cal: 'nj' }) }, { label: t.oj, on: cal === 'oj', onPress: () => set({ cal: 'oj' }) }]} />
        <Body size={12.5} mute={65} style={{ marginTop: 8 }}>{(cal === 'nj' ? t.helpNj : t.helpOj) + t.helpP}</Body>
        <Kicker style={{ marginTop: 24, marginBottom: 4 }}>{t.textSize}</Kicker>
        <Seg opts={[17, 19, 21].map((v, i) => ({ label: t.sizes[i], on: fs === v, onPress: () => set({ fs: v }) }))} />
        <Kicker style={{ marginTop: 24, marginBottom: 8 }}>{t.notif}</Kicker>
        <View style={card(p)}>
          <NavRow title={t.rTitle} onPress={() => push({ t: 'remind' })} />
          <NavRow
            title={t.angTitle}
            value={ang.length ? String(ang.length) : undefined}
            onPress={() => push({ t: 'angels' })}
            last
          />
        </View>
      </Scroll>
    </>
  );
}

const EVE_TIMES = ['19:00', '20:00', '21:00'];
const MORN_TIMES = ['06:00', '07:00', '08:00'];

const pad2 = (n: number) => String(n).padStart(2, '0');
/** Розбір «ГГ:ХХ» і збирання назад; значення завжди в межах доби. */
const hm = (hhmm: string) => hhmm.split(':').map(Number) as [number, number];
const hhmm = (h: number, m: number) => `${pad2(((h % 24) + 24) % 24)}:${pad2(((m % 60) + 60) % 60)}`;

/** Одне число годинника: кнопки −/+ по краях, посередині поле, у яке можна ввести значення з клавіатури. */
function ClockNum({ value, max, step, label, onChange }: { value: number; max: number; step: number; label: string; onChange: (v: number) => void }) {
  const { p } = useStore();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = parseInt(draft, 10);
    if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(0, n)));
    setDraft(null);
  };
  // Кнопки перескакують на найближче кратне кроку: 07:23 → 07:25 / 07:20.
  const inc = () => onChange((Math.floor(value / step) * step + step) % (max + 1));
  const dec = () => onChange(value % step ? value - (value % step) : (value - step + max + 1) % (max + 1));
  const btn = (sym: string, a11y: string, f: () => void) => (
    <Press label={a11y} onPress={f} style={{ width: 44, height: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: FONT.headingBold, fontSize: 24, color: p.a700 }}>{sym}</Text>
    </Press>
  );
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: draft !== null ? p.accent : p.divider, borderRadius: RADIUS }}>
      {btn('−', `${label} −${step}`, dec)}
      <TextInput
        value={draft ?? pad2(value)}
        onChangeText={(x) => setDraft(x.replace(/\D/g, '').slice(0, 2))}
        onFocus={() => setDraft(pad2(value))}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="number-pad"
        returnKeyType="done"
        maxLength={2}
        selectTextOnFocus
        accessibilityLabel={label}
        style={[{ flex: 1, minWidth: 0, height: 48, padding: 0, textAlign: 'center', fontFamily: FONT.headingBold, fontSize: 28, color: p.text }, NUM]}
      />
      {btn('+', `${label} +${step}`, inc)}
    </View>
  );
}

/** Довільний час «ГГ:ХХ»: години й хвилини окремо, кожне — кнопками або з клавіатури. */
function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { p, t } = useStore();
  const [h, m] = hm(value);
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
        <Kicker style={{ flex: 1 }}>{t.rHours}</Kicker>
        <View style={{ width: 8 }} />
        <Kicker style={{ flex: 1 }}>{t.rMinutes}</Kicker>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ClockNum value={h} max={23} step={1} label={t.rHours} onChange={(x) => onChange(hhmm(x, m))} />
        <Text style={{ width: 8, textAlign: 'center', fontFamily: FONT.headingBold, fontSize: 28, color: p.mute(50) }}>:</Text>
        <ClockNum value={m} max={59} step={5} label={t.rMinutes} onChange={(x) => onChange(hhmm(h, x))} />
      </View>
      <Body size={12} mute={55} style={{ marginTop: 8 }}>{t.rTypeHint}</Body>
    </View>
  );
}

/** Налаштування нагадувань: увечері — про завтра (докладно й коротко), вранці — про сьогодні, перед святом. */
function Remind() {
  const { p, t, rm, set } = useStore();
  const [other, setOther] = useState<{ eveT: boolean; mornT: boolean; tmrT: boolean }>({
    eveT: !EVE_TIMES.includes(rm.eveT),
    tmrT: !EVE_TIMES.includes(rm.tmrT),
    mornT: !MORN_TIMES.includes(rm.mornT),
  });
  const [denied, setDenied] = useState(false);
  const upd = (patch: Partial<Reminders>) => {
    const next = { ...rm, ...patch };
    set({ rm: next });
    // Дозвіл питаємо, коли людина вмикає нагадування.
    if (NATIVE && (next.eve || next.morn || next.tmr || next.pre || next.mem || next.show.p || next.ang)) notifPermission(true).then((r) => setDenied(r === 'denied'));
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

  const block = (k: 'eve' | 'morn' | 'tmr', title: string, sub: string, key: 'eveT' | 'mornT' | 'tmrT', presets: string[]) => {
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
              {chip(t.rOther, isOther, () => setOther((o) => ({ ...o, [key]: true })), false)}
            </View>
            {isOther && <TimeField value={cur} onChange={(x) => upd({ [key]: x } as Partial<Reminders>)} />}
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
          {block('tmr', t.rTmr, t.rTmrSub, 'tmrT', EVE_TIMES)}
          {block('morn', t.rMorn, t.rMornSub, 'mornT', MORN_TIMES)}
          <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Heading size={19}>{t.rPre}</Heading>
              <Body size={12.5} mute={60} style={{ marginTop: 3 }}>{t.rPreSub}</Body>
            </View>
            <Switch on={rm.pre} label={t.rPre} onPress={() => upd({ pre: !rm.pre })} />
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: p.divider }}>
            <View style={{ flex: 1 }}>
              <Heading size={19}>{t.angTitle}</Heading>
              <Body size={12.5} mute={60} style={{ marginTop: 3 }}>{t.rAngSub}</Body>
            </View>
            <Switch on={rm.ang} label={t.angTitle} onPress={() => upd({ ang: !rm.ang })} />
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: p.divider }}>
            <View style={{ flex: 1 }}>
              <Heading size={19}>{t.rMem}</Heading>
              <Body size={12.5} mute={60} style={{ marginTop: 3 }}>{t.rMemSub}</Body>
            </View>
            <Switch on={rm.mem} label={t.rMem} onPress={() => upd({ mem: !rm.mem })} />
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
        {NATIVE && denied && <Body size={12.5} mute={65} style={{ marginTop: 16 }}>{t.rDenied}</Body>}
      </Scroll>
    </>
  );
}

/** Скільки днів у місяці m (лютий — 29, щоб можна було обрати 29-те). */
const monthLen = (m: number) => new Date(2024, m, 0).getDate();

/** Найближча дата дня ангела, починаючи від сьогодні. */
const nextAngel = (a: Angel, today: Date) => {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const x = angelDate(a, t0.getFullYear());
  return x.getTime() < t0.getTime() - 3600_000 ? angelDate(a, t0.getFullYear() + 1) : x;
};

/** Дні ангела близьких: ім'я і дата; нагадування — увечері напередодні й у сам день. */
function Angels() {
  const { p, t, lang, cal, ang, rm, set, push, today } = useStore();
  const [name, setName] = useState('');
  const [m, setM] = useState(today.getMonth() + 1);
  const [d, setD] = useState(today.getDate());
  const day = Math.min(d, monthLen(m));
  const year = today.getFullYear();
  const hint = dayInfo(angelDate({ n: '', d: `${pad2(m)}-${pad2(day)}` }, year), cal, lang).names;

  const list = ang
    .map((a, i) => ({ a, i, next: nextAngel(a, today) }))
    .sort((x, y) => x.next.getTime() - y.next.getTime());
  const daysTo = (x: Date) => Math.round((x.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime()) / 86400_000);

  const step = (label: string, value: string, dec: () => void, inc: () => void) => (
    <View style={{ flex: 1 }}>
      <Kicker style={{ marginBottom: 6 }}>{label}</Kicker>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: p.divider, borderRadius: RADIUS }}>
        <Press label="−" onPress={dec} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="left" size={18} color={p.mute(60)} />
        </Press>
        <Text style={[{ flex: 1, textAlign: 'center', fontFamily: FONT.headingBold, fontSize: 18, color: p.text }, NUM]}>{value}</Text>
        <Press label="+" onPress={inc} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="right" size={18} color={p.mute(60)} />
        </Press>
      </View>
    </View>
  );

  const addOne = () => {
    const v = name.trim();
    if (!v) return;
    set({ ang: [...ang, { n: v, d: `${pad2(m)}-${pad2(day)}` }] });
    setName('');
  };

  return (
    <>
      <BackBar />
      <Scroll>
        <Title>{t.angTitle}</Title>
        <Body size={13} mute={65} style={{ marginBottom: 20 }}>{t.angHelp}</Body>

        {list.length > 0 && (
          <View style={[card(p), { marginBottom: 26 }]}>
            {list.map(({ a, i, next }, k) => {
              const n = daysTo(next);
              const when = n === 0 ? t.angTodayL : n === 1 ? t.angTomorrowL : `${t.angIn}${n} ${lang === 'uk' ? PL(n, t.angDayW) : t.angDayW[2]}`;
              return (
                <View
                  key={i}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, borderBottomWidth: k === list.length - 1 ? 0 : 1, borderBottomColor: p.divider }}
                >
                  <View style={{ flex: 1, paddingVertical: 10 }}>
                    <Text style={{ fontFamily: FONT.headingBold, fontSize: 19, color: p.text }}>{a.n}</Text>
                    <Body size={12.5} mute={60} style={{ marginTop: 2 }}>{`${fmtDate(next, lang)} · ${when}`}</Body>
                  </View>
                  <Press label="×" onPress={() => set({ ang: ang.filter((_, j) => j !== i) })} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="x" size={18} color={p.mute(60)} />
                  </Press>
                </View>
              );
            })}
          </View>
        )}

        <Kicker style={{ paddingBottom: 8, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: p.divider }}>{t.angAdd}</Kicker>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t.namePh}
          placeholderTextColor={p.mute(45)}
          onSubmitEditing={addOne}
          style={{ minHeight: 40, paddingHorizontal: 10, borderWidth: 1, borderColor: p.divider, borderRadius: RADIUS, color: p.text, fontFamily: FONT.body, fontSize: 15 }}
        />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          {step(t.angDay, String(day), () => setD(day <= 1 ? monthLen(m) : day - 1), () => setD(day >= monthLen(m) ? 1 : day + 1))}
          {step(t.angMonth, MN[lang][m - 1], () => setM(m <= 1 ? 12 : m - 1), () => setM(m >= 12 ? 1 : m + 1))}
        </View>
        {!!hint && <Body size={12.5} mute={60} style={{ marginTop: 10 }}>{`${t.nNamesP}${hint}`}</Body>}
        <OutlineButton label={t.add} onPress={addOne} style={{ marginTop: 14, alignSelf: 'flex-start' }} />

        <View style={[card(p), { marginTop: 26 }]}>
          <NavRow title={t.rTitle} onPress={() => push({ t: 'remind' })} last />
        </View>
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

/** Порядок закладок у тексті: спершу ті, що користувач упорядкував сам, далі — за порядком читання. */
const byOrder = (a: Mark, b: Mark) =>
  a.n !== undefined && b.n !== undefined ? a.n - b.n : a.n !== undefined ? -1 : b.n !== undefined ? 1 : a.i - b.i || a.f - b.f;

/** Усі закладки, згруповані за молитвою (текстом): спершу тексти з найновішими закладками, у тексті — за порядком читання або як упорядкував користувач. */
function Marks() {
  const { t, lang, bm, set } = useStore();
  const ul = lang === 'uk';
  const [toast, showToast] = useToast();
  const [dragging, setDragging] = useState(false);
  const bmRef = useRef(bm);
  bmRef.current = bm;
  const groups = new Map<string, Mark[]>();
  bm.forEach((m) => groups.set(markKey(m.o), [...(groups.get(markKey(m.o)) ?? []), m]));
  const list = [...groups.values()]
    .map((ms) => ms.sort(byOrder))
    .sort((a, b) => Math.max(...b.map((m) => m.at)) - Math.max(...a.map((m) => m.at)));
  const del = (m: Mark) => {
    set({ bm: bm.filter((x) => x.id !== m.id) });
    showToast(t.markRemoved, { label: t.restore, fn: () => set({ bm: [...bmRef.current.filter((x) => x.id !== m.id), m] }) });
  };
  const reorder = (ms: Mark[]) => {
    const n = new Map(ms.map((m, k) => [m.id, k]));
    set({ bm: bmRef.current.map((m) => (n.has(m.id) ? { ...m, n: n.get(m.id) } : m)) });
  };
  const n = bm.length;
  return (
    <>
      <BackBar kicker={n ? `${n} ${ul ? PL(n, t.marksW) : n === 1 ? t.marksW[0] : t.marksW[1]}` : undefined} />
      <Scroll scrollEnabled={!dragging}>
        <Title>{t.marks}</Title>
        {!n && <Body size={14} mute={65}>{t.marksEmpty}</Body>}
        {list.map((ms) => {
          const g = ms[ms.length - 1];
          return (
            <View key={markKey(g.o)} style={{ marginBottom: 22 }}>
              <Kicker style={{ marginBottom: 4 }}>{g.kicker}</Kicker>
              <Heading size={21} style={{ marginBottom: 10 }}>{g.title}</Heading>
              <MarkRows ms={ms} del={del} reorder={reorder} onDrag={setDragging} />
            </View>
          );
        })}
        {n > 0 && <Body size={12.5} mute={55}>{t.marksHint}</Body>}
      </Scroll>
      {toast}
    </>
  );
}

/** Закладки одного тексту. Якщо їх кілька, ручка ліворуч дає перетягнути закладку вище чи нижче. */
function MarkRows({ ms, del, reorder, onDrag }: { ms: Mark[]; del: (m: Mark) => void; reorder: (ms: Mark[]) => void; onDrag: (on: boolean) => void }) {
  const { p, t, lang, push } = useStore();
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number } | null>(null);
  const heights = useRef<number[]>([]);
  const cb = useRef({ ms, reorder, onDrag });
  cb.current = { ms, reorder, onDrag };
  const canDrag = ms.length > 1;

  // Нове місце закладки: скільки інших рядків мають середину вище за середину перетягуваного.
  const target = (from: number, dy: number) => {
    const h = heights.current;
    const top = (k: number) => h.slice(0, k).reduce((a, x) => a + (x ?? 0), 0);
    const c = top(from) + (h[from] ?? 0) / 2 + dy;
    let to = 0;
    for (let k = 0; k < h.length; k++) if (k !== from && top(k) + (h[k] ?? 0) / 2 < c) to++;
    return to;
  };

  const pans = useMemo(
    () =>
      ms.map((_, from) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onStartShouldSetPanResponderCapture: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: () => {
            cb.current.onDrag(true);
            setDrag({ from, to: from, dy: 0 });
          },
          onPanResponderMove: (_e, s) => setDrag({ from, to: target(from, s.dy), dy: s.dy }),
          onPanResponderRelease: (_e, s) => {
            const to = target(from, s.dy);
            setDrag(null);
            cb.current.onDrag(false);
            if (to !== from) {
              const next = [...cb.current.ms];
              next.splice(to, 0, ...next.splice(from, 1));
              cb.current.reorder(next);
            }
          },
          onPanResponderTerminate: () => {
            setDrag(null);
            cb.current.onDrag(false);
          },
        }),
      ),
    [ms.length],
  );

  const shift = (k: number) => {
    if (!drag || k === drag.from) return 0;
    const h = heights.current[drag.from] ?? 0;
    if (drag.from < k && k <= drag.to) return -h;
    if (drag.to <= k && k < drag.from) return h;
    return 0;
  };

  return (
    <View style={card(p)}>
      {ms.map((m, k) => {
        const active = drag?.from === k;
        return (
          <View
            key={m.id}
            onLayout={(e) => {
              heights.current[k] = e.nativeEvent.layout.height;
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'stretch',
              borderBottomWidth: k === ms.length - 1 ? 0 : 1,
              borderBottomColor: p.divider,
              transform: [{ translateY: active ? drag.dy : shift(k) }],
              zIndex: active ? 2 : 0,
              backgroundColor: active ? p.bg : undefined,
              opacity: active ? 0.92 : 1,
              ...(active ? { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 } : null),
            }}
          >
            {canDrag && (
              <View
                {...pans[k]?.panHandlers}
                accessibilityLabel={t.markMove}
                style={{ width: 36, alignItems: 'center', justifyContent: 'center', ...({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as object) }}
              >
                <Icon name="grip" size={20} color={active ? p.accent : p.mute(45)} sw={3} />
              </View>
            )}
            <Press onPress={() => push({ ...m.o, m: m.id })} style={{ flex: 1, flexDirection: 'row', gap: 10, paddingVertical: 12, paddingLeft: canDrag ? 2 : 14, paddingRight: 4, borderRadius: 0 }}>
              <View style={{ paddingTop: 3 }}>
                <Icon name="bookmark" size={15} color={p.accent} fill={p.accent} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text numberOfLines={3} style={{ fontFamily: FONT.body, fontSize: 15, lineHeight: 22, color: p.text }}>{`«${m.q}»`}</Text>
                <Text numberOfLines={2} style={[{ fontFamily: FONT.body, fontSize: 12, color: p.mute(60) }, NUM]}>
                  {[m.h, `${Math.round(m.pos * 100)} %`, fmtDate(new Date(m.at), lang)].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </Press>
            <Press label={`${t.markDel}: ${m.q}`} onPress={() => del(m)} style={{ width: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 0 }}>
              <Icon name="x" size={18} color={p.mute(50)} />
            </Press>
          </View>
        );
      })}
    </View>
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
