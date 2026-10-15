import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { Book } from '../data/prayers';
import { KATH } from '../data/prayerLists';
import { BOOKS, groupItem } from '../lib/bible';
import { psaltyrL, useLazy } from '../lib/lazy';
import { PL } from '../data/strings';
import { Body, H1, Kicker, NavRow, NUM, Press, card } from '../components/ui';
import { TopBar } from '../components/Chrome';
import { dayInfo, fmtDate } from '../lib/calendar';
import { useStore } from '../store';
import { FONT, RADIUS } from '../theme';

export const bookRow = (b: Book, lang: 'uk' | 'en', t: Record<string, any>, go: () => void, last?: boolean) => {
  const ul = lang === 'uk';
  const pl = (n: number, f: string[]) => (ul ? PL(n, f) : n === 1 ? f[0] : f[1]);
  const w = b.e.includes('Epistle') ? t.epW : t.bkW;
  const sub = b.ch ? `${b.ch} ${pl(b.ch, t.chW)}` : `${b.books!.length} ${pl(b.books!.length, w)}`;
  return { title: ul ? b.u : b.e, sub, go, last };
};

const NT: Book[] = [...groupItem(5).books!, groupItem(6), groupItem(7), groupItem(8), groupItem(9)];
// Усього глав у Біблії та в чотирьох Євангеліях (для лічильників прочитаного).
const TOTAL = BOOKS.reduce((n, b) => n + b[5], 0);
export const GOSPELS = BOOKS.reduce((n, b) => n + (b[4] === 5 ? b[5] : 0), 0);
/** Скільки глав Євангелія позначено прочитаними. */
export const gospelRead = (bd: string[]) => bd.filter((k) => BOOKS[+k.split('.')[0]]?.[4] === 5).length;
const OT: Book[] = [0, 1, 2, 3, 4].map(groupItem);

export default function BibleTab() {
  const { p, t, lang, cal, today, push, bd } = useStore();
  const ul = lang === 'uk';
  const day = dayInfo(today, cal, lang);
  const open = (b: Book) => push({ t: 'book', b });
  const gosRead = gospelRead(bd);

  const list = (books: Book[], gospel?: boolean) => (
    <View style={[card(p), { marginBottom: 24 }]}>
      {books.map((b, i) => {
        const r = bookRow(b, lang, t, () => open(b), i === books.length - 1);
        const title = gospel && i < 4 ? (ul ? 'Євангеліє в' + b.u.slice(1) : 'Gospel of ' + b.e) : r.title;
        return <NavRow key={i} title={title} sub={r.sub} onPress={r.go} last={r.last} />;
      })}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <TopBar kicker={t.scriptureK} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 32 }}>
        <View style={{ marginBottom: 20 }}>
          <H1>{t.scripture}</H1>
        </View>

        <View style={[card(p), { padding: 16, gap: 4, marginBottom: 24 }]}>
          <Kicker>{`${t.dayRead} · ${fmtDate(today, lang)}`}</Kicker>
          {[
            [t.apostle, day.r1],
            [t.gospel, day.r2],
          ].map(([l, v]) => (
            <Press key={l} onPress={() => v && push({ t: 'pass', s: v, title: l })} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 }}>
              <Text style={{ fontFamily: FONT.body, fontSize: 14, color: p.mute(60) }}>{l}</Text>
              <Text style={[{ flexShrink: 1, textAlign: 'right', fontFamily: FONT.body, fontSize: 14, color: p.text, textDecorationLine: 'underline', textDecorationColor: p.a300 }, NUM]}>{v}</Text>
            </Press>
          ))}
        </View>

        <Body size={12.5} mute={60} style={{ marginBottom: 14 }}>{t.bibleHelp}</Body>
        <Kicker style={{ marginBottom: 8 }}>{t.ntH}</Kicker>
        {list(NT, true)}
        <Kicker style={{ marginBottom: 8 }}>{t.otH}</Kicker>
        {list(OT)}

        <Kicker style={{ marginBottom: 6 }}>{t.psalter}</Kicker>
        <PsalterBlock />

        <Kicker style={{ marginTop: 24, marginBottom: 8 }}>{t.bibRead}</Kicker>
        <Body size={13} style={{ color: p.a700 }}>{`${ul ? 'Прочитано ' : 'Read '}${bd.length} ${t.of} ${TOTAL} ${t.chW2}`}</Body>
        <Kicker style={{ marginTop: 16, marginBottom: 8 }}>{t.gosRead}</Kicker>
        <Body size={13} style={{ color: p.a700 }}>{`${ul ? 'Прочитано ' : 'Read '}${gosRead} ${t.of} ${GOSPELS} ${t.chW2}`}</Body>
        <Body size={12} mute={55} style={{ marginTop: 8 }}>{ul ? 'Позначайте глави кнопкою внизу сторінки глави.' : 'Mark chapters with the button at the bottom of a chapter.'}</Body>
      </ScrollView>
    </View>
  );
}

/** Псалтир: службові сторінки, сітка з 20 кафизм і лічильник прочитаного. */
export function PsalterBlock() {
  const { p, t, lang, push, kd } = useStore();
  const ul = lang === 'uk';
  // Назви сторінок Псалтиря беремо з його модуля, що довантажується разом із вкладкою.
  const PSALTYR = useLazy(psaltyrL) ? psaltyrL()!.PSALTYR : null;
  const nextK = Array.from({ length: 20 }, (_, i) => i + 1).find((k) => !kd.includes(k));

  const psRows = (ix: number[], mt: number) => (
    <View style={[card(p), { marginTop: mt, marginBottom: mt ? 0 : 16 }]}>
      {ix.map((i, j) => (
        <NavRow key={i} title={PSALTYR ? (ul ? PSALTYR[i].u : PSALTYR[i].e) : '…'} onPress={() => push({ t: 'ps', i })} last={j === ix.length - 1} />
      ))}
    </View>
  );

  return (
    <>
      <Body size={12.5} mute={60}>{t.psHelp}</Body>
      <View style={{ height: 12 }} />
      {psRows([0, 1], 0)}
      <Body size={13} style={{ color: p.a700, marginBottom: 12 }}>
        {`${ul ? 'Прочитано ' : 'Read '}${kd.length} ${t.of} 20`}
      </Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {KATH.map((ps, i) => {
          const k = i + 1;
          const done = kd.includes(k);
          return (
            <Press
              key={k}
              onPress={() => push({ t: 'kath', k })}
              style={{
                width: '23.5%',
                paddingVertical: 10,
                alignItems: 'center',
                gap: 2,
                borderWidth: 1,
                borderRadius: RADIUS,
                borderColor: k === nextK ? p.accent : p.divider,
                backgroundColor: done ? p.a100 : 'transparent',
              }}
            >
              <Text style={[{ fontFamily: FONT.headingBold, fontSize: 20, color: done ? p.a800 : p.text }, NUM]}>{k}</Text>
              <Text style={{ fontFamily: FONT.body, fontSize: 9.5, color: done ? p.a800 : p.mute(55) }}>{ps}</Text>
            </Press>
          );
        })}
      </View>
      {PSALTYR && psRows([PSALTYR.length - 2, PSALTYR.length - 1], 16)}
    </>
  );
}
