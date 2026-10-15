import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond';
import { Lora_400Regular, Lora_600SemiBold } from '@expo-google-fonts/lora';
import { StoreProvider, useStore } from './store';
import { TabBar } from './components/Chrome';
import Today from './screens/Today';
import CalendarTab from './screens/CalendarTab';
import BookTab from './screens/BookTab';
import BibleTab from './screens/BibleTab';
import MenuTab from './screens/MenuTab';
import { OverlayHost } from './screens/Overlays';
import { Gate } from './components/Lazy';
import { ErrorBoundary } from './components/ErrorBoundary';
import { prayersL } from './lib/lazy';

function Shell() {
  const { p, tab, theme } = useStore();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <StatusBar style={theme === 'night' ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        {tab === 'today' && <Today />}
        {tab === 'cal' && <CalendarTab />}
        {tab === 'book' && (
          <Gate need={[prayersL]}>
            <BookTab />
          </Gate>
        )}
        {tab === 'bible' && <BibleTab />}
        {tab === 'more' && <MenuTab />}
        {/* Вкладені екрани відкриваються над вкладкою, а нижня панель лишається видимою. */}
        <OverlayHost />
      </View>
      <TabBar />
    </View>
  );
}

/** Екран запуску: тло теми з індикатором, поки готуються шрифти й налаштування. */
function Splash() {
  const { p } = useStore();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={p.accent} />
    </View>
  );
}

/** Скільки чекати на шрифти; далі застосунок відкривається зі системними. */
const FONT_WAIT_MS = 4000;

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_600SemiBold,
    Lora_400Regular,
    Lora_600SemiBold,
  });
  const [fontWaitOver, setFontWaitOver] = useState(false);
  useEffect(() => {
    if (fontError) console.warn('Не вдалося завантажити шрифти', fontError);
  }, [fontError]);
  useEffect(() => {
    const h = setTimeout(() => setFontWaitOver(true), FONT_WAIT_MS);
    return () => clearTimeout(h);
  }, []);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  // Шрифти не повинні блокувати запуск: якщо вони не завантажились, текст буде системним шрифтом.
  const fontsDone = fontsLoaded || !!fontError || fontWaitOver;
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StoreProvider onReady={onReady}>{fontsDone && ready ? <Shell /> : <Splash />}</StoreProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
