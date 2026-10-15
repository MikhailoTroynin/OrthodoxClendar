import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

/**
 * Перехоплює помилки під час малювання. Без нього у зібраному APK React просто знімає все дерево
 * і лишається білий екран; тут натомість видно текст помилки й можна спробувати ще раз.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Помилка інтерфейсу', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#f3f2f2', paddingTop: 48 }}>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: '600', color: '#201f1d', marginBottom: 12 }}>Сталася помилка</Text>
          <Text style={{ fontSize: 14, color: '#201f1d', marginBottom: 16 }}>
            Будь ласка, надішліть знімок цього екрана розробникові.
          </Text>
          <Text selectable style={{ fontSize: 13, color: '#7d5411', marginBottom: 12 }}>
            {`${error.name}: ${error.message}`}
          </Text>
          {!!error.stack && (
            <Text selectable style={{ fontSize: 11, color: '#605d5d' }}>
              {error.stack.split('\n').slice(0, 12).join('\n')}
            </Text>
          )}
          <Pressable
            onPress={() => this.setState({ error: null })}
            style={{ marginTop: 24, alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#b68235' }}
          >
            <Text style={{ fontSize: 15, color: '#7d5411' }}>Спробувати знову</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}
