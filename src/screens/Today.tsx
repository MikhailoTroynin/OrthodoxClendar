import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, TextStyle, View } from 'react-native';
import { MG, WS } from '../data/calendar';
import { Body, Divider, FastIcon, GhostButton, Heading, Icon, Kicker, NUM, Press, Tag } from '../components/ui';
import { TopBar } from '../components/Chrome';
import { DayPager } from '../components/DayPager';
import { RefText } from '../components/Scripture';
import { dayInfo, fastKind, fmtDate, julianOf, sameDay, toKey, weekOf, weekdayIdx, weekdayName } from '../lib/calendar';
import { feofanL, useLazy } from '../lib/lazy';
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
          <FadeIn>
            <Press
              onPress={() => setDate(today)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 10, borderWidth: 1, borderColor: p.accent }}
            >
              <Icon name="undo" size={16} color={p.a700} sw={1.6} />
              <Text style={{ fontFamily: FONT.headingBold, fontSize: 16, color: p.a700 }}>{t.toToday}</Text>
            </Press>
          </FadeIn>
        )}
      </View>

      {/* Підсумок дня: піст і, якщо є, свято. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <View style={{ height: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: p.divider, borderRadius: RADIUS }}>
          <FastIcon kind={kind} size={18} />
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: FONT.headingBold, fontSize: 18, color: p.text }}>{fastTitle}</Text>
        </View>
        {!!tag && (
          <View style={{ height: 34, justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: p.accent, borderRadius: RADIUS }}>
            <Text style={{ fontFamily: FONT.headingBold, fontSize: 18, color: p.a700 }}>{tag}</Text>
          </View>
        )}
      </View>

      <WeekStrip week={week} d={d} />

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

      <Feofan d={d} />

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

/** Думка дня свт. Феофана Затворника (за сторінкою дня на azbyka.ru); без запису для дня розділу немає. */
function Feofan({ d }: { d: Date }) {
  const { p, t } = useStore();
  const ready = useLazy(feofanL);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const m = feofanL();
  const ids = ready && m ? m.D[toKey(d)] : undefined;
  if (!ids) return null;
  return (
    <>
      <Divider gap={20} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Kicker style={{ width: COL - 12, paddingTop: 6 }}>{t.feofan}</Kicker>
        <View style={{ flex: 1, gap: 14 }}>
          {ids.map((id) => {
            const [, head, ...paras] = m!.T[id];
            const shown = open[id] ? paras : paras.slice(0, 1);
            return (
              <View key={id}>
                {head !== '' && (
                  <Text style={[{ fontFamily: FONT.body, fontSize: 13, color: p.mute(60), marginBottom: 6 }, NUM]}>{head}</Text>
                )}
                {shown.map((x, i) => (
                  <Body key={i} size={14} style={{ marginTop: i ? 8 : 0 }}>
                    {x}
                  </Body>
                ))}
                {paras.length > 1 && (
                  <Pressable accessibilityRole="button" onPress={() => setOpen({ ...open, [id]: !open[id] })} style={{ paddingVertical: 8 }}>
                    <Text style={{ fontFamily: FONT.body, fontSize: 13, color: p.a700 }}>{open[id] ? t.less : t.more}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          <Body size={11} mute={55}>{t.feofanSub}</Body>
        </View>
      </View>
    </>
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

/** Поява за 250 мс. */
function FadeIn({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [v]);
  return <Animated.View style={{ opacity: v }}>{children}</Animated.View>;
}

/** Тиждень: одна золота рамка ковзає між днями за 280 мс; значок посту лише в пісні дні. */
function WeekStrip({ week, d }: { week: Date[]; d: Date }) {
  const { p, lang, cal, today, setDate } = useStore();
  const [w, setW] = useState(0);
  const GAP = 4;
  const cell = w ? (w - GAP * 6) / 7 : 0;
  const sel = Math.max(0, week.findIndex((x) => sameDay(x, d)));
  const x = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (!cell) return;
    const to = sel * (cell + GAP);
    if (!placed.current) {
      placed.current = true;
      x.setValue(to);
    } else Animated.timing(x, { toValue: to, duration: 280, easing: Easing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: true }).start();
  }, [sel, cell, x]);
  return (
    <View style={{ flexDirection: 'row', gap: GAP, marginTop: 20 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {!!cell && (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: cell, borderWidth: 1, borderColor: p.accent, borderRadius: RADIUS, transform: [{ translateX: x }] }}
        />
      )}
      {week.map((wd) => {
        const on = sameDay(wd, d);
        const isToday = sameDay(wd, today);
        const e = dayInfo(wd, cal, lang);
        const feast = e.rank > 0;
        const k = fastKind(e);
        return (
          <Pressable
            key={toKey(wd)}
            accessibilityRole="button"
            onPress={() => setDate(wd)}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              gap: 3,
              paddingTop: 7,
              paddingBottom: 6,
              borderRadius: RADIUS,
              backgroundColor: pressed ? p.mute(8) : 'transparent',
            })}
          >
            <Text style={{ fontFamily: FONT.body, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: p.mute(70) }}>
              {WS[lang][weekdayIdx(wd)]}
            </Text>
            <Text
              style={[
                {
                  fontFamily: isToday ? FONT.headingBold : FONT.heading,
                  fontSize: 21,
                  lineHeight: 22,
                  color: on || feast ? p.a700 : p.text,
                  textDecorationLine: isToday ? 'underline' : 'none',
                },
                NUM,
              ]}
            >
              {wd.getDate()}
            </Text>
            <View style={{ height: 16, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              {feast && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: p.accent }} />}
              {k !== 'meat' && <FastIcon kind={k} size={16} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
