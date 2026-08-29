import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Canvas, Line, Path, Skia, vec, type SkPath } from '@shopify/react-native-skia';

import { formatElevation } from '@/src/lib/format';
import { useSettingsStore } from '@/src/store/settingsStore';
import { spacing, useTheme } from '@/src/theme';

export interface ElevationPoint {
  distanceKm: number;
  elevation: number;
}

interface ElevationChartProps {
  points: ElevationPoint[];
  width: number;
  height: number;
}

interface ChartModel {
  line: SkPath;
  area: SkPath;
  gridYs: number[];
  minElevation: number;
  maxElevation: number;
}

const GRID_LINE_COUNT = 4;
const VERTICAL_INSET = spacing.lg;

export function ElevationChart({ points, width, height }: ElevationChartProps) {
  const { colors } = useTheme();
  const units = useSettingsStore((s) => s.units);
  const model = useMemo(() => buildModel(points, width, height), [points, width, height]);

  if (!model) {
    return (
      <View style={[styles.placeholder, { width, height, borderColor: colors.border }]}>
        <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
          No elevation recorded
        </Text>
      </View>
    );
  }

  const min = formatElevation(model.minElevation, units);
  const max = formatElevation(model.maxElevation, units);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Elevation profile, from ${min} to ${max}`}
      style={{ width, height }}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {model.gridYs.map((y) => (
          <Line
            key={y}
            p1={vec(0, y)}
            p2={vec(width, y)}
            color={colors.chartGrid}
            strokeWidth={1}
          />
        ))}
        <Path path={model.area} style="fill" color={colors.chartFill} opacity={0.65} />
        <Path
          path={model.line}
          style="stroke"
          color={colors.chartLine}
          strokeWidth={2}
          strokeJoin="round"
          strokeCap="round"
        />
      </Canvas>
      <Text style={[styles.label, styles.maxLabel, { color: colors.textMuted }]}>{max}</Text>
      <Text style={[styles.label, styles.minLabel, { color: colors.textMuted }]}>{min}</Text>
    </View>
  );
}

function buildModel(
  points: ElevationPoint[],
  width: number,
  height: number,
): ChartModel | null {
  if (points.length < 2 || width <= 0 || height <= 0) return null;

  const top = VERTICAL_INSET;
  const bottom = height - VERTICAL_INSET;
  if (bottom <= top) return null;

  let minElevation = Infinity;
  let maxElevation = -Infinity;
  for (const point of points) {
    minElevation = Math.min(minElevation, point.elevation);
    maxElevation = Math.max(maxElevation, point.elevation);
  }

  const startKm = points[0].distanceKm;
  const endKm = points[points.length - 1].distanceKm;
  // Guard flat or zero-length profiles so the scales never divide by zero.
  const spanKm = Math.max(endKm - startKm, 0.001);
  const spanElevation = Math.max(maxElevation - minElevation, 1);

  const xFor = (distanceKm: number) => ((distanceKm - startKm) / spanKm) * width;
  const yFor = (elevation: number) =>
    bottom - ((elevation - minElevation) / spanElevation) * (bottom - top);

  const line = Skia.Path.Make();
  line.moveTo(xFor(points[0].distanceKm), yFor(points[0].elevation));
  for (let i = 1; i < points.length; i++) {
    line.lineTo(xFor(points[i].distanceKm), yFor(points[i].elevation));
  }

  const area = line.copy();
  area.lineTo(xFor(endKm), height);
  area.lineTo(xFor(startKm), height);
  area.close();

  const gridYs: number[] = [];
  for (let i = 0; i < GRID_LINE_COUNT; i++) {
    gridYs.push(top + ((bottom - top) / (GRID_LINE_COUNT - 1)) * i);
  }

  return { line, area, gridYs, minElevation, maxElevation };
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: spacing.sm,
  },
  placeholderText: { fontSize: 13 },
  label: { position: 'absolute', left: 0, fontSize: 11, fontWeight: '600' },
  maxLabel: { top: 0 },
  minLabel: { bottom: 0 },
});
