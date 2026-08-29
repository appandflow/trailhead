import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { TrailCard, difficultyLabel } from '@/src/components/TrailCard';
import { regions, trails, type Difficulty, type Trail } from '@/src/data/trails';
import { routeDistanceMeters } from '@/src/lib/geo';
import { radius, spacing, useTheme } from '@/src/theme';

const DIFFICULTIES: Difficulty[] = ['easy', 'moderate', 'hard', 'expert'];

const SORTS = [
  { key: 'name', label: 'Name' },
  { key: 'distance', label: 'Distance' },
  { key: 'rating', label: 'Rating' },
] as const;

type SortKey = (typeof SORTS)[number]['key'];

interface TrailRow {
  trail: Trail;
  distanceMeters: number;
}

export default function TrailsScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [sort, setSort] = useState<SortKey>('name');

  const needle = query.trim().toLowerCase();

  const rows: TrailRow[] = trails.map((trail) => ({
    trail,
    distanceMeters: routeDistanceMeters(trail.route),
  }));

  const visible = rows
    .filter(({ trail }) => {
      if (region !== null && trail.region !== region) return false;
      if (difficulty !== null && trail.difficulty !== difficulty) return false;
      if (needle.length === 0) return true;
      return (
        trail.name.toLowerCase().includes(needle) ||
        trail.region.toLowerCase().includes(needle) ||
        trail.tags.some((tag) => tag.toLowerCase().includes(needle))
      );
    })
    .sort((a, b) => {
      if (sort === 'distance') return a.distanceMeters - b.distanceMeters;
      if (sort === 'rating') return b.trail.rating - a.trail.rating || b.trail.reviewCount - a.trail.reviewCount;
      return a.trail.name.localeCompare(b.trail.name);
    });

  const filtered = needle.length > 0 || region !== null || difficulty !== null;

  const clearFilters = () => {
    setQuery('');
    setRegion(null);
    setDifficulty(null);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search trails, regions, tags"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search trails"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip label="All regions" selected={region === null} onPress={() => setRegion(null)} />
          {regions.map((name) => (
            <Chip
              key={name}
              label={name}
              selected={region === name}
              onPress={() => setRegion(region === name ? null : name)}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip label="Any level" selected={difficulty === null} onPress={() => setDifficulty(null)} />
          {DIFFICULTIES.map((level) => (
            <Chip
              key={level}
              label={difficultyLabel(level)}
              selected={difficulty === level}
              onPress={() => setDifficulty(difficulty === level ? null : level)}
            />
          ))}
        </ScrollView>

        <View style={styles.sortRow}>
          <Text style={[styles.resultCount, { color: colors.textMuted }]}>
            {visible.length} {visible.length === 1 ? 'trail' : 'trails'}
          </Text>
          <View style={[styles.segment, { backgroundColor: colors.surfaceAlt }]}>
            {SORTS.map((option) => {
              const active = sort === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setSort(option.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Sort by ${option.label.toLowerCase()}`}
                  style={[styles.segmentItem, active && { backgroundColor: colors.surface }]}
                >
                  <Text
                    style={[styles.segmentLabel, { color: active ? colors.text : colors.textMuted }]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <FlashList
        data={visible}
        keyExtractor={(row) => row.trail.id}
        renderItem={({ item }) => (
          <TrailCard trail={item.trail} distanceMeters={item.distanceMeters} />
        )}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="trail-sign-outline" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No trails found</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              Nothing matches the current search and filters.
            </Text>
            {filtered ? (
              <Pressable
                onPress={clearFilters}
                accessibilityRole="button"
                style={[styles.emptyAction, { borderColor: colors.border }]}
              >
                <Text style={[styles.emptyActionLabel, { color: colors.primary }]}>
                  Clear filters
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.chipLabel, { color: selected ? colors.textInverse : colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingTop: spacing.md, gap: spacing.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: { fontSize: 13, fontWeight: '500' },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  resultCount: { fontSize: 13 },
  segment: { flexDirection: 'row', padding: 2, borderRadius: radius.pill },
  segmentItem: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  segmentLabel: { fontSize: 12, fontWeight: '600' },
  listContent: { padding: spacing.lg },
  separator: { height: spacing.md },
  empty: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: spacing.xl },
  emptyAction: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyActionLabel: { fontSize: 14, fontWeight: '600' },
});
