import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MG, WS } from '../data/calendar';
import { Body, Divider, GhostButton, Heading, Kicker, Marks, NUM, Tag } from '../components/ui';
import { TopBar } from '../components/Chrome';
import { dayInfo, fmtDate, julianOf, sameDay, toKey, weekOf, weekdayIdx, weekdayName } from '../lib/calendar';
import { useStore } from '../store';
import { FONT, RADIUS } from '../theme';

const COL = 96;

export default function Today() {
  const { p, t, lang, cal, date, setDate, push } = useStore();
  const day = dayInfo(date, cal, lang);
  const week = weekOf(date);
  const wd = weekdayName(date, lang);
  const fastText = !day.isFast ? t.noFastTx : day.rank === 2 ? t.fastFish : day.rank === 1 ? t.fastOil : t.fastStrict;
  const tag = day.rank === 2 ? t.greatTag : day.rank === 1 ? t.feastTag : '';
  const jline = `${cal === 'nj' ? t.julian : t.church}: ${fmtDate(julianOf(date), lang)}`;

  return (
    <View style={{ flex: 1 }}>
      <TopBar kicker={`${wd} · ${cal === 'nj' ? t.nj : t.oj}`} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 36 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
          <Text style={[{ fontFamily: FONT.heading, fontSize: 116, lineHeight: 110, letterSpacing: -4.6, color: p.text }, NUM]}>
            {date.getDate()}
          </Text>
          <View style={{ paddingBottom: 8 }}>
            <Text style={{ fontFamily: FONT.headingBold, fontSize: 26, lineHeight: 28, color: p.text }}>
              {MG[lang][date.getMonth()]}
            </Text>
            <Body size={13} mute={60}>{`${wd}, ${date.getFullYear()}`}</Body>
          </View>
        </View>
        <Body size={12} style={{ color: p.a700, marginTop: 22 }}>{jline}</Body>

        <View style={{ flexDirection: 'row', gap: 4, marginTop: 20 }}>
          {week.map((w) => {
            const sel = sameDay(w, date);
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
                    { fontFamily: sel || w.getDate() === 13 ? FONT.headingBold : FONT.heading, fontSize: 20, lineHeight: 22, color: sel || feast ? p.a700 : p.text },
                    NUM,
                  ]}
                >
                  {w.getDate()}
                </Text>
                <Marks feast={feast} fast={e.isFast} />
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
          <Text style={{ fontFamily: FONT.headingBold, fontSize: 27, lineHeight: 31, letterSpacing: -0.27, color: p.text }}>
            {day.title}
          </Text>
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
              <Body key={i} size={15} mute={85}>
                {m}
              </Body>
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
          <View style={{ flex: 1 }}>
            <Heading size={18}>{day.fastLabel || (day.isFast ? t.fastDay : t.noFast)}</Heading>
            <Body size={13} mute={70}>{fastText}</Body>
          </View>
        </View>

        <Divider gap={20} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Kicker style={{ width: COL - 12, paddingTop: 6 }}>{t.readings}</Kicker>
          <View style={{ flex: 1 }}>
            {day.r1 !== '' && (
              <Reading label={t.apostle} value={day.r1} onPress={() => push({ t: 'chap', title: `${t.apostle} · ${day.r1}` })} />
            )}
            {day.r2 !== '' && (
              <Reading label={t.gospel} value={day.r2} onPress={() => push({ t: 'chap', title: `${t.gospel} · ${day.r2}` })} />
            )}
            {day.r1 === '' && day.r2 === '' && day.readingLines.length === 0 && (
              <Body size={13} mute={70}>Читання цього дня в джерелі не вказані.</Body>
            )}
            {day.readingLines.length > 0 && (
              <View style={{ marginTop: 8, gap: 6 }}>
                {day.readingLines.map((l, i) => (
                  <Body key={i} size={12.5} mute={65}>
                    {l}
                  </Body>
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
