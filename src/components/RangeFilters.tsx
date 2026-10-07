import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { formatDistance, formatElevation, type DistanceUnit } from "@/src/lib/format";
import { radius, spacing, useTheme } from "@/src/theme";

export interface RangeValue {
  min: string;
  max: string;
}

const KM_PER_MILE = 1.609344;
const M_PER_FOOT = 0.3048;

export const EMPTY_RANGE: RangeValue = { min: "", max: "" };

export function distanceInputToMeters(text: string, unit: DistanceUnit): number | null {
  const value = parseFloat(text);
  if (Number.isNaN(value)) return null;
  return value * 1000 * (unit === "imperial" ? KM_PER_MILE : 1);
}

export function ascentInputToMeters(text: string, unit: DistanceUnit): number | null {
  const value = parseFloat(text);
  if (Number.isNaN(value)) return null;
  return value * (unit === "imperial" ? M_PER_FOOT : 1);
}

export function inRange(value: number, min: number | null, max: number | null): boolean {
  return (min === null || value >= min) && (max === null || value <= max);
}

const unitSuffix = (formatted: string) => formatted.split(" ")[1];

interface RangeFiltersProps {
  units: DistanceUnit;
  distance: RangeValue;
  ascent: RangeValue;
  onDistanceChange: (value: RangeValue) => void;
  onAscentChange: (value: RangeValue) => void;
  bounds: { distanceM: [number, number]; ascentM: [number, number] };
  count: number;
  canReset: boolean;
  onReset: () => void;
}

export function RangeFilters({
  units,
  distance,
  ascent,
  onDistanceChange,
  onAscentChange,
  bounds,
  count,
  canReset,
  onReset,
}: RangeFiltersProps) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textMuted }}>
          More filters
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Text
            accessibilityLabel="Result count"
            style={{ fontSize: 13, fontWeight: "600", color: colors.text }}
          >
            {`${count} ${count === 1 ? "trail" : "trails"}`}
          </Text>
          {canReset ? (
            <Pressable
              onPress={onReset}
              accessibilityRole="button"
              accessibilityLabel="Reset all filters"
              hitSlop={8}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>
                Reset
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <RangeRow
        label="Distance"
        unit={unitSuffix(formatDistance(0, units))}
        value={distance}
        onChange={onDistanceChange}
        minPlaceholder={formatDistance(bounds.distanceM[0], units)}
        maxPlaceholder={formatDistance(bounds.distanceM[1], units)}
      />
      <RangeRow
        label="Ascent"
        unit={unitSuffix(formatElevation(0, units))}
        value={ascent}
        onChange={onAscentChange}
        minPlaceholder={formatElevation(bounds.ascentM[0], units)}
        maxPlaceholder={formatElevation(bounds.ascentM[1], units)}
      />
    </View>
  );
}

interface RangeRowProps {
  label: string;
  unit: string;
  value: RangeValue;
  onChange: (value: RangeValue) => void;
  minPlaceholder: string;
  maxPlaceholder: string;
}

function RangeRow({ label, unit, value, onChange, minPlaceholder, maxPlaceholder }: RangeRowProps) {
  const { colors } = useTheme();
  const inputStyle = {
    flex: 1,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
  } as const;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <Text style={{ width: 64, fontSize: 14, color: colors.text }}>{label}</Text>
      <TextInput
        value={value.min}
        onChangeText={(min) => onChange({ ...value, min })}
        placeholder={minPlaceholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        accessibilityLabel={`${label} minimum ${unit}`}
        style={inputStyle}
      />
      <Text style={{ color: colors.textMuted }}>to</Text>
      <TextInput
        value={value.max}
        onChangeText={(max) => onChange({ ...value, max })}
        placeholder={maxPlaceholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        accessibilityLabel={`${label} maximum ${unit}`}
        style={inputStyle}
      />
      <Text style={{ width: 24, color: colors.textMuted, fontSize: 13 }}>{unit}</Text>
    </View>
  );
}
