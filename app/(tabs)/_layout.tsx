import { Tabs, useIsFocused } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, Platform, View } from 'react-native';
import { useTheme } from '@/src/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  const focused = useIsFocused();
  return (
    <View
      style={{ flex: 1 }}
      accessibilityElementsHidden={!focused}
      importantForAccessibility={focused ? 'auto' : 'no-hide-descendants'}
    >
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          sceneStyle: { backgroundColor: colors.background },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Trails',
            headerTitleAlign: Platform.OS === 'android' ? 'center' : undefined,
            headerShadowVisible: false,
            headerTitle: () => (
              <Image
                source={require('../../assets/images/textLogo.png')}
                resizeMode="contain"
                accessible
                accessibilityLabel="TrailHead"
                style={{ width: 132, height: 44, tintColor: colors.primary }}
              />
            ),
            tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="record"
          options={{
            title: 'Record',
            tabBarIcon: ({ color, size }) => <Ionicons name="radio-button-on" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
          }}
        />
      </Tabs>
    </View>
  );
}
