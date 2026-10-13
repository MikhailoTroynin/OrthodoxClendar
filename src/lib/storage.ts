import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'orthodox-calendar:v1';

export const loadJSON = async <T,>(): Promise<Partial<T> | null> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<T>) : null;
  } catch {
    return null;
  }
};

export const saveJSON = async (value: unknown) => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // збереження не критичне: застосунок працює й без нього
  }
};
