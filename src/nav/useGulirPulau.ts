import { useCallback } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useNavPulau } from './NavPulauProvider';

// Pasang ke ScrollView layar tab: `{...useGulirPulau('index')}`.
export function useGulirPulau(rute: string): {
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: 16;
} {
  const { aktifkan, laporGulir } = useNavPulau();
  useFocusEffect(
    useCallback(() => {
      aktifkan(rute);
    }, [aktifkan, rute]),
  );
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => laporGulir(rute, e.nativeEvent.contentOffset.y),
    [laporGulir, rute],
  );
  return { onScroll, scrollEventThrottle: 16 };
}
