import { create } from 'zustand';

import { elevationGainMeters, routeDistanceMeters, type GeoPoint } from '@/src/lib/geo';

export type RecordingStatus = 'idle' | 'recording' | 'paused';

interface RecordingState {
  status: RecordingStatus;
  /** ISO-8601 timestamp of when the hike started, matching `hikes.startedAt`. */
  startedAt: string | null;
  points: GeoPoint[];
  elapsedSeconds: number;
  /** Epoch ms the current recording segment began; null while idle or paused. */
  segmentStartedAt: number | null;
  /** Seconds accumulated by segments that have already ended. */
  bankedSeconds: number;
  getDistanceMeters: () => number;
  getElevationGainMeters: () => number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  appendPoint: (point: GeoPoint) => void;
  tick: () => void;
  reset: () => void;
}

function createInitialState() {
  return {
    status: 'idle' as RecordingStatus,
    startedAt: null,
    points: [] as GeoPoint[],
    elapsedSeconds: 0,
    segmentStartedAt: null,
    bankedSeconds: 0,
  };
}

/**
 * Both derived values walk the whole route, and the record sheet re-renders
 * once a second, so results are kept against the identity of the points array.
 */
function cacheByPoints<T>(compute: (points: GeoPoint[]) => T) {
  let cache: { points: GeoPoint[]; value: T } | null = null;
  return (points: GeoPoint[]): T => {
    if (cache === null || cache.points !== points) {
      cache = { points, value: compute(points) };
    }
    return cache.value;
  };
}

const distanceOf = cacheByPoints(routeDistanceMeters);
const gainOf = cacheByPoints((points: GeoPoint[]) => elevationGainMeters(points));

export const useRecordingStore = create<RecordingState>((set, get) => ({
  ...createInitialState(),

  getDistanceMeters: () => distanceOf(get().points),
  getElevationGainMeters: () => gainOf(get().points),

  start: () => {
    const now = Date.now();
    set({
      ...createInitialState(),
      status: 'recording',
      startedAt: new Date(now).toISOString(),
      segmentStartedAt: now,
    });
  },

  pause: () => {
    const { status, segmentStartedAt, bankedSeconds } = get();
    if (status !== 'recording') return;
    const banked =
      bankedSeconds + (segmentStartedAt === null ? 0 : (Date.now() - segmentStartedAt) / 1000);
    set({
      status: 'paused',
      segmentStartedAt: null,
      bankedSeconds: banked,
      elapsedSeconds: Math.floor(banked),
    });
  },

  resume: () => {
    if (get().status !== 'paused') return;
    set({ status: 'recording', segmentStartedAt: Date.now() });
  },

  appendPoint: (point) => {
    if (get().status !== 'recording') return;
    set((state) => ({ points: [...state.points, point] }));
  },

  // Derived from wall-clock time so the duration stays correct across the
  // stretches where the app is backgrounded and no timer is firing.
  tick: () => {
    const { status, segmentStartedAt, bankedSeconds } = get();
    if (status !== 'recording' || segmentStartedAt === null) return;
    set({ elapsedSeconds: Math.floor(bankedSeconds + (Date.now() - segmentStartedAt) / 1000) });
  },

  reset: () => set(createInitialState()),
}));
