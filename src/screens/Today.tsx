import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextStyle, View } from 'react-native';
import { MG, WS } from '../data/calendar';
import { Body, Divider, FastIcon, GhostButton, Heading, Icon, Kicker, Marks, NUM, Press, Tag } from '../components/ui';
import { TopBar } from '../components/Chrome';
import { DayPager } from '../components/DayPager';
import { RefText } from '../components/Scripture';
import { dayInfo, fastKind, fmtDate, julianOf, sameDay, toKey, weekOf, weekdayIdx, weekdayName } from '../lib/calendar';
import { prayersFor } from '../lib/saintPrayers';
import { useStore } from '../store';
import { FONT, RADIUS } from '../theme';

const COL = 96;

export default function Today() {
  const { t, lang, cal, date, setDate } = useStore();
  const wd = weekdayName(date, lang);
  return (
    <View style={{ flex: 1 }}>
      <TopBar kicker={`${wd} · ${cal === 'nj' ? t.nj : t.oj}`} />
      <DayPager date={date} setDate={setDate} render={(d) => <DayPage d={d} />} />
    </View>
  );
}

/** Сторінка одного дня; на головній їх три поруч — попередній, поточний і наступний. */
function DayPage({ d }: { d: Date }) {
  const { p, t, lang, cal, setDate, push, today } = useStore();
  const day = dayInfo(d, cal, lang);
  const week = weekOf(d);
  const wd = weekdayName(d, lang);
  const fastText = !day.isFast ? t.noFastTx : day.rank === 2 ? t.fastFish : day.rank === 1 ? t.fastOil : t.fastStrict;
  const tag = day.rank === 2 ? t.greatTag : day.rank === 1 ? t.feastTag : '';
  const jline = `${cal === 'nj' ? t.julian : t.church}: ${fmtDate(julianOf(d), lang)}`;
  const kind = fastKind(day);
  const fastTitle = kind === 'paska' ? t.fk.paska : day.fastLabel || t.fk[kind];

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 36 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
        <Text style={[{ fontFamily: FONT.heading, fontSize: 116, lineHeight: 110, letterSpacing: -4.6, color: p.text }, NUM]}>
          {d.getDate()}
        </Text>
        <View style={{ paddingBottom: 8 }}>
          <Text style={{ fontFamily: FONT.headingBold, fontSize: 26, lineHeight: 28, color: p.text }}>
            {MG[lang][d.getMonth()]}
          </Text>
          <Body size={13} mute={60}>{`${wd}, ${d.getFullYear()}`}</Body>
        </View>
      </View>
      <View style={{ marginTop: 22, minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Body size={12} style={{ color: p.a700, flex: 1 }}>{jline}</Body>
        {!sameDay(d, today) && (
          <Press
            onPress={() => setDate(today)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 10, borderWidth: 1, borderColor: p.accent }}
          >
            <Icon name="undo" size={16} color={p.a700} sw={1.6} />
            <Text style={{ fontFamily: FONT.headingBold, fontSize: 15, color: p.a700 }}>{t.toToday}</Text>
          </Press>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 4, marginTop: 20 }}>
        {week.map((w) => {
          const sel = sameDay(w, d);
          const isToday = sameDay(w, today);
          const e = dayInfo(w, cal, lang);
          const feast = e.rank > 0;
          return (
            <Pressable
              key={toKey(w)}
              accessibilityRole="button"
              onPress={() => setDate(w)}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                gap: 3,
                paddingTop: 7,
                paddingBottom: 6,
                borderWidth: 1,
                borderColor: sel ? p.accent : 'transparent',
                borderRadius: RADIUS,
                backgroundColor: pressed ? p.mute(6) : 'transparent',
              })}
            >
              <Text style={{ fontFamily: FONT.body, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: p.mute(70) }}>
                {WS[lang][weekdayIdx(w)]}
              </Text>
              <Text
                style={[
                  {
                    fontFamily: isToday ? FONT.headingBold : FONT.heading,
                    fontSize: 20,
                    lineHeight: 22,
                    color: sel || feast ? p.a700 : p.text,
                    textDecorationLine: isToday ? 'underline' : 'none',
                  },
                  NUM,
                ]}
              >
                {w.getDate()}
              </Text>
              <Marks feast={feast} kind={fastKind(e)} />
            </Pressable>
          );
        })}
      </View>

      <Divider />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Kicker>{t.memory}</Kicker>
        {!!tag && <Tag label={tag} />}
      </View>
      {day.entry ? (
        <Memory text={day.title} match={day.entry[0]} style={{ fontFamily: FONT.headingBold, fontSize: 27, lineHeight: 31, letterSpacing: -0.27, color: p.text }} icon={20} />
      ) : (
        <Body size={14} mute={60}>{t.noData}</Body>
      )}
      {!!day.week && (
        <Body size={13} mute={70} style={{ marginTop: 6 }}>
          {day.glas ? `${day.week} · глас ${day.glas}` : day.week}
        </Body>
      )}
      {day.more.length > 0 && (
        <View style={{ marginTop: 14, gap: 8 }}>
          {day.more.map((m, i) => (
            <Memory key={i} text={m} match={m} style={{ fontFamily: FONT.body, fontSize: 15, lineHeight: 22.5, color: p.mute(85) }} />
          ))}
        </View>
      )}
      {day.lifeKey && (
        <View style={{ marginTop: 12 }}>
          <GhostButton label={t.life} onPress={() => push({ t: 'life' })} />
        </View>
      )}

      <Divider />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Kicker style={{ width: COL - 12, paddingTop: 4 }}>{t.fast}</Kicker>
        <View style={{ flex: 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: p.divider, borderRadius: RADIUS }}>
            <FastIcon kind={kind} size={24} />
          </View>
          <View style={{ flex: 1 }}>
            <Heading size={18}>{fastTitle}</Heading>
            <Body size={13} mute={70}>{fastText}</Body>
          </View>
        </View>
      </View>

      <Divider gap={20} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Kicker style={{ width: COL - 12, paddingTop: 6 }}>{t.readings}</Kicker>
        <View style={{ flex: 1 }}>
          {day.r1 !== '' && (
            <Reading label={t.apostle} value={day.r1} onPress={() => push({ t: 'pass', s: day.r1, title: t.apostle })} />
          )}
          {day.r2 !== '' && (
            <Reading label={t.gospel} value={day.r2} onPress={() => push({ t: 'pass', s: day.r2, title: t.gospel })} />
          )}
          {day.r1 === '' && day.r2 === '' && day.readingLines.length === 0 && (
            <Body size={13} mute={70}>Читання цього дня в джерелі не вказані.</Body>
          )}
          {day.readingLines.length > 0 && (
            <View style={{ marginTop: 8, gap: 6 }}>
              {day.readingLines.map((l, i) => (
                <RefText key={i} style={{ fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18, color: p.mute(65) }}>
                  {l}
                </RefText>
              ))}
            </View>
          )}
        </View>
      </View>

      {day.names !== '' && (
        <>
          <Divider gap={20} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Kicker style={{ width: COL - 12, paddingTop: 4 }}>{t.names}</Kicker>
            <Body style={{ flex: 1 }}>{day.names}</Body>
          </View>
        </>
      )}
    </ScrollView>
  );
}

/**
 * Запис пам'яті дня. Якщо в молитвослові є молитви цьому святому, святу чи іконі, назву підкреслено, а поряд — значок книжки:
 * дотик відкриває молитву, а коли їх кілька — перелік під записом.
 */
function Memory({ text, match, style, icon = 16 }: { text: string; match: string; style: TextStyle; icon?: number }) {
  const { p, t, lang, push } = useStore();
  const [open, setOpen] = useState(false);
  const prs = prayersFor(match);
  if (!prs.length) return <Text style={style}>{text}</Text>;
  const one = prs.length === 1;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={one ? (lang === 'uk' ? prs[0].u : prs[0].e) : t.dayPrayers}
        accessibilityState={one ? undefined : { expanded: open }}
        onPress={() => (one ? push({ t: 'read', s: prs[0].s, j: prs[0].j }) : setOpen((o) => !o))}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: RADIUS, backgroundColor: pressed ? p.mute(6) : 'transparent' })}
      >
        <Text style={[style, { flex: 1, textDecorationLine: 'underline', textDecorationColor: p.a300 }]}>{text}</Text>
        <View style={{ paddingTop: ((style.lineHeight as number) - icon) / 2 }}>
          <Icon name="book" size={icon} color={p.a700} sw={1.6} />
        </View>
      </Pressable>
      {open && (
        <View style={{ marginTop: 6, marginBottom: 4, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: p.a300 }}>
          {prs.map((r) => (
            <Press
              key={`${r.s}.${r.j}`}
              onPress={() => push({ t: 'read', s: r.s, j: r.j })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 4 }}
            >
              <Icon name="book" size={14} color={p.a700} sw={1.6} />
              <Text style={{ flex: 1, fontFamily: FONT.body, fontSize: 13.5, lineHeight: 19, color: p.a700 }}>{lang === 'uk' ? r.u : r.e}</Text>
            </Press>
          ))}
        </View>
      )}
    </View>
  );
}

function Reading({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const { p } = useStore();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 5 }}
    >
      <Text style={{ fontFamily: FONT.body, fontSize: 14, color: p.mute(60) }}>{label}</Text>
      <Text
        style={[
          { fontFamily: FONT.body, fontSize: 14, color: p.text, textDecorationLine: 'underline', textDecorationColor: p.a300 },
          NUM,
        ]}
      >
        {value}
      </Text>
    </Pressable>
  );
}
