import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, useTheme } from '@/src/theme';

export default function NotFoundScreen() {
  const { colors } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>This screen does not exist.</Text>
        <Link
          href="/"
          accessibilityRole="button"
          accessibilityLabel="Go to trails"
          style={[styles.link, { backgroundColor: colors.primary, color: colors.textInverse }]}
        >
          Go to trails
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { fontSize: 18, fontWeight: '600' },
  link: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
    fontSize: 16,
    fontWeight: '700',
  },
});
