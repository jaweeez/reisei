import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '@/lib/auth/AuthProvider';
import { color, fontFamily, palette } from '@/theme';

// Tab bar labels use the mono "data" voice. Icons are kept as simple glyphs to
// avoid an icon-font dependency in the scaffold.
function TabGlyph({ glyph, focused }: { glyph: string; focused: boolean }) {
  return <Text style={{ fontFamily: fontFamily.mono, fontSize: 18, color: focused ? palette.brassBright : color.textSecondary }}>{glyph}</Text>;
}

export default function TabsLayout() {
  const { status } = useAuth();
  if (status === 'loading') return null;
  if (status === 'guest') return <Redirect href="/landing" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: color.card, borderTopColor: color.rule },
        tabBarActiveTintColor: palette.brassBright,
        tabBarInactiveTintColor: color.textSecondary,
        tabBarLabelStyle: { fontFamily: fontFamily.mono, fontSize: 10, letterSpacing: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'TODAY', tabBarIcon: ({ focused }) => <TabGlyph glyph="◎" focused={focused} /> }}
      />
      <Tabs.Screen
        name="crew"
        options={{ title: 'CORNER', tabBarIcon: ({ focused }) => <TabGlyph glyph="●" focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'YOU', tabBarIcon: ({ focused }) => <TabGlyph glyph="▤" focused={focused} /> }}
      />
    </Tabs>
  );
}
