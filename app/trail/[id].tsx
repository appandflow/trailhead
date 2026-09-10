import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Transition from 'react-native-screen-transitions';

import { RouteMap } from '@/src/components/RouteMap';
import { difficultyColor, difficultyLabel } from '@/src/components/TrailCard';
import { getTrail, trailPhotoUrl } from '@/src/data/trails';
import { formatDistance, formatDuration, formatElevation } from '@/src/lib/format';
import { useSettingsStore } from '@/src/store/settingsStore';
import { radius, spacing, useTheme } from '@/src/theme';

function TrailBackButton() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to trails"
      onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
      style={({ pressed }) => ({
        position: 'absolute',
        top: insets.top + spacing.sm,
        left: spacing.lg,
        zIndex: 2,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name="chevron-back" size={26} color={colors.text} />
    </Pressable>
  );
}

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const units = useSettingsStore((s) => s.units);
  const trail = getTrail(id);

  if (!trail) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <TrailBackButton />
        <View style={styles.missing}>
          <Ionicons name="trail-sign-outline" size={40} color={colors.textMuted} />
          <Text style={[styles.missingTitle, { color: colors.text }]}>Trail unavailable</Text>
          <Text style={[styles.missingBody, { color: colors.textMuted }]}>
            This trail is no longer part of the guide.
          </Text>
        </View>
      </View>
    );
  }

  const elevations = trail.route.map((point) => point.elevation);
  const highPoint = Math.max(...elevations);
  const lowPoint = Math.min(...elevations);
  const averageGrade = (trail.elevationGainM / (trail.distanceKm * 1000)) * 100;
  const accent = difficultyColor(trail.difficulty, colors);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Transition.ScrollView
        style={{ backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="never"
        bounces={false}
        overScrollMode="never"
      >
        <Transition.Boundary
          id={`trail-${trail.id}`}
          style={{ width: '100%', height: 280 + insets.top, backgroundColor: colors.surfaceAlt }}
        >
          <Image
            source={{ uri: trailPhotoUrl(trail, 900) }}
            placeholder={{ uri: trailPhotoUrl(trail, 320) }}
            placeholderContentFit="cover"
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            style={{ width: '100%', height: '100%' }}
            accessibilityIgnoresInvertColors
          />
        </Transition.Boundary>

        <View style={{
          marginTop: -24,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          backgroundColor: colors.background,
          paddingTop: spacing.xl,
          paddingBottom: spacing.xxl + insets.bottom,
          gap: spacing.lg,
        }}>
          <View style={styles.section}>
            <Text accessibilityRole="header" style={[styles.name, { color: colors.text }]}>{trail.name}</Text>
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

          <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatDistance(trail.distanceKm * 1000, units)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Distance</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatElevation(trail.elevationGainM, units)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Ascent</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatDuration(trail.estimatedMinutes * 60)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Est. time</Text>
            </View>
          </View>

          <View
            style={[styles.description, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.descriptionTitle, { color: colors.text }]}>About this trail</Text>
            <Text style={[styles.descriptionBody, { color: colors.textMuted }]}>{trail.description}</Text>
          </View>

          <View style={styles.tags}>
            {trail.tags.map((tag) => (
              <View
                key={tag}
                style={[styles.tag, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.tagLabel, { color: colors.text }]}>{tag}</Text>
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
        </View>
      </Transition.ScrollView>
      <TrailBackButton />
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 12 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28 },
  description: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  descriptionTitle: { fontSize: 15, fontWeight: '600' },
  descriptionBody: { fontSize: 14, lineHeight: 21 },
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
  },
  tagLabel: { fontSize: 12, fontWeight: '500' },
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
