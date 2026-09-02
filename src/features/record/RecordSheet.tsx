import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { formatDistance, formatDuration, formatElevation, formatPace } from '@/src/lib/format';
import type { RecordingStatus } from '@/src/store/recordingStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { radius, spacing, useTheme } from '@/src/theme';

const COLLAPSED_HEIGHT = 240;
const EXPANDED_HEIGHT = 420;
const SNAP_MIDPOINT = (COLLAPSED_HEIGHT + EXPANDED_HEIGHT) / 2;
const FLING_VELOCITY = 400;
const SPRING = { damping: 20, stiffness: 220, mass: 0.6 };

const PRIMARY_LABEL: Record<RecordingStatus, string> = {
  idle: 'Start hike',
  recording: 'Pause',
  paused: 'Resume',
};

const STATUS_LABEL: Record<RecordingStatus, string> = {
  idle: 'Ready',
  recording: 'Recording',
  paused: 'Paused',
};

interface RecordSheetProps {
  status: RecordingStatus;
  elapsedSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
  notes: string;
  saving: boolean;
  onChangeNotes: (notes: string) => void;
  onPrimaryPress: () => void;
  onFinishPress: () => void;
}

export function RecordSheet({
  status,
  elapsedSeconds,
  distanceMeters,
  elevationGainMeters,
  notes,
  saving,
  onChangeNotes,
  onPrimaryPress,
  onFinishPress,
}: RecordSheetProps) {
  const { colors } = useTheme();
  const units = useSettingsStore((state) => state.units);
  const [expanded, setExpanded] = useState(false);

  const height = useSharedValue(COLLAPSED_HEIGHT);
  const startHeight = useSharedValue(COLLAPSED_HEIGHT);

  const syncExpanded = useCallback((next: boolean) => setExpanded(next), []);

  const pan = Gesture.Pan()
    .onStart(() => {
      startHeight.value = height.value;
    })
    .onUpdate((event) => {
      const next = startHeight.value - event.translationY;
      height.value = Math.min(EXPANDED_HEIGHT, Math.max(COLLAPSED_HEIGHT, next));
    })
    .onEnd((event) => {
      let shouldExpand = height.value > SNAP_MIDPOINT;
      if (event.velocityY < -FLING_VELOCITY) shouldExpand = true;
      else if (event.velocityY > FLING_VELOCITY) shouldExpand = false;
      height.value = withSpring(shouldExpand ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT, SPRING);
      runOnJS(syncExpanded)(shouldExpand);
    });

  const toggle = Gesture.Tap().onEnd(() => {
    const shouldExpand = height.value < SNAP_MIDPOINT;
    height.value = withSpring(shouldExpand ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT, SPRING);
    runOnJS(syncExpanded)(shouldExpand);
  });

  const sheetStyle = useAnimatedStyle(() => ({ height: height.value }));

  const isRunning = status !== 'idle';
  const primaryIcon = status === 'recording' ? 'pause' : 'play';

  return (
    <Animated.View
      style={[
        styles.sheet,
        sheetStyle,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <GestureDetector gesture={Gesture.Exclusive(pan, toggle)}>
        <View
          style={styles.grabArea}
          accessibilityRole="adjustable"
          accessibilityLabel={expanded ? 'Collapse hike stats' : 'Expand hike stats'}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: status === 'recording' ? colors.danger : colors.textMuted },
              ]}
            />
            <Text style={[styles.statusText, { color: colors.textMuted }]}>
              {STATUS_LABEL[status]}
            </Text>
          </View>

          <View style={styles.statGrid}>
            <Stat label="Duration" value={formatDuration(elapsedSeconds)} />
            <Stat label="Distance" value={formatDistance(distanceMeters, units)} />
            <Stat label="Elevation gain" value={formatElevation(elevationGainMeters, units)} />
            <Stat label="Pace" value={formatPace(elapsedSeconds, distanceMeters, units)} />
          </View>
        </View>
      </GestureDetector>

      <View style={styles.content}>
        {expanded ? (
          <View style={styles.notes}>
            <Text style={[styles.notesLabel, { color: colors.textMuted }]}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={onChangeNotes}
              multiline
              placeholder="Trail conditions, wildlife, who you hiked with…"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Hike notes"
              style={[
                styles.notesInput,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={onPrimaryPress}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={PRIMARY_LABEL[status]}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary, opacity: pressed || saving ? 0.7 : 1 },
            ]}
          >
            <Ionicons name={primaryIcon} size={18} color={colors.textInverse} />
            <Text style={[styles.primaryLabel, { color: colors.textInverse }]}>
              {PRIMARY_LABEL[status]}
            </Text>
          </Pressable>

          {isRunning ? (
            <Pressable
              onPress={onFinishPress}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Finish and save hike"
              style={({ pressed }) => [
                styles.finishButton,
                { borderColor: colors.border, opacity: pressed || saving ? 0.7 : 1 },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <>
                  <Ionicons name="stop" size={18} color={colors.danger} />
                  <Text style={[styles.finishLabel, { color: colors.danger }]}>Finish</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat} accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  grabArea: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  stat: {
    width: '50%',
    paddingVertical: spacing.xs,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  notes: {
    flex: 1,
    marginBottom: spacing.md,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  notesInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.pill,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minWidth: 52,
    height: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  finishLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
