import { useEffect, useRef, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { daftarTarget, type NodeView } from './registry';

/**
 * Pembungkus elemen yang bisa disorot tur fitur. Tidak mengubah tampilan; collapsable=false agar
 * Android tidak meratakan View ini sehingga posisinya bisa diukur.
 */
export function TargetTur({
  id,
  gulir,
  style,
  onLayout,
  children,
}: {
  id: string;
  gulir?: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const ref = useRef<NodeView>(null);
  const gulirRef = useRef(gulir);
  useEffect(() => {
    gulirRef.current = gulir;
  }, [gulir]);
  const bisaGulir = !!gulir;
  useEffect(
    () => daftarTarget(id, { ref, gulir: bisaGulir ? () => gulirRef.current?.() : undefined }),
    [id, bisaGulir],
  );
  return (
    <View ref={ref} collapsable={false} style={style} onLayout={onLayout}>
      {children}
    </View>
  );
}
