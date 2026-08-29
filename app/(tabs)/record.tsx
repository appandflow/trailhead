import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { format } from 'date-fns';

import { db } from '@/src/db/client';
import { hikePoints, hikes } from '@/src/db/schema';
import { RecordSheet } from '@/src/features/record/RecordSheet';
import {
  getLocationPermissions,
  requestLocationPermissions,
  startBackgroundLocation,
  stopBackgroundLocation,
  toGeoPoint,
  TRACKING_OPTIONS,
  type LocationPermissionResult,
} from '@/src/features/record/locationTask';
import { boundingRegion, elevationGainMeters, routeDistanceMeters } from '@/src/lib/geo';
import { useRecordingStore } from '@/src/store/recordingStore';
import { radius, spacing, useTheme } from '@/src/theme';

const DEFAULT_REGION = boundingRegion([]);
const FOCUSED_DELTA = 0.01;
const POINT_INSERT_CHUNK = 400;

export default function RecordScreen() {
  const { colors, name } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const status = useRecordingStore((state) => state.status);
  const navigation = useNavigation();
  const points = useRecordingStore((state) => state.points);
  const elapsedSeconds = useRecordingStore((state) => state.elapsedSeconds);
  const distanceMeters = useRecordingStore((state) => state.getDistanceMeters());
  const gainMeters = useRecordingStore((state) => state.getElevationGainMeters());
  const start = useRecordingStore((state) => state.start);
  const pause = useRecordingStore((state) => state.pause);
  const resume = useRecordingStore((state) => state.resume);
  const appendPoint = useRecordingStore((state) => state.appendPoint);
  const tick = useRecordingStore((state) => state.tick);
  const reset = useRecordingStore((state) => state.reset);

  const [permission, setPermission] = useState<LocationPermissionResult | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [startRegion, setStartRegion] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const hasForeground = permission?.foreground === true;
  const usesBackgroundTask = permission?.background === true;
  const blocked = permission != null && !permission.foreground && !permission.canAskAgain;

  const refreshPermissions = useCallback(async () => {
    const result = await getLocationPermissions();
    setPermission(result);
    return result;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await getLocationPermissions();
        if (!active) return;
        setPermission(result);
        if (!result.foreground) return;
        const last = await Location.getLastKnownPositionAsync();
        if (!active || !last) return;
        setStartRegion({ latitude: last.coords.latitude, longitude: last.coords.longitude });
      } catch (error) {
        console.warn('Could not read location permissions', error);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !startRegion) return;
    mapRef.current?.animateToRegion(
      {
        latitude: startRegion.latitude,
        longitude: startRegion.longitude,
        latitudeDelta: FOCUSED_DELTA,
        longitudeDelta: FOCUSED_DELTA,
      },
      600,
    );
  }, [mapReady, startRegion]);

  useEffect(() => {
    if (status !== 'recording') return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status, tick]);

  // Background updates are toggled by status rather than by the action handlers so
  // that a pause really stops the GPS instead of just dropping the fixes.
  // Recording is a focused mode: the tab bar gets out of the way so the map and
  // the live stats own the screen, and comes back when the hike is saved.
  useEffect(() => {
    navigation.setOptions({ tabBarStyle: status === 'idle' ? undefined : { display: 'none' } });
    return () => navigation.setOptions({ tabBarStyle: undefined });
  }, [navigation, status]);

  useEffect(() => {
    if (!usesBackgroundTask) return;
    if (status === 'recording') startBackgroundLocation();
    else stopBackgroundLocation();
  }, [status, usesBackgroundTask]);

  useEffect(() => {
    if (status !== 'recording' || !hasForeground || usesBackgroundTask) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    Location.watchPositionAsync(TRACKING_OPTIONS, (location) => appendPoint(toGeoPoint(location)))
      .then((next) => {
        if (cancelled) next.remove();
        else subscription = next;
      })
      .catch((error) => console.warn('Could not watch position', error));
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [appendPoint, hasForeground, status, usesBackgroundTask]);

  const latest = points.length > 0 ? points[points.length - 1] : null;
  useEffect(() => {
    if (!latest || status !== 'recording') return;
    mapRef.current?.animateCamera(
      { center: { latitude: latest.latitude, longitude: latest.longitude } },
      { duration: 500 },
    );
  }, [latest, status]);

  const handlePrimaryPress = useCallback(async () => {
    if (status === 'recording') {
      pause();
      return;
    }
    if (status === 'paused') {
      resume();
      return;
    }

    const result = await requestLocationPermissions();
    setPermission(result);
    if (!result.foreground) {
      Alert.alert(
        'Location access needed',
        'Trailhead draws your route from your device location. Allow location access to record a hike.',
      );
      return;
    }
    start();
  }, [pause, resume, start, status]);

  const discard = useCallback(() => {
    reset();
    setNotes('');
  }, [reset]);

  const handleFinishPress = useCallback(async () => {
    const { points: recorded, startedAt, elapsedSeconds: duration } = useRecordingStore.getState();
    if (startedAt == null || recorded.length < 2) {
      Alert.alert('Not enough data', 'This hike has no route recorded yet.', [
        { text: 'Keep recording', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: discard },
      ]);
      return;
    }

    setSaving(true);
    try {
      const id = Crypto.randomUUID();
      const trimmedNotes = notes.trim();
      db.transaction((tx) => {
        tx.insert(hikes)
          .values({
            id,
            trailId: null,
            title: hikeTitle(new Date(startedAt)),
            startedAt,
            durationSeconds: duration,
            distanceMeters: routeDistanceMeters(recorded),
            elevationGainMeters: elevationGainMeters(recorded),
            notes: trimmedNotes.length > 0 ? trimmedNotes : null,
          })
          .run();
        for (let i = 0; i < recorded.length; i += POINT_INSERT_CHUNK) {
          tx.insert(hikePoints)
            .values(
              recorded.slice(i, i + POINT_INSERT_CHUNK).map((point) => ({
                hikeId: id,
                latitude: point.latitude,
                longitude: point.longitude,
                elevation: point.elevation ?? null,
                timestamp: point.timestamp ?? Date.now(),
              })),
            )
            .run();
        }
      });
      discard();
      router.push({ pathname: '/hike/[id]', params: { id } });
    } catch (error) {
      console.warn('Could not save hike', error);
      Alert.alert('Could not save hike', 'Something went wrong writing this hike to your device.');
    } finally {
      setSaving(false);
    }
  }, [discard, notes, router]);

  if (blocked) {
    return (
      <View style={[styles.blocked, { backgroundColor: colors.background }]}>
        <View style={[styles.blockedIcon, { backgroundColor: colors.primaryMuted }]}>
          <Ionicons name="location-outline" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.blockedTitle, { color: colors.text }]}>Location is turned off</Text>
        <Text style={[styles.blockedBody, { color: colors.textMuted }]}>
          Trailhead needs location access to trace your route while you hike. Turn it on in your
          device settings, then come back to start recording.
        </Text>
        <Pressable
          onPress={() => Linking.openSettings()}
          accessibilityRole="button"
          accessibilityLabel="Open device settings"
          style={({ pressed }) => [
            styles.blockedButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.blockedButtonLabel, { color: colors.textInverse }]}>
            Open settings
          </Text>
        </Pressable>
        <Pressable
          onPress={refreshPermissions}
          accessibilityRole="button"
          accessibilityLabel="Check location permission again"
          style={styles.blockedLink}
        >
          <Text style={[styles.blockedLinkLabel, { color: colors.primary }]}>Check again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        onMapReady={() => setMapReady(true)}
        showsUserLocation={hasForeground}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        userInterfaceStyle={name}
        mapPadding={{ top: 0, right: 0, bottom: insets.bottom, left: 0 }}
      >
        {points.length > 1 ? (
          <Polyline
            coordinates={points.map((point) => ({
              latitude: point.latitude,
              longitude: point.longitude,
            }))}
            strokeColor={colors.mapRoute}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}
      </MapView>

      {status !== 'idle' && !usesBackgroundTask ? (
        <View
          style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.bannerText, { color: colors.textMuted }]}>
            Keep Trailhead open — background tracking is off.
          </Text>
        </View>
      ) : null}

      <RecordSheet
        status={status}
        elapsedSeconds={elapsedSeconds}
        distanceMeters={distanceMeters}
        elevationGainMeters={gainMeters}
        notes={notes}
        saving={saving}
        onChangeNotes={setNotes}
        onPrimaryPress={handlePrimaryPress}
        onFinishPress={handleFinishPress}
      />
    </View>
  );
}

function hikeTitle(startedAt: Date): string {
  const hour = startedAt.getHours();
  const period = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  return `${period} hike · ${format(startedAt, 'MMM d')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerText: { flex: 1, fontSize: 13 },
  blocked: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  blockedIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: spacing.lg,
  },
  blockedBody: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  blockedButton: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    marginTop: spacing.xl,
  },
  blockedButtonLabel: { fontSize: 16, fontWeight: '700' },
  blockedLink: { marginTop: spacing.md, padding: spacing.sm },
  blockedLinkLabel: { fontSize: 15, fontWeight: '600' },
});
