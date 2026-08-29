import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import type { DistanceUnit } from '../lib/format';

const storage = createMMKV({ id: 'trailhead-settings' });

interface SettingsState {
  units: DistanceUnit;
  hikeReminders: boolean;
  offlineMaps: boolean;
  setUnits: (units: DistanceUnit) => void;
  setHikeReminders: (enabled: boolean) => void;
  setOfflineMaps: (enabled: boolean) => void;
}

const read = <T,>(key: string, fallback: T): T => {
  const raw = storage.getString(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => storage.set(key, JSON.stringify(value));

export const useSettingsStore = create<SettingsState>((set) => ({
  units: read<DistanceUnit>('units', 'metric'),
  hikeReminders: read('hikeReminders', true),
  offlineMaps: read('offlineMaps', false),
  setUnits: (units) => {
    write('units', units);
    set({ units });
  },
  setHikeReminders: (hikeReminders) => {
    write('hikeReminders', hikeReminders);
    set({ hikeReminders });
  },
  setOfflineMaps: (offlineMaps) => {
    write('offlineMaps', offlineMaps);
    set({ offlineMaps });
  },
}));
