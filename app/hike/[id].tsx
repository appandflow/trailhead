import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { format } from 'date-fns';

import { ElevationChart, type ElevationPoint } from '@/src/components/ElevationChart';
import { StatCard } from '@/src/components/StatCard';
import { useHike } from '@/src/features/history/useHikes';
import { formatDistance, formatDuration, formatElevation, formatPace } from '@/src/lib/format';
import { boundingRegion, computeSplits, haversineMeters, type GeoPoint } from '@/src/lib/geo';
import { useSettingsStore } from '@/src/store/settingsStore';
import { radius, spacing, useTheme } from '@/src/theme';

const MAP_HEIGHT = 220;
const CHART_HEIGHT = 160;

export default function HikeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, name } = useTheme();
  const units = useSettingsStore((s) => s.units);
  const { data, isPending } = useHike(id ?? '');
  const [chartWidth, setChartWidth] = useState(0);

  const route = useMemo<GeoPoint[]>(
    () =>
      (data?.points ?? []).map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
        elevation: point.elevation ?? undefined,
        timestamp: point.timestamp,
      })),
    [data?.points],
  );

  const elevationSeries = useMemo(() => toElevationSeries(route), [route]);
  const splits = useMemo(() => computeSplits(route), [route]);
  const region = useMemo(() => boundingRegion(route), [route]);

  if (isPending) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="help-circle-outline" size={44} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Hike not found</Text>
        <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
          It may have been deleted from this device.
        </Text>
      </View>
    );
  }

  const { hike } = data;
  const startedAt = new Date(hike.startedAt);

  return (
    <>
      <Stack.Screen options={{ title: hike.title }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
      >
        <View style={styles.intro}>
          <Text style={[styles.title, { color: colors.text }]}>{hike.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {format(startedAt, "EEEE, MMMM d, yyyy 'at' h:mm a")}
          </Text>
        </View>

        <View style={[styles.mapCard, { borderColor: colors.border }]}>
          {route.length > 1 ? (
            <MapView
              style={styles.map}
              initialRegion={region}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              userInterfaceStyle={name}
              accessibilityLabel={`Map of the route for ${hike.title}`}
            >
              <Polyline coordinates={route} strokeColor={colors.mapRoute} strokeWidth={4} />
              <Marker coordinate={route[0]} title="Start" pinColor={colors.success} />
              <Marker coordinate={route[route.length - 1]} title="Finish" pinColor={colors.accent} />
            </MapView>
          ) : (
            <View style={[styles.mapFallback, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="location-outline" size={28} color={colors.textMuted} />
              <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                No GPS track was recorded
              </Text>
            </View>
          )}
        </View>

        <View style={styles.statGrid}>
          <View style={styles.statRow}>
            <StatCard
              label="Distance"
              value={formatDistance(hike.distanceMeters, units)}
              icon="trail-sign-outline"
              accent
            />
            <StatCard
              label="Duration"
              value={formatDuration(hike.durationSeconds)}
              icon="time-outline"
            />
          </View>
          <View style={styles.statRow}>
            <StatCard
              label="Ascent"
              value={formatElevation(hike.elevationGainMeters, units)}
              icon="trending-up-outline"
            />
            <StatCard
              label="Avg pace"
              value={formatPace(hike.durationSeconds, hike.distanceMeters, units)}
              icon="speedometer-outline"
            />
          </View>
        </View>

        <Section title="Elevation">
          <View onLayout={(event: LayoutChangeEvent) => setChartWidth(event.nativeEvent.layout.width)}>
            {chartWidth > 0 ? (
              <ElevationChart points={elevationSeries} width={chartWidth} height={CHART_HEIGHT} />
            ) : null}
          </View>
        </Section>

        {splits.length > 0 ? (
          <Section title="Splits">
            <View style={styles.splitHeader}>
              <Text style={[styles.splitHeaderCell, styles.splitKm, { color: colors.textMuted }]}>
                Km
              </Text>
              <Text style={[styles.splitHeaderCell, { color: colors.textMuted }]}>Time</Text>
              <Text style={[styles.splitHeaderCell, { color: colors.textMuted }]}>Pace</Text>
            </View>
            {splits.map((split) => (
              <View
                key={split.km}
                style={[styles.splitRow, { borderTopColor: colors.border }]}
                accessible
                accessibilityLabel={`Kilometer ${split.km}, ${formatDuration(split.seconds)}, ${formatPace(split.seconds, 1000, units)}`}
              >
                <Text style={[styles.splitCell, styles.splitKm, { color: colors.text }]}>
                  {split.km}
                </Text>
                <Text style={[styles.splitCell, { color: colors.text }]}>
                  {formatDuration(split.seconds)}
                </Text>
                <Text style={[styles.splitCell, { color: colors.text }]}>
                  {formatPace(split.seconds, 1000, units)}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        {hike.notes ? (
          <Section title="Notes">
            <Text style={[styles.notes, { color: colors.text }]}>{hike.notes}</Text>
          </Section>
        ) : null}
      </ScrollView>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function toElevationSeries(route: GeoPoint[]): ElevationPoint[] {
  const series: ElevationPoint[] = [];
  let meters = 0;
  for (let i = 0; i < route.length; i++) {
    if (i > 0) meters += haversineMeters(route[i - 1], route[i]);
    const elevation = route[i].elevation;
    if (elevation != null) series.push({ distanceKm: meters / 1000, elevation });
  }
  return series;
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, gap: spacing.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  intro: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.xs },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 14 },
  mapCard: {
    marginHorizontal: spacing.lg,
    height: MAP_HEIGHT,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  map: { flex: 1 },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  statGrid: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  section: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  splitHeader: { flexDirection: 'row', paddingBottom: spacing.sm },
  splitHeaderCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  splitRow: { flexDirection: 'row', paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  splitCell: { flex: 1, fontSize: 15, textAlign: 'right', fontVariant: ['tabular-nums'] },
  splitKm: { textAlign: 'left' },
  notes: { fontSize: 15, lineHeight: 22 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center' },
});
