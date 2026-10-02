import { Ionicons } from "@expo/vector-icons";
import { MenuView } from "@expo/ui/community/menu";
import type { ReactNode, RefObject } from "react";
import { useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  Keyframe,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
  ZoomOut,
  type SharedValue,
} from "react-native-reanimated";

import { FilterSheet } from "@/src/components/FilterSheet";
import { AndroidSortMenu } from "@/src/components/AndroidSortMenu";
import { radius, spacing, useTheme } from "@/src/theme";

const CONTROL_TRANSITION = LinearTransition.duration(280).easing(
  Easing.out(Easing.cubic),
);
const SEARCH_CLEAR_IN = ZoomIn.duration(160)
  .easing(Easing.out(Easing.cubic))
  .withInitialValues({ transform: [{ scale: 0.6 }] });
const SEARCH_CLEAR_OUT = ZoomOut.duration(100).easing(Easing.in(Easing.cubic));
const SEARCH_BACK_IN = new Keyframe({
  0: {
    opacity: 0,
    transform: [{ rotate: "-90deg" }, { scale: 0.7 }],
  },
  100: {
    opacity: 1,
    transform: [{ rotate: "0deg" }, { scale: 1 }],
    easing: Easing.out(Easing.cubic),
  },
}).duration(220);
const SEARCH_BACK_OUT = new Keyframe({
  0: {
    opacity: 1,
    transform: [{ rotate: "0deg" }, { scale: 1 }],
  },
  100: {
    opacity: 0,
    transform: [{ rotate: "-90deg" }, { scale: 0.7 }],
    easing: Easing.in(Easing.cubic),
  },
}).duration(140);
const MAX_CONTROL_FONT_SCALE = 1.5;
export const SEARCH_FILTER_CONTROLS_HEIGHT = 48 + spacing.md;
const SortMenu = Platform.OS === "android" ? AndroidSortMenu : MenuView;

export interface SearchFilterControlsProps<Sort extends string> {
  query: string;
  onQueryChange: (query: string) => void;
  sort: Sort;
  onSortChange: (sort: Sort) => void;
  sortOptions: readonly { key: Sort; label: string }[];
  children: ReactNode;
  onClearFilters: () => void;
  applyFiltersLabel: string;
  filterTitle?: string;
  searchPlaceholder?: string;
  accessibilityLabels?: {
    searchInput?: string;
    openSearch?: string;
    openFilters?: string;
    sortHint?: string;
  };
  /** Optional scroll-driven translation; the parent owns its scroll handler. */
  translateY?: SharedValue<number>;
  interactive?: boolean;
  /** Background sampled by the Android frosted sort menu; unused on iOS. */
  blurTarget?: RefObject<View | null>;
}

/** Controlled values stay with the caller; transient menu and focus state stay here. */
export function SearchFilterControls<Sort extends string>({
  query,
  onQueryChange,
  sort,
  onSortChange,
  sortOptions,
  children,
  onClearFilters,
  applyFiltersLabel,
  filterTitle = "Filters",
  searchPlaceholder = "Search",
  accessibilityLabels = {},
  translateY,
  interactive = true,
  blurTarget,
}: SearchFilterControlsProps<Sort>) {
  const { colors } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const actionIconTransitioningRef = useRef(false);
  const actionIconProgress = useSharedValue(1);

  const sortLabel =
    sortOptions.find((option) => option.key === sort)?.label ?? sort;

  const handleSortAction = ({
    nativeEvent,
  }: {
    nativeEvent: { event: string };
  }) => {
    const nextSort = sortOptions.find(
      (option) => option.key === nativeEvent.event,
    )?.key;

    if (nextSort !== undefined) onSortChange(nextSort);
  };

  const releaseActionIconTransition = () => {
    actionIconTransitioningRef.current = false;
  };

  const completeActionIconSwap = (nextSearchOpen: boolean) => {
    setSearchOpen(nextSearchOpen);
    releaseActionIconTransition();

    requestAnimationFrame(() => {
      actionIconProgress.value = withTiming(1, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
    });
  };

  const transitionSearchState = (nextSearchOpen: boolean) => {
    if (searchOpen === nextSearchOpen || actionIconTransitioningRef.current) {
      return;
    }

    actionIconTransitioningRef.current = true;
    actionIconProgress.value = withTiming(
      0,
      {
        duration: 110,
        easing: Easing.in(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(completeActionIconSwap)(nextSearchOpen);
        } else {
          runOnJS(releaseActionIconTransition)();
        }
      },
    );
  };

  const clearSearch = () => {
    onQueryChange("");

    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  };

  const dismissSearchKeyboard = () => {
    searchInputRef.current?.blur();
    Keyboard.dismiss();
  };

  const closeSearch = () => {
    dismissSearchKeyboard();
    transitionSearchState(false);
  };

  const openFilters = () => {
    dismissSearchKeyboard();
    setFilterSheetOpen(true);
  };

  const closeFilters = () => {
    setFilterSheetOpen(false);

    requestAnimationFrame(() => {
      if (searchOpen) searchInputRef.current?.focus();
    });
  };

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY?.value ?? 0 }],
  }));

  const actionIconAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(actionIconProgress.value, [0, 1], [0, 1]),
    transform: [
      {
        scale: interpolate(actionIconProgress.value, [0, 1], [0.55, 1]),
      },
    ],
    filter: [
      {
        blur: interpolate(actionIconProgress.value, [0, 1], [5, 0]),
      },
    ],
  }));

  return (
    <>
      {searchOpen && searchFocused ? (
        <Pressable
          onPress={dismissSearchKeyboard}
          accessibilityRole="button"
          accessibilityLabel="Dismiss keyboard"
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 9 }}
        />
      ) : null}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          height: SEARCH_FILTER_CONTROLS_HEIGHT + 20,
          overflow: "hidden",
        }}
        pointerEvents={interactive ? "box-none" : "none"}
        accessibilityElementsHidden={!interactive}
        importantForAccessibility={
          interactive ? "auto" : "no-hide-descendants"
        }
      >
        <Animated.View style={[{ paddingTop: spacing.md }, controlsAnimatedStyle]}>
          <View
            style={[
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.sm,
                marginHorizontal: spacing.xxl,
                borderRadius: 100,
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 10,
                shadowOffset: { width: 3, height: 2 },
              },
              {
                backgroundColor: colors.surface,
                // borderColor: colors.primary,
                // borderWidth: 1,
              },
            ]}
          >
            {!searchOpen ? (
              <Animated.View
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(120)}
                layout={CONTROL_TRANSITION}
                style={{ flex: 1, minWidth: 0 }}
              >
                <SortMenu
                  {...(Platform.OS === "android" ? { blurTarget } : {})}
                  actions={sortOptions.map((option) => ({
                    id: option.key,
                    title: option.label,
                    state: sort === option.key ? "on" : "off",
                  }))}
                  onPressAction={handleSortAction}
                  style={{
                    alignSelf: "flex-start",
                    height: 44,
                    borderRadius: radius.pill,
                    overflow: "hidden",
                  }}
                >
                  <View
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={`Sort by ${sortLabel}`}
                    accessibilityHint={
                      accessibilityLabels.sortHint ?? "Shows sorting options"
                    }
                    style={{
                      height: 44,
                      minWidth: 148,
                      flexDirection: "row",
                      alignItems: "center",
                      alignSelf: "flex-start",
                      gap: spacing.xs,
                      borderRadius: radius.pill,
                      overflow: "hidden",
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
                      style={[
                        { fontSize: 15, fontWeight: "500" },
                        { color: colors.textMuted, paddingLeft: spacing.md },
                      ]}
                    >
                      Sort By{" "}
                      <Text
                        style={[
                          { fontWeight: "700" },
                          { color: colors.primary },
                        ]}
                      >
                        {sortLabel}
                      </Text>
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={18}
                      color={colors.textMuted}
                    />
                  </View>
                </SortMenu>
              </Animated.View>
            ) : null}
            {searchOpen ? (
              <Animated.View
                key="search-expanded"
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(120)}
                layout={CONTROL_TRANSITION}
                style={[{ height: 44, overflow: "hidden" }, { width: "auto", flexBasis: 0, flexGrow: 1, flexShrink: 1, minWidth: 0 }]}
              >
                <Animated.View
                  entering={FadeIn.delay(80).duration(180)}
                  style={[{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm }]}
                >
                  <Animated.View
                    entering={SEARCH_BACK_IN}
                    exiting={SEARCH_BACK_OUT}
                  >
                    <Pressable
                      onPress={closeSearch}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Back to sorting"
                      style={({ pressed }) => [
                        { width: 32, height: 44, alignItems: "center", justifyContent: "center" },
                        pressed && { opacity: 0.68 },
                      ]}
                    >
                      <View style={{ transform: [{ rotate: "90deg" }] }}>
                        <Ionicons
                          name="chevron-down"
                          size={20}
                          color={colors.textMuted}
                        />
                      </View>
                    </Pressable>
                  </Animated.View>
                  <TextInput
                    ref={searchInputRef}
                    value={query}
                    onChangeText={onQueryChange}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    onSubmitEditing={dismissSearchKeyboard}
                    submitBehavior="blurAndSubmit"
                    placeholder={searchPlaceholder}
                    placeholderTextColor={colors.textMuted}
                    style={[{ flex: 1, minWidth: 0, fontSize: 15, padding: 0 }, { color: colors.text }]}
                    autoFocus
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                    maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
                    accessibilityLabel={accessibilityLabels.searchInput ?? "Search"}
                  />
                  {query.length > 0 ? (
                    <Animated.View
                      entering={SEARCH_CLEAR_IN}
                      exiting={SEARCH_CLEAR_OUT}
                    >
                      <Pressable
                        onPress={clearSearch}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Clear search"
                        style={({ pressed }) => [
                          { minWidth: 32, minHeight: 44, alignItems: "center", justifyContent: "center" },
                          pressed && { opacity: 0.68 },
                        ]}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color={colors.textMuted}
                        />
                      </Pressable>
                    </Animated.View>
                  ) : null}
                </Animated.View>
              </Animated.View>
            ) : null}
            <View style={{ width: 44, height: 44 }}>
              <Pressable
                onPress={
                  searchOpen ? openFilters : () => transitionSearchState(true)
                }
                accessibilityRole="button"
                accessibilityLabel={
                  searchOpen
                    ? (accessibilityLabels.openFilters ?? "Open filters")
                    : (accessibilityLabels.openSearch ?? "Open search")
                }
                accessibilityState={
                  searchOpen ? { expanded: filterSheetOpen } : undefined
                }
                style={[
                  {
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: radius.pill,
                    borderWidth: StyleSheet.hairlineWidth,
                  },
                  { backgroundColor: colors.primary },
                ]}
              >
                <Animated.View
                  style={[{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    alignItems: "center",
                    justifyContent: "center",
                  }, actionIconAnimatedStyle]}
                >
                  <Ionicons
                    name={searchOpen ? "options-outline" : "search"}
                    size={20}
                    color={colors.surface}
                  />
                </Animated.View>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>

      {filterSheetOpen ? (
        <FilterSheet
          title={filterTitle}
          onClose={closeFilters}
          footer={
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={onClearFilters}
                accessibilityRole="button"
                style={({ pressed }) => [
                  {
                    minHeight: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: spacing.lg,
                    borderRadius: radius.pill,
                    borderWidth: StyleSheet.hairlineWidth,
                  },
                  { borderColor: colors.border },
                  pressed && { opacity: 0.68 },
                ]}
              >
                <Text
                  maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
                  style={[{ fontSize: 15, fontWeight: "700" }, { color: colors.text }]}
                >
                  Clear
                </Text>
              </Pressable>
              <Pressable
                onPress={closeFilters}
                accessibilityRole="button"
                style={({ pressed }) => [
                  {
                    minHeight: 48,
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: spacing.lg,
                    borderRadius: radius.pill,
                  },
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.68 },
                ]}
              >
                <Text
                  maxFontSizeMultiplier={MAX_CONTROL_FONT_SCALE}
                  style={[
                    { fontSize: 15, fontWeight: "800" },
                    { color: colors.textInverse },
                  ]}
                >
                  {applyFiltersLabel}
                </Text>
              </Pressable>
            </View>
          }
        >
          {children}
        </FilterSheet>
      ) : null}
    </>
  );
}
