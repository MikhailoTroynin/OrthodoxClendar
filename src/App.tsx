import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
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

function Shell() {
  const { p, tab, theme } = useStore();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <StatusBar style={theme === 'night' ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        {tab === 'today' && <Today />}
        {tab === 'cal' && <CalendarTab />}
        {tab === 'book' && <BookTab />}
        {tab === 'bible' && <BibleTab />}
        {tab === 'more' && <MenuTab />}
      </View>
      <TabBar />
      <OverlayHost />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_600SemiBold,
    Lora_400Regular,
    Lora_600SemiBold,
  });
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  return (
    <SafeAreaProvider>
      <StoreProvider onReady={onReady}>{fontsLoaded && ready ? <Shell /> : <View style={{ flex: 1 }} />}</StoreProvider>
    </SafeAreaProvider>
  );
}
