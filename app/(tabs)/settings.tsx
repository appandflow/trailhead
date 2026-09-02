import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';

import { resetDatabase } from '@/src/db/client';
import { seedHikesIfEmpty } from '@/src/db/seed';
import { hikeKeys, useHikeCount } from '@/src/features/history/useHikes';
import type { DistanceUnit } from '@/src/lib/format';
import { useSettingsStore } from '@/src/store/settingsStore';
import { radius, spacing, useTheme } from '@/src/theme';

const UNIT_OPTIONS: { value: DistanceUnit; label: string }[] = [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const buildVersion =
    Constants.platform?.ios?.buildNumber ?? Constants.platform?.android?.versionCode;
  const { units, hikeReminders, offlineMaps, setUnits, setHikeReminders, setOfflineMaps } =
    useSettingsStore();
  const { data: count, isPending: countPending } = useHikeCount();

  const reset = useMutation({
    mutationFn: async () => {
      resetDatabase();
      seedHikesIfEmpty();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hikeKeys.all }),
    onError: () =>
      Alert.alert('Reset failed', 'The sample data could not be rebuilt. Please try again.'),
  });

  const confirmReset = () => {
    Alert.alert(
      'Reset sample data',
      'This deletes every recorded hike on this device and restores the sample history.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => reset.mutate() },
      ],
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Section title="Units">
        <View style={styles.rowInner}>
          <RowLabel icon="resize-outline" title="Distance" subtitle="Used across the whole app" />
          <View style={[styles.segmented, { backgroundColor: colors.surfaceAlt }]}>
            {UNIT_OPTIONS.map((option) => {
              const selected = units === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${option.label} units`}
                  onPress={() => setUnits(option.value)}
                  style={[
                    styles.segment,
                    selected && { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentLabel,
                      { color: selected ? colors.text : colors.textMuted },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Section>

      <Section title="Preferences">
        <View style={styles.rowInner}>
          <RowLabel
            icon="notifications-outline"
            title="Hike reminders"
            subtitle="Nudge me when I have not hiked in a while"
          />
          <Switch
            value={hikeReminders}
            onValueChange={setHikeReminders}
            accessibilityLabel="Hike reminders"
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
        <Divider />
        <View style={styles.rowInner}>
          <RowLabel
            icon="cloud-offline-outline"
            title="Offline maps"
            subtitle="Keep map tiles for saved trails on device"
          />
          <Switch
            value={offlineMaps}
            onValueChange={setOfflineMaps}
            accessibilityLabel="Offline maps"
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>
      </Section>

      <Section title="Storage">
        <View style={styles.rowInner}>
          <RowLabel icon="server-outline" title="Recorded hikes" subtitle="Stored in a local database" />
          {countPending ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.value, { color: colors.textMuted }]}>{count ?? 0}</Text>
          )}
        </View>
        <Divider />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset sample data"
          accessibilityState={{ disabled: reset.isPending }}
          disabled={reset.isPending}
          onPress={confirmReset}
          style={({ pressed }) => [styles.rowInner, pressed && { opacity: 0.6 }]}
        >
          <RowLabel
            icon="refresh-outline"
            title="Reset sample data"
            subtitle="Erase your hikes and restore the sample history"
            danger
          />
          {reset.isPending ? <ActivityIndicator color={colors.danger} /> : null}
        </Pressable>
      </Section>

      <Section title="About">
        <View style={styles.rowInner}>
          <RowLabel icon="information-circle-outline" title="Version" />
          <Text style={[styles.value, { color: colors.textMuted }]}>
            {buildVersion == null ? version : `${version} (${buildVersion})`}
          </Text>
        </View>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title.toUpperCase()}</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function RowLabel({
  icon,
  title,
  subtitle,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  const tint = danger ? colors.danger : colors.text;
  return (
    <View style={styles.label}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textMuted} />
      <View style={styles.labelText}>
        <Text style={[styles.title, { color: tint }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginLeft: spacing.xs },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
  },
  label: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  labelText: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 13 },
  value: { fontSize: 16, fontVariant: ['tabular-nums'] },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg + 20 + spacing.md },
  segmented: { flexDirection: 'row', borderRadius: radius.pill, padding: 2 },
  segment: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  segmentLabel: { fontSize: 14, fontWeight: '600' },
});
