import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { addDays, format, getDay, startOfYear } from "date-fns";

import type { Hike } from "@/src/db/schema";
import { formatDistance, formatDuration } from "@/src/lib/format";
import { useSettingsStore } from "@/src/store/settingsStore";
import { radius, spacing, useTheme } from "@/src/theme";

const CELL = 10;
const GAP = 3;
const LEVELS = 4;

interface Day {
  key: string;
  date: Date;
  meters: number;
  hikes: Hike[];
}

function buildYear(list: Hike[], now: Date): Day[][] {
  const start = startOfYear(now);
  const byDay = new Map<string, Hike[]>();
  for (const hike of list) {
    const key = format(new Date(hike.startedAt), "yyyy-MM-dd");
    const bucket = byDay.get(key);
    if (bucket) bucket.push(hike);
    else byDay.set(key, [hike]);
  }

  const weeks: Day[][] = [];
  let week: Day[] = [];
  const lead = getDay(start);
  for (let i = 0; i < lead; i++) week.push(null as unknown as Day);
  for (
    let d = start;
    d.getFullYear() === now.getFullYear();
    d = addDays(d, 1)
  ) {
    const key = format(d, "yyyy-MM-dd");
    const hikes = byDay.get(key) ?? [];
    week.push({
      key,
      date: d,
      hikes,
      meters: hikes.reduce((s, h) => s + h.distanceMeters, 0),
    });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) weeks.push(week);
  return weeks;
}

export function YearHeatmap({ hikes }: { hikes: Hike[] }) {
  const { colors, name } = useTheme();
  const units = useSettingsStore((s) => s.units);
  const now = useMemo(() => new Date(), []);
  const weeks = useMemo(() => buildYear(hikes, now), [hikes, now]);
  const [selected, setSelected] = useState<string | null>(null);

  const peak = Math.max(
    ...weeks
      .flat()
      .filter(Boolean)
      .map((day) => day.meters),
    1,
  );
  const ramp = name === "dark" ? DARK_RAMP : LIGHT_RAMP;
  const levelColor = (meters: number) => {
    if (meters <= 0) return colors.surfaceAlt;
    return ramp[Math.min(LEVELS - 1, Math.floor((meters / peak) * LEVELS))];
  };

  const selectedDay = weeks.flat().find((day) => day && day.key === selected);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        {now.getFullYear()} activity
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        ref={(ref) => ref?.scrollToEnd({ animated: false })}
      >
        <View style={styles.grid}>
          {weeks.map((week, w) => (
            <View key={w} style={styles.week}>
              {week.map((day, d) =>
                day ? (
                  <Pressable
                    key={day.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${format(day.date, "MMM d")}, ${day.hikes.length} hikes, ${formatDistance(day.meters, units)}`}
                    onPress={() => setSelected(day.key)}
                    style={[
                      styles.cell,
                      { backgroundColor: levelColor(day.meters) },
                      day.key === selected && {
                        borderColor: colors.text,
                        borderWidth: 1.5,
                      },
                    ]}
                  />
                ) : (
                  <View key={`pad-${d}`} style={styles.cell} />
                ),
              )}
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: colors.textMuted }]}>
          Less
        </Text>
        <View
          style={[styles.legendCell, { backgroundColor: colors.surfaceAlt }]}
        />
        {ramp.map((color) => (
          <View
            key={color}
            style={[styles.legendCell, { backgroundColor: color }]}
          />
        ))}
        <Text style={[styles.legendText, { color: colors.textMuted }]}>
          More
        </Text>
      </View>
      {selectedDay ? (
        <View style={styles.dayList}>
          <Text style={[styles.dayTitle, { color: colors.text }]}>
            {format(selectedDay.date, "EEEE, MMM d")}
          </Text>
          {selectedDay.hikes.length === 0 ? (
            <Text style={[styles.legendText, { color: colors.textMuted }]}>
              No hikes
            </Text>
          ) : (
            selectedDay.hikes.map((hike) => (
              <Pressable
                key={hike.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${hike.title}`}
                onPress={() => router.push(`/hike/${hike.id}`)}
                style={[styles.dayHike, { backgroundColor: colors.surfaceAlt }]}
              >
                <Text
                  style={[styles.dayHikeTitle, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {hike.title}
                </Text>
                <Text style={[styles.legendText, { color: colors.textMuted }]}>
                  {formatDistance(hike.distanceMeters, units)} ·{" "}
                  {formatDuration(hike.durationSeconds)}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const LIGHT_RAMP = ["#C5DDCE", "#8FBFA3", "#4F8F6E", "#2F6B4F"];
const DARK_RAMP = ["#2C4739", "#3F6B53", "#5C9C77", "#7FC59B"];

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { fontSize: 15, fontWeight: "700" },
  grid: { flexDirection: "row", gap: GAP },
  week: { gap: GAP },
  cell: { width: CELL, height: CELL, borderRadius: 2 },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAP,
    alignSelf: "flex-end",
  },
  legendCell: { width: CELL, height: CELL, borderRadius: 2 },
  legendText: { fontSize: 12 },
  dayList: { gap: spacing.sm },
  dayTitle: { fontSize: 14, fontWeight: "600" },
  dayHike: { padding: spacing.md, borderRadius: radius.md, gap: spacing.xs },
  dayHikeTitle: { fontSize: 15, fontWeight: "600" },
});
