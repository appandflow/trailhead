import { FlashList } from "@shopify/flash-list";
import { useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { EmptyState } from "@/src/components/EmptyState";
import { FilterChip, FilterSection } from "@/src/components/FilterSheet";
import {
  SEARCH_FILTER_CONTROLS_HEIGHT,
  SearchFilterControls,
} from "@/src/components/SearchFilterControls";
import { TrailCard, difficultyLabel } from "@/src/components/TrailCard";
import { regions, trails, type Difficulty, type Trail } from "@/src/data/trails";
import { useScrollVisibility } from "@/src/hooks/useScrollVisibility";
import { routeDistanceMeters } from "@/src/lib/geo";
import { spacing } from "@/src/theme";

const DIFFICULTIES: Difficulty[] = ["easy", "moderate", "hard", "expert"];

const SORTS = [
  { key: "name", label: "Name" },
  { key: "distance", label: "Distance" },
  { key: "rating", label: "Rating" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

interface TrailRow {
  trail: Trail;
  distanceMeters: number;
}

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList<TrailRow>);

export default function TrailsScreen() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [sort, setSort] = useState<SortKey>("name");
  const {
    onScroll: handleScroll,
    translateY: controlsTranslateY,
    interactive: controlsInteractive,
  } = useScrollVisibility({
    hiddenTranslateY: -(SEARCH_FILTER_CONTROLS_HEIGHT + spacing.sm),
  });

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
      if (sort === "distance") return a.distanceMeters - b.distanceMeters;
      if (sort === "rating")
        return (
          b.trail.rating - a.trail.rating ||
          b.trail.reviewCount - a.trail.reviewCount
        );
      return a.trail.name.localeCompare(b.trail.name);
    });

  const filtered = needle.length > 0 || region !== null || difficulty !== null;

  const clearFilters = () => {
    setRegion(null);
    setDifficulty(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <SearchFilterControls
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        sortOptions={SORTS}
        searchPlaceholder="Search trails, regions, tags"
        filterTitle="Filter trails"
        onClearFilters={clearFilters}
        applyFiltersLabel={`Show ${visible.length} ${visible.length === 1 ? "trail" : "trails"}`}
        accessibilityLabels={{
          searchInput: "Search trails",
          openSearch: "Open trail search",
          openFilters: "Open trail filters",
          sortHint: "Shows trail sorting options",
        }}
        translateY={controlsTranslateY}
        interactive={controlsInteractive}
      >
        <FilterSection title="Region">
          <FilterChip
            label="All regions"
            selected={region === null}
            onPress={() => setRegion(null)}
          />
          {regions.map((name) => (
            <FilterChip
              key={name}
              label={name}
              selected={region === name}
              onPress={() => setRegion(region === name ? null : name)}
            />
          ))}
        </FilterSection>

        <FilterSection title="Level">
          <FilterChip
            label="Any level"
            selected={difficulty === null}
            onPress={() => setDifficulty(null)}
          />
          {DIFFICULTIES.map((level) => (
            <FilterChip
              key={level}
              label={difficultyLabel(level)}
              selected={difficulty === level}
              onPress={() =>
                setDifficulty(difficulty === level ? null : level)
              }
            />
          ))}
        </FilterSection>
      </SearchFilterControls>

      <AnimatedFlashList
        data={visible}
        keyExtractor={(row) => row.trail.id}
        renderItem={({ item }) => (
          <TrailCard trail={item.trail} distanceMeters={item.distanceMeters} />
        )}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.lg,
          paddingTop: SEARCH_FILTER_CONTROLS_HEIGHT + spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <EmptyState
            icon="trail-sign-outline"
            title="No trails found"
            description="Nothing matches the current search and filters."
            action={
              filtered
                ? {
                    label: "Clear filters",
                    accessibilityLabel: "Clear search and filters",
                    onPress: clearFilters,
                  }
                : undefined
            }
          />
        }
      />
    </View>
  );
}
