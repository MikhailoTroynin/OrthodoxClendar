import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { WS } from '../data/calendar';
import { Body, FastIcon, H1, Heading, Icon, Kicker, Marks, NeutralTag, NUM, OutlineButton, Press, Seg, Tag } from '../components/ui';
import { TopBar } from '../components/Chrome';
import { dayInfo, fastKind, FastKind, fastSections, feastSections, fmtDate, MN, monthGrid, sameDay, toKey, weekdayName } from '../lib/calendar';
import { useStore } from '../store';
import { FONT, RADIUS } from '../theme';

export default function CalendarTab() {
  const { p, t, lang, cal, date, setDate, today, calView, setCalView, openDay } = useStore();
  const [view, setView] = useState({ y: date.getFullYear(), m: date.getMonth() + 1 });
  const cells = monthGrid(view.y, view.m);
  const sel = dayInfo(date, cal, lang);
  const shift = (n: number) =>
    setView((v) => {
      const m = v.m + n;
      return { y: v.y + Math.floor((m - 1) / 12), m: ((m - 1 + 12) % 12) + 1 };
    });

  return (
    <View style={{ flex: 1 }}>
      <TopBar kicker={cal === 'nj' ? t.nj : t.oj} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 4, marginBottom: 16 }}>
          {calView === 'month' ? <H1>{`${MN[lang][view.m - 1]} ${view.y}`}</H1> : <H1>{calView === 'feasts' ? t.segFeasts : t.segFasts}</H1>}
          {calView === 'month' && (
            <View style={{ flexDirection: 'row' }}>
              <Press onPress={() => shift(-1)} label={t.prevMonth} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="left" color={p.a700} />
              </Press>
              <Press onPress={() => shift(1)} label={t.nextMonth} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="right" color={p.a700} />
              </Press>
            </View>
          )}
        </View>
        <View style={{ marginHorizontal: 4, marginBottom: 18 }}>
          <Seg
            opts={[
              { label: t.segMonth, on: calView === 'month', onPress: () => setCalView('month') },
              { label: t.segFeasts, on: calView === 'feasts', onPress: () => setCalView('feasts') },
              { label: t.segFasts, on: calView === 'fasts', onPress: () => setCalView('fasts') },
            ]}
          />
        </View>

        {calView === 'month' ? (
          <>
            <View style={{ flexDirection: 'row', gap: 2, marginBottom: 6 }}>
              {WS[lang].map((h) => (
                <Text key={h} style={{ flex: 1, textAlign: 'center', fontFamily: FONT.body, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: p.mute(55) }}>
                  {h}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: p.divider, paddingTop: 6 }}>
              {cells.map((c, i) => {
                if (!c.date) return <View key={i} style={{ width: `${100 / 7}%`, height: 60 }} />;
                const info = dayInfo(c.date, cal, lang);
                const on = sameDay(c.date, date);
                const feast = info.rank > 0;
                return (
                  <Pressable
                    key={toKey(c.date)}
                    accessibilityRole="button"
                    accessibilityLabel={`${fmtDate(c.date, lang)}, ${t.fk[fastKind(info)]}`}
                    onPress={() => setDate(c.date!)}
                    style={({ pressed }) => ({
                      width: `${100 / 7}%`,
                      height: 60,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      borderWidth: 1,
                      borderColor: on ? p.accent : 'transparent',
                      borderRadius: RADIUS,
                      backgroundColor: pressed ? p.mute(6) : 'transparent',
                    })}
                  >
                    <Text
                      style={[
                        {
                          fontFamily: sameDay(c.date, today) ? FONT.headingBold : FONT.heading,
                          fontSize: 20,
                          lineHeight: 22,
                          color: on || feast ? p.a700 : p.text,
                          textDecorationLine: sameDay(c.date, today) ? 'underline' : 'none',
                        },
                        NUM,
                      ]}
                    >
                      {c.date.getDate()}
                    </Text>
                    <Marks feast={feast} kind={fastKind(info)} />
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, marginTop: 14, marginHorizontal: 4 }}>
              <Legend label={t.lgFeast} />
              {(['meat', 'lean', 'oil', 'fish', 'paska'] as FastKind[]).map((k) => (
                <Legend key={k} kind={k} label={t.fk[k]} />
              ))}
            </View>
            <View style={{ marginTop: 22, padding: 16, borderWidth: 1, borderColor: p.divider, borderRadius: RADIUS, gap: 8 }}>
              <Kicker>{`${fmtDate(date, lang)}, ${weekdayName(date, lang)}`}</Kicker>
              <Heading size={20}>{sel.entry ? sel.title : t.noData}</Heading>
              {!!sel.week && <Body size={13} mute={70}>{sel.week}</Body>}
              <Body size={13} mute={70}>{[fastKind(sel) === 'paska' ? t.fk.paska : sel.fastLabel || t.fk[fastKind(sel)], sel.r2].filter(Boolean).join(' · ')}</Body>
              <OutlineButton label={t.openDay} onPress={() => openDay(date)} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
            </View>
          </>
        ) : calView === 'fasts' ? (
          <>
            <Body size={12.5} mute={60} style={{ marginHorizontal: 4 }}>{cal === 'oj' ? t.feastNoteOj : t.feastNote}</Body>
            {fastSections(cal, lang, today).map((s, si) => (
              <View key={si} style={{ marginTop: 18, marginHorizontal: 4 }}>
                <Kicker style={{ paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: p.divider }}>
                  {[t.fastsMultiH, t.fastsOneH, t.fastsContH][si]}
                </Kicker>
                {s.rows.map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: p.divider }}>
                    <Text style={[{ width: 104, fontFamily: FONT.headingBold, fontSize: 16, lineHeight: 19, color: p.text }, NUM]}>
                      {r.end ? `${r.start} –\n${r.end}` : r.start}
                    </Text>
                    <View style={{ flex: 1, gap: 5, alignItems: 'flex-start' }}>
                      <Body size={14}>{r.name}</Body>
                      {!!r.days && <Body size={12.5} mute={60}>{r.days}</Body>}
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {r.now && <Tag label={t.fastNow} />}
                        {r.next && <Tag outline label={t.fastNext} />}
                        {r.mv && <NeutralTag label={t.moveable} />}
                      </View>
                    </View>
                  </View>
                ))}
                <Body size={12.5} mute={60} style={{ marginTop: 10 }}>{si === 1 ? t.fastsWF : si === 2 ? t.fastsCont : ''}</Body>
              </View>
            ))}
          </>
        ) : (
          <>
            <Body size={12.5} mute={60} style={{ marginHorizontal: 4 }}>{cal === 'oj' ? t.feastNoteOj : t.feastNote}</Body>
            {feastSections(cal, lang, today).map((s, si) => (
              <View key={si} style={{ marginTop: 18, marginHorizontal: 4 }}>
                <Kicker style={{ paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: p.divider }}>
                  {[t.paschaH, t.twelveH, t.greatH][si]}
                </Kicker>
                {s.rows.map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: p.divider }}>
                    <Text style={[{ width: 104, fontFamily: FONT.headingBold, fontSize: 16, lineHeight: 19, color: p.text }, NUM]}>{r.date}</Text>
                    <View style={{ flex: 1, gap: 5, alignItems: 'flex-start' }}>
                      <Body size={14}>{r.name}</Body>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {r.next && <Tag outline label={t.next} />}
                        {r.mv && <NeutralTag label={t.moveable} />}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Legend({ kind, label }: { kind?: FastKind; label: string }) {
  const { p } = useStore();
  return (
    <View style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 }}>
      <View style={{ width: 17, alignItems: 'center' }}>
        {kind ? <FastIcon kind={kind} size={17} /> : <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: p.accent }} />}
      </View>
      <Text style={{ flex: 1, fontFamily: FONT.body, fontSize: 12, color: p.mute(70) }}>{label}</Text>
    </View>
  );
}
