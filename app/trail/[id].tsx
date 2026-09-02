import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RouteMap } from '@/src/components/RouteMap';
import { difficultyColor, difficultyLabel } from '@/src/components/TrailCard';
import { getTrail, trailPhotoUrl } from '@/src/data/trails';
import { formatDistance, formatDuration, formatElevation } from '@/src/lib/format';
import { useSettingsStore } from '@/src/store/settingsStore';
import { radius, spacing, useTheme } from '@/src/theme';

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const units = useSettingsStore((s) => s.units);
  const trail = getTrail(id);

  if (!trail) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Trail' }} />
        <Ionicons name="trail-sign-outline" size={40} color={colors.textMuted} />
        <Text style={[styles.missingTitle, { color: colors.text }]}>Trail unavailable</Text>
        <Text style={[styles.missingBody, { color: colors.textMuted }]}>
          This trail is no longer part of the guide.
        </Text>
      </View>
    );
  }

  const elevations = trail.route.map((point) => point.elevation);
  const highPoint = Math.max(...elevations);
  const lowPoint = Math.min(...elevations);
  const averageGrade = (trail.elevationGainM / (trail.distanceKm * 1000)) * 100;
  const accent = difficultyColor(trail.difficulty, colors);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: trail.name }} />

      <Image
        source={{ uri: trailPhotoUrl(trail, 900) }}
        style={[styles.hero, { backgroundColor: colors.surfaceAlt }]}
        contentFit="cover"
        transition={200}
        accessibilityLabel={`Photo of ${trail.name}`}
        accessibilityIgnoresInvertColors
      />

      <View style={styles.section}>
        <Text style={[styles.name, { color: colors.text }]}>{trail.name}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.region, { color: colors.textMuted }]}>{trail.region}</Text>
          <View style={[styles.difficultyPill, { backgroundColor: `${accent}22` }]}>
            <Text style={[styles.difficultyLabel, { color: accent }]}>
              {difficultyLabel(trail.difficulty)}
            </Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="star" size={14} color={colors.accent} />
          <Text style={[styles.rating, { color: colors.text }]}>{trail.rating.toFixed(1)}</Text>
          <Text style={[styles.reviewCount, { color: colors.textMuted }]}>
            {trail.reviewCount} reviews
          </Text>
        </View>
      </View>

      <View style={[styles.mapFrame, { borderColor: colors.border }]}>
        <RouteMap points={trail.route} style={styles.map} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatDistance(trail.distanceKm * 1000, units)}</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatElevation(trail.elevationGainM, units)}</Text>
          <Text style={styles.statLabel}>Ascent</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatDuration(trail.estimatedMinutes * 60)}</Text>
          <Text style={styles.statLabel}>Est. time</Text>
        </View>
      </View>

      <View style={styles.description}>
        <Text style={styles.descriptionTitle}>About this trail</Text>
        <Text style={styles.descriptionBody}>{trail.description}</Text>
      </View>

      <View style={styles.tags}>
        {trail.tags.map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagLabel}>{tag}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.elevationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.elevationHeader}>
          <Ionicons name="trending-up-outline" size={16} color={colors.primary} />
          <Text style={[styles.elevationTitle, { color: colors.text }]}>Elevation gain</Text>
        </View>
        <Text style={[styles.elevationValue, { color: colors.text }]}>
          {formatElevation(trail.elevationGainM, units)}
        </Text>
        <Text style={[styles.elevationCaption, { color: colors.textMuted }]}>
          {averageGrade.toFixed(1)}% average grade over {formatDistance(trail.distanceKm * 1000, units)}
        </Text>
        <View style={[styles.elevationSplit, { borderTopColor: colors.border }]}>
          <View style={styles.elevationStat}>
            <Text style={[styles.elevationStatLabel, { color: colors.textMuted }]}>High point</Text>
            <Text style={[styles.elevationStatValue, { color: colors.text }]}>
              {formatElevation(highPoint, units)}
            </Text>
          </View>
          <View style={styles.elevationStat}>
            <Text style={[styles.elevationStatLabel, { color: colors.textMuted }]}>Low point</Text>
            <Text style={[styles.elevationStatValue, { color: colors.text }]}>
              {formatElevation(lowPoint, units)}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, gap: spacing.lg },
  hero: { width: '100%', height: 220 },
  section: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  name: { fontSize: 24, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  region: { fontSize: 14 },
  difficultyPill: {
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  difficultyLabel: { fontSize: 11, fontWeight: '600' },
  rating: { fontSize: 14, fontWeight: '600' },
  reviewCount: { fontSize: 13, marginLeft: spacing.xs },
  mapFrame: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  map: { height: 220 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE0D7',
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 16, fontWeight: '700', color: '#171A16' },
  statLabel: { fontSize: 12, color: '#5F6B5C' },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: '#DDE0D7' },
  description: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE0D7',
    gap: spacing.sm,
  },
  descriptionTitle: { fontSize: 15, fontWeight: '600', color: '#171A16' },
  descriptionBody: { fontSize: 14, lineHeight: 21, color: '#5F6B5C' },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE0D7',
  },
  tagLabel: { fontSize: 12, fontWeight: '500', color: '#171A16' },
  elevationCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  elevationHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  elevationTitle: { fontSize: 15, fontWeight: '600' },
  elevationValue: { fontSize: 28, fontWeight: '700' },
  elevationCaption: { fontSize: 13 },
  elevationSplit: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  elevationStat: { flex: 1, gap: 2 },
  elevationStatLabel: { fontSize: 12 },
  elevationStatValue: { fontSize: 15, fontWeight: '600' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  missingTitle: { fontSize: 17, fontWeight: '600' },
  missingBody: { fontSize: 14, textAlign: 'center' },
});
