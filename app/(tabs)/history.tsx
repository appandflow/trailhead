import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Canvas, RoundedRect } from '@shopify/react-native-skia';
import { format, startOfMonth, subMonths } from 'date-fns';

import { StatCard } from '@/src/components/StatCard';
import type { Hike } from '@/src/db/schema';
import { groupHikesByMonth, useHikes } from '@/src/features/history/useHikes';
import { formatDistance, formatDuration, formatElevation } from '@/src/lib/format';
import { useSettingsStore } from '@/src/store/settingsStore';
import { radius, spacing, useTheme } from '@/src/theme';

const CHART_MONTHS = 6;
const CHART_HEIGHT = 96;
const BAR_RADIUS = 4;

interface MonthTotal {
  key: string;
  label: string;
  meters: number;
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const units = useSettingsStore((s) => s.units);
  const { data, isPending, isError, refetch, isRefetching } = useHikes();

  const sections = useMemo(() => groupHikesByMonth(data ?? []), [data]);
  const totals = useMemo(() => lifetimeTotals(data ?? []), [data]);
  const monthly = useMemo(() => monthlyDistance(data ?? [], CHART_MONTHS), [data]);

  const renderItem = useCallback(
    ({ item }: { item: Hike }) => <HikeRow hike={item} />,
    [],
  );

  if (isPending) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Could not load your hikes</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => refetch()}
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.retryLabel, { color: colors.textInverse }]}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      stickySectionHeadersEnabled
      refreshing={isRefetching}
      onRefresh={refetch}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        sections.length === 0 && styles.emptyContent,
      ]}
      ListHeaderComponent={
        sections.length > 0 ? <SummaryHeader totals={totals} monthly={monthly} /> : null
      }
      ListEmptyComponent={<EmptyState />}
      renderSectionHeader={({ section }) => (
        <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
          <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>
            {formatDistance(
              section.data.reduce((sum, hike) => sum + hike.distanceMeters, 0),
              units,
            )}
          </Text>
        </View>
      )}
    />
  );
}

function SummaryHeader({ totals, monthly }: { totals: LifetimeTotals; monthly: MonthTotal[] }) {
  const { colors } = useTheme();
  const units = useSettingsStore((s) => s.units);
  const [chartWidth, setChartWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => setChartWidth(event.nativeEvent.layout.width);

  return (
    <View style={styles.header}>
      <View style={styles.statRow}>
        <StatCard label="Hikes" value={String(totals.count)} icon="footsteps-outline" accent />
        <StatCard
          label="Distance"
          value={formatDistance(totals.distanceMeters, units)}
          icon="trail-sign-outline"
        />
        <StatCard
          label="Ascent"
          value={formatElevation(totals.elevationGainMeters, units)}
          icon="trending-up-outline"
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Distance per month</Text>
        <View onLayout={onLayout}>
          {chartWidth > 0 ? <MonthlyBars data={monthly} width={chartWidth} /> : null}
        </View>
        <View style={styles.axis}>
          {monthly.map((month) => (
            <Text key={month.key} style={[styles.axisLabel, { color: colors.textMuted }]}>
              {month.label}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function MonthlyBars({ data, width }: { data: MonthTotal[]; width: number }) {
  const { colors } = useTheme();
  const units = useSettingsStore((s) => s.units);

  const peak = Math.max(...data.map((month) => month.meters), 1);
  const slot = width / data.length;
  const barWidth = Math.max(slot - spacing.md, 8);
  const busiest = data.reduce((best, month) => (month.meters > best.meters ? month : best), data[0]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Distance for the last ${data.length} months. Highest was ${busiest.label}, ${formatDistance(busiest.meters, units)}.`}
    >
      <Canvas style={{ width, height: CHART_HEIGHT }}>
        {data.map((month, index) => {
          const x = index * slot + (slot - barWidth) / 2;
          const height = Math.max((month.meters / peak) * CHART_HEIGHT, 2);
          return (
            <RoundedRect
              key={month.key}
              x={x}
              y={CHART_HEIGHT - height}
              width={barWidth}
              height={height}
              r={BAR_RADIUS}
              color={month.meters > 0 ? colors.chartLine : colors.border}
            />
          );
        })}
      </Canvas>
    </View>
  );
}

function HikeRow({ hike }: { hike: Hike }) {
  const { colors } = useTheme();
  const units = useSettingsStore((s) => s.units);
  const date = format(new Date(hike.startedAt), 'EEE, MMM d');
  const distance = formatDistance(hike.distanceMeters, units);
  const duration = formatDuration(hike.durationSeconds);
  const ascent = formatElevation(hike.elevationGainMeters, units);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${hike.title}, ${date}, ${distance}, ${duration}, ${ascent} of ascent`}
      onPress={() => router.push(`/hike/${hike.id}`)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
          {hike.title}
        </Text>
        <Text style={[styles.rowDate, { color: colors.textMuted }]}>{date}</Text>
        <View style={styles.rowStats}>
          <RowStat icon="trail-sign-outline" value={distance} />
          <RowStat icon="time-outline" value={duration} />
          <RowStat icon="trending-up-outline" value={ascent} />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function RowStat({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.rowStat}>
      <Ionicons name={icon} size={13} color={colors.textMuted} />
      <Text style={[styles.rowStatText, { color: colors.textMuted }]}>{value}</Text>
    </View>
  );
}

function EmptyState() {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name="map-outline" size={44} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No hikes yet</Text>
      <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
        Recorded hikes show up here, grouped by month.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/record')}
        style={[styles.retryButton, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.retryLabel, { color: colors.textInverse }]}>Record a hike</Text>
      </Pressable>
    </View>
  );
}

interface LifetimeTotals {
  count: number;
  distanceMeters: number;
  elevationGainMeters: number;
}

function lifetimeTotals(list: Hike[]): LifetimeTotals {
  return list.reduce<LifetimeTotals>(
    (totals, hike) => ({
      count: totals.count + 1,
      distanceMeters: totals.distanceMeters + hike.distanceMeters,
      elevationGainMeters: totals.elevationGainMeters + hike.elevationGainMeters,
    }),
    { count: 0, distanceMeters: 0, elevationGainMeters: 0 },
  );
}

function monthlyDistance(list: Hike[], monthCount: number): MonthTotal[] {
  const thisMonth = startOfMonth(new Date());
  const buckets: MonthTotal[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const month = subMonths(thisMonth, i);
    buckets.push({ key: format(month, 'yyyy-MM'), label: format(month, 'MMM'), meters: 0 });
  }

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const hike of list) {
    const bucket = byKey.get(format(new Date(hike.startedAt), 'yyyy-MM'));
    if (bucket) bucket.meters += hike.distanceMeters;
  }
  return buckets;
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  emptyContent: { flexGrow: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  header: { padding: spacing.lg, gap: spacing.lg },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  axis: { flexDirection: 'row' },
  axisLabel: { flex: 1, fontSize: 11, textAlign: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionMeta: { fontSize: 13, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  rowBody: { flex: 1, gap: spacing.xs },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowDate: { fontSize: 13 },
  rowStats: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  rowStat: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowStatText: { fontSize: 13 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center' },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  retryLabel: { fontSize: 15, fontWeight: '600' },
});
