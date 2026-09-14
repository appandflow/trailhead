import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { trailPhotoUrl, type Difficulty, type Trail } from '@/src/data/trails';
import { formatDistance, formatDuration, formatElevation } from '@/src/lib/format';
import { useSettingsStore } from '@/src/store/settingsStore';
import { radius, spacing, useTheme, type Palette } from '@/src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export function difficultyColor(difficulty: Difficulty, colors: Palette): string {
  switch (difficulty) {
    case 'easy':
      return colors.success;
    case 'moderate':
      return colors.primary;
    case 'hard':
      return colors.accent;
    case 'expert':
      return colors.danger;
  }
}

export function difficultyLabel(difficulty: Difficulty): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

interface TrailCardProps {
  trail: Trail;
  distanceMeters: number;
}

export function TrailCard({ trail, distanceMeters }: TrailCardProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const units = useSettingsStore((s) => s.units);
  const accent = difficultyColor(trail.difficulty, colors);
  const distance = formatDistance(distanceMeters, units);
  const ascent = formatElevation(trail.elevationGainM, units);
  const duration = formatDuration(trail.estimatedMinutes * 60);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/trail/[id]', params: { id: trail.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${trail.name}, ${trail.region}, ${difficultyLabel(trail.difficulty)}, rated ${trail.rating.toFixed(1)} out of 5, ${distance}, ${ascent} of ascent, estimated duration ${duration}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <Image
        source={{ uri: trailPhotoUrl(trail, 320) }}
        style={[styles.photo, { backgroundColor: colors.surfaceAlt }]}
        contentFit="cover"
        transition={150}
        accessibilityIgnoresInvertColors
      />
      <View style={styles.body}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
          {trail.name}
        </Text>
        <Text numberOfLines={1} style={[styles.region, { color: colors.textMuted }]}>
          {trail.region}
        </Text>

        <View style={styles.stats}>
          <Stat icon="walk-outline" value={distance} color={colors.textMuted} />
          <Stat icon="trending-up-outline" value={ascent} color={colors.textMuted} />
          <Stat icon="time-outline" value={duration} color={colors.textMuted} />
        </View>

        <View style={styles.footer}>
          <View style={[styles.pill, { backgroundColor: `${accent}22` }]}>
            <Text style={[styles.pillText, { color: accent }]}>{difficultyLabel(trail.difficulty)}</Text>
          </View>
          <View style={styles.rating}>
            <Ionicons name="star" size={13} color={colors.accent} />
            <Text style={[styles.ratingValue, { color: colors.text }]}>{trail.rating.toFixed(1)}</Text>
            <Text style={[styles.reviewCount, { color: colors.textMuted }]}>({trail.reviewCount})</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function Stat({ icon, value, color }: { icon: IoniconName; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  photo: { width: 92, height: 92, borderRadius: radius.md },
  body: { flex: 1, justifyContent: 'space-between' },
  name: { fontSize: 16, fontWeight: '600' },
  region: { fontSize: 13, marginTop: 2 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  stat: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statValue: { fontSize: 12 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  pillText: { fontSize: 11, fontWeight: '600' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  ratingValue: { fontSize: 12, fontWeight: '600' },
  reviewCount: { fontSize: 12 },
});
