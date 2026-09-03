import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const CONTROL_TRANSITION = LinearTransition.duration(280).easing(Easing.out(Easing.cubic));
const SHEET_IN = SlideInDown.duration(300).easing(Easing.out(Easing.cubic));
const SHEET_OUT = SlideOutDown.duration(220).easing(Easing.in(Easing.cubic));
const MAX_CONTROL_FONT_SCALE = 1.5;

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

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
  const sortLabel = SORTS.find((option) => option.key === sort)?.label ?? 'Name';

  const clearFilters = () => {
    setQuery('');
    setRegion(null);
    setDifficulty(null);
  };

  const closeSearch = () => {
    if (query.length > 0) {
      setQuery('');
      return;
    }

    Keyboard.dismiss();
    setSearchOpen(false);
  };

  const openFilters = () => {
    Keyboard.dismiss();
    setFilterSheetOpen(true);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.controlRow}>
          {!searchOpen ? (
            <Animated.View
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(120)}
              layout={CONTROL_TRANSITION}
              style={styles.sortControlSlot}
            >
              <Pressable
                onPress={() => setSortSheetOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${sortLabel}`}
                accessibilityState={{ expanded: sortSheetOpen }}
                style={({ pressed }) => [styles.sortControl, pressed && styles.pressed]}
              >
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
                  style={[styles.sortControlLabel, { color: colors.textMuted }]}
                >
                  Sort By{' '}
                  <Text style={[styles.sortControlValue, { color: colors.text }]}>{sortLabel}</Text>
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </Pressable>
            </Animated.View>
          ) : null}

          <Animated.View
            layout={CONTROL_TRANSITION}
            style={[
              styles.searchShell,
              searchOpen ? styles.searchShellExpanded : styles.searchShellCollapsed,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {searchOpen ? (
              <Animated.View entering={FadeIn.delay(80).duration(180)} style={styles.searchContent}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search trails, regions, tags"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.searchInput, { color: colors.text }]}
                  autoFocus
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
                  accessibilityLabel="Search trails"
                />
                <Pressable
                  onPress={closeSearch}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={query.length > 0 ? 'Clear search' : 'Close search'}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              </Animated.View>
            ) : (
              <Pressable
                onPress={() => setSearchOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Open trail search"
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              >
                <Ionicons name="search" size={20} color={colors.text} />
              </Pressable>
            )}
          </Animated.View>

          {searchOpen ? (
            <Animated.View
              entering={FadeIn.delay(100).duration(180)}
              exiting={FadeOut.duration(120)}
              layout={CONTROL_TRANSITION}
              style={[styles.filterControlSlot, filterSheetOpen && styles.filterControlSlotExpanded]}
            >
              <Pressable
                onPress={openFilters}
                accessibilityRole="button"
                accessibilityLabel="Open trail filters"
                accessibilityState={{ expanded: filterSheetOpen }}
                style={({ pressed }) => [
                  styles.filterControl,
                  {
                    backgroundColor: filterSheetOpen ? colors.primaryMuted : colors.surface,
                    borderColor: filterSheetOpen ? colors.primary : colors.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="options-outline" size={20} color={colors.primary} />
                {filterSheetOpen ? (
                  <Animated.Text
                    entering={FadeIn.duration(160)}
                    maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
                    style={[styles.filterControlLabel, { color: colors.primary }]}
                  >
                    Filters
                  </Animated.Text>
                ) : null}
              </Pressable>
            </Animated.View>
          ) : null}
        </View>

        <Text
          maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
          style={[styles.resultCount, { color: colors.textMuted }]}
        >
          {visible.length} {visible.length === 1 ? 'trail' : 'trails'}
        </Text>
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
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>Nothing matches the current search and filters.</Text>
            {filtered ? (
              <Pressable
                onPress={clearFilters}
                accessibilityRole="button"
                accessibilityLabel="Clear search and filters"
                style={[styles.emptyAction, { borderColor: colors.border }]}
              >
                <Text style={[styles.emptyActionLabel, { color: colors.primary }]}>Clear filters</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      <BottomSheet visible={sortSheetOpen} title="Sort trails" onClose={() => setSortSheetOpen(false)}>
        <View style={styles.choiceList}>
          {SORTS.map((option) => {
            const selected = sort === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => {
                  setSort(option.key);
                  setSortSheetOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Sort by ${option.label.toLowerCase()}`}
                style={({ pressed }) => [
                  styles.choiceRow,
                  { backgroundColor: selected ? colors.primaryMuted : colors.surface },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
                  style={[styles.choiceLabel, { color: selected ? colors.primary : colors.text }]}
                >
                  {option.label}
                </Text>
                {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      <BottomSheet visible={filterSheetOpen} title="Filter trails" onClose={() => setFilterSheetOpen(false)}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.filterSheetContent}>
          <FilterSection title="Region">
            <Chip label="All regions" selected={region === null} onPress={() => setRegion(null)} />
            {regions.map((name) => (
              <Chip
                key={name}
                label={name}
                selected={region === name}
                onPress={() => setRegion(region === name ? null : name)}
              />
            ))}
          </FilterSection>

          <FilterSection title="Level">
            <Chip label="Any level" selected={difficulty === null} onPress={() => setDifficulty(null)} />
            {DIFFICULTIES.map((level) => (
              <Chip
                key={level}
                label={difficultyLabel(level)}
                selected={difficulty === level}
                onPress={() => setDifficulty(difficulty === level ? null : level)}
              />
            ))}
          </FilterSection>

          <View style={styles.filterActions}>
            <Pressable
              onPress={() => {
                setRegion(null);
                setDifficulty(null);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.clearButton,
                { borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Text
                maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
                style={[styles.clearButtonLabel, { color: colors.text }]}
              >
                Clear
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFilterSheetOpen(false)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.showButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
              ]}
            >
              <Text
                maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
                style={[styles.showButtonLabel, { color: colors.textInverse }]}
              >
                Show {visible.length} {visible.length === 1 ? 'trail' : 'trails'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function BottomSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(160)}
          style={StyleSheet.absoluteFill}
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={`Close ${title.toLowerCase()}`}
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
          />
        </Animated.View>
        <Animated.View
          entering={SHEET_IN}
          exiting={SHEET_OUT}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text
              maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
              style={[styles.sheetTitle, { color: colors.text }]}
            >
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={`Close ${title.toLowerCase()}`}
              style={({ pressed }) => [styles.sheetClose, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.filterSection}>
      <Text
        maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
        style={[styles.filterSectionTitle, { color: colors.text }]}
      >
        {title}
      </Text>
      <View style={styles.chipGrid}>{children}</View>
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
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surfaceAlt,
          borderColor: selected ? colors.primary : colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
        style={[styles.chipLabel, { color: selected ? colors.textInverse : colors.textMuted }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingTop: spacing.md, paddingBottom: spacing.xs, gap: spacing.sm },
  controlRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  sortControlSlot: { flex: 1, minWidth: 0 },
  sortControl: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  sortControlLabel: { flexShrink: 1, fontSize: 15, fontWeight: '500' },
  sortControlValue: { fontWeight: '800' },
  searchShell: {
    height: 44,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  searchShellCollapsed: { width: 44, flexBasis: 44, flexGrow: 0, flexShrink: 0 },
  searchShellExpanded: { width: 'auto', flexBasis: 0, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  searchContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 15, padding: 0 },
  iconButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filterControlSlot: { width: 44, height: 44 },
  filterControlSlotExpanded: { width: 90 },
  filterControl: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterControlLabel: { fontSize: 13, fontWeight: '700' },
  resultCount: { fontSize: 13, paddingHorizontal: spacing.lg },
  listContent: { padding: spacing.lg },
  separator: { height: spacing.md },
  empty: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: spacing.xl },
  emptyAction: {
    minHeight: 44,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyActionLabel: { fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.68 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    alignSelf: 'center',
    marginTop: spacing.sm,
    borderRadius: radius.pill,
  },
  sheetHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  sheetClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  choiceList: { gap: spacing.sm, paddingBottom: spacing.sm },
  choiceRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  choiceLabel: { fontSize: 16, fontWeight: '700' },
  filterSheetContent: { gap: spacing.xl, paddingBottom: spacing.sm },
  filterSection: { gap: spacing.sm },
  filterSectionTitle: { fontSize: 15, fontWeight: '800' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: { fontSize: 13, fontWeight: '600' },
  filterActions: { flexDirection: 'row', gap: spacing.sm },
  clearButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  clearButtonLabel: { fontSize: 15, fontWeight: '700' },
  showButton: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  showButtonLabel: { fontSize: 15, fontWeight: '800' },
});
