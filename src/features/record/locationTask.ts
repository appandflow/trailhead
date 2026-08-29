import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import type { GeoPoint } from '@/src/lib/geo';
import { useRecordingStore } from '@/src/store/recordingStore';

export const LOCATION_TASK_NAME = 'trailhead-hike-location';

/** Shared by the background task and by the foreground-only fallback watcher. */
export const TRACKING_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  distanceInterval: 5,
  timeInterval: 4000,
};

export interface LocationPermissionResult {
  foreground: boolean;
  background: boolean;
  /** False once the OS stops showing the prompt, so the UI must send the user to Settings. */
  canAskAgain: boolean;
}

interface LocationTaskData {
  locations: Location.LocationObject[];
}

export function toGeoPoint(location: Location.LocationObject): GeoPoint {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    elevation: location.coords.altitude ?? undefined,
    timestamp: location.timestamp,
  };
}

TaskManager.defineTask<LocationTaskData>(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn(`[${LOCATION_TASK_NAME}] ${error.message}`);
    return;
  }
  if (!data?.locations?.length) return;

  const { appendPoint } = useRecordingStore.getState();
  for (const location of data.locations) {
    appendPoint(toGeoPoint(location));
  }
});

export async function requestLocationPermissions(): Promise<LocationPermissionResult> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    return { foreground: false, background: false, canAskAgain: foreground.canAskAgain };
  }

  // The OS only offers background access after foreground access is granted, and
  // refusing it is not fatal: recording still works while the app is open.
  try {
    const background = await Location.requestBackgroundPermissionsAsync();
    return { foreground: true, background: background.granted, canAskAgain: true };
  } catch (error) {
    console.warn('Background location permission request failed', error);
    return { foreground: true, background: false, canAskAgain: true };
  }
}

export async function getLocationPermissions(): Promise<LocationPermissionResult> {
  const foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted) {
    return { foreground: false, background: false, canAskAgain: foreground.canAskAgain };
  }
  const background = await Location.getBackgroundPermissionsAsync();
  return { foreground: true, background: background.granted, canAskAgain: foreground.canAskAgain };
}

/** Returns whether updates are running, so callers can fall back to a foreground watcher. */
export async function startBackgroundLocation(): Promise<boolean> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) return true;
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      ...TRACKING_OPTIONS,
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Recording hike',
        notificationBody: 'Trailhead is following your route.',
        notificationColor: '#2F6B4F',
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch (error) {
    console.warn('Could not start background location updates', error);
    return false;
  }
}

export async function stopBackgroundLocation(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch (error) {
    console.warn('Could not stop background location updates', error);
  }
}
