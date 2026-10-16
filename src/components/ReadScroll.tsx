import React, { useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useStore } from '../store';

const TRACK = 2;
const THUMB = 3;
const MIN_THUMB = 28;
const INSET = 6;

/** Прокрутка для довгого читання з тоненьким золотим повзунком праворуч: показує, на якій глибині тексту читач. */
export function ReadScroll({ children }: { children: React.ReactNode }) {
  const { p } = useStore();
  const y = useRef(new Animated.Value(0)).current;
  const [view, setView] = useState(0);
  const [content, setContent] = useState(0);
  const track = Math.max(0, view - INSET * 2);
  const max = content - view;
  const show = max > 8 && track > 0;
  const thumb = show ? Math.max(MIN_THUMB, Math.min(track, (track * view) / content)) : 0;
  const travel = track - thumb;
  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView
        onLayout={(e) => setView(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, h) => setContent(h)}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </Animated.ScrollView>
      {show && (
        <View pointerEvents="none" style={{ position: 'absolute', top: INSET, bottom: INSET, right: 4, width: THUMB, alignItems: 'center' }}>
          <View style={{ position: 'absolute', top: 0, bottom: 0, width: TRACK, borderRadius: 1, backgroundColor: p.divider }} />
          <Animated.View
            style={{
              width: THUMB,
              height: thumb,
              borderRadius: THUMB / 2,
              backgroundColor: p.accent,
              transform: [{ translateY: y.interpolate({ inputRange: [0, max], outputRange: [0, travel], extrapolate: 'clamp' }) }],
            }}
          />
        </View>
      )}
    </View>
  );
}
