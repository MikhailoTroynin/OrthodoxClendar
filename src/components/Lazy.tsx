import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Lazy, useLazy } from '../lib/lazy';
import { useStore } from '../store';

/** Індикатор, поки завантажуються дані. */
export function Loading() {
  const { p } = useStore();
  return (
    <View style={{ flex: 1, minHeight: 120, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={p.accent} />
    </View>
  );
}

/** Показує children, щойно завантажено модулі need; до того — fallback (індикатор). */
export function Gate({ need, fallback, children }: { need: Lazy<unknown>[]; fallback?: React.ReactNode; children: React.ReactNode }) {
  const ready = useLazy(...need);
  return <>{ready ? children : fallback ?? <Loading />}</>;
}
