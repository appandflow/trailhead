import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { radius, spacing, useTheme } from '@/src/theme';

interface StatCardProps {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
}

export function StatCard({ label, value, icon, accent = false }: StatCardProps) {
  const { colors } = useTheme();
  const tint = accent ? colors.primary : colors.textMuted;

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[
        styles.card,
        {
          backgroundColor: accent ? colors.primaryMuted : colors.surface,
          borderColor: accent ? colors.primaryMuted : colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        {icon ? <Ionicons name={icon} size={14} color={tint} /> : null}
        <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.value, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  value: { fontSize: 20, fontWeight: '700' },
});
