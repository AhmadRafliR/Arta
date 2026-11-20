import { Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';
import { NavPulauProvider } from '@/nav/NavPulauProvider';

export default function TabsLayout() {
  return (
    <NavPulauProvider>
      <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="riwayat" />
        <Tabs.Screen name="hutang" />
        <Tabs.Screen name="akun" />
      </Tabs>
    </NavPulauProvider>
  );
}
