import { create } from 'zustand';

// Derive a stable device class key so mobile and desktop store settings independently.
// Uses screen width at init time — mobile devices have narrow screens even in landscape.
function getDeviceKey(): string {
  if (typeof window === 'undefined') return 'desktop';
  // Use screen.width (physical device width) rather than innerWidth (viewport)
  // so the key stays stable even if the user resizes a desktop browser window.
  const w = window.screen?.width ?? 1024;
  return w <= 768 ? 'mobile' : 'desktop';
}

const DEVICE_KEY = getDeviceKey();

function prefixed(key: string): string {
  return `ctc_${DEVICE_KEY}_${key}`;
}

// Migrate old un-prefixed keys on first load
function migrateOldKeys() {
  const keysToMigrate = [
    'audioInputDeviceId', 'audioOutputDeviceId', 'videoInputDeviceId',
    'inputVolume', 'outputVolume', 'noiseSuppression', 'echoCancellation',
    'autoGainControl', 'noiseGateThreshold', 'userVolumes',
  ];
  for (const key of keysToMigrate) {
    const oldKey = `ctc_${key}`;
    const newKey = prefixed(key);
    const oldVal = localStorage.getItem(oldKey);
    if (oldVal !== null && localStorage.getItem(newKey) === null) {
      // Copy to both desktop and mobile so existing settings carry over
      localStorage.setItem(`ctc_desktop_${key}`, oldVal);
      localStorage.setItem(`ctc_mobile_${key}`, oldVal);
      localStorage.removeItem(oldKey);
    }
  }
}

migrateOldKeys();

interface SettingsState {
  audioInputDeviceId: string;
  audioOutputDeviceId: string;
  videoInputDeviceId: string;
  inputVolume: number;
  outputVolume: number;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  noiseGateThreshold: number;
  userVolumes: Record<string, number>;

  setAudioInput: (id: string) => void;
  setAudioOutput: (id: string) => void;
  setVideoInput: (id: string) => void;
  setInputVolume: (vol: number) => void;
  setOutputVolume: (vol: number) => void;
  setNoiseSuppression: (val: boolean) => void;
  setEchoCancellation: (val: boolean) => void;
  setAutoGainControl: (val: boolean) => void;
  setNoiseGateThreshold: (val: number) => void;
  setUserVolume: (userId: string, vol: number) => void;
}

function load(key: string, fallback: string): string {
  return localStorage.getItem(prefixed(key)) || fallback;
}

function loadNum(key: string, fallback: number): number {
  const val = localStorage.getItem(prefixed(key));
  return val !== null ? parseFloat(val) : fallback;
}

function loadBool(key: string, fallback: boolean): boolean {
  const val = localStorage.getItem(prefixed(key));
  return val !== null ? val === 'true' : fallback;
}

function loadJson<T>(key: string, fallback: T): T {
  const val = localStorage.getItem(prefixed(key));
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  audioInputDeviceId: load('audioInputDeviceId', ''),
  audioOutputDeviceId: load('audioOutputDeviceId', ''),
  videoInputDeviceId: load('videoInputDeviceId', ''),
  inputVolume: loadNum('inputVolume', 100),
  outputVolume: loadNum('outputVolume', 100),
  noiseSuppression: loadBool('noiseSuppression', true),
  echoCancellation: loadBool('echoCancellation', true),
  autoGainControl: loadBool('autoGainControl', true),
  noiseGateThreshold: loadNum('noiseGateThreshold', 0),
  userVolumes: loadJson<Record<string, number>>('userVolumes', {}),

  setAudioInput: (id) => {
    localStorage.setItem(prefixed('audioInputDeviceId'), id);
    set({ audioInputDeviceId: id });
  },
  setAudioOutput: (id) => {
    localStorage.setItem(prefixed('audioOutputDeviceId'), id);
    set({ audioOutputDeviceId: id });
  },
  setVideoInput: (id) => {
    localStorage.setItem(prefixed('videoInputDeviceId'), id);
    set({ videoInputDeviceId: id });
  },
  setInputVolume: (vol) => {
    localStorage.setItem(prefixed('inputVolume'), String(vol));
    set({ inputVolume: vol });
  },
  setOutputVolume: (vol) => {
    localStorage.setItem(prefixed('outputVolume'), String(vol));
    set({ outputVolume: vol });
  },
  setNoiseSuppression: (val) => {
    localStorage.setItem(prefixed('noiseSuppression'), String(val));
    set({ noiseSuppression: val });
  },
  setEchoCancellation: (val) => {
    localStorage.setItem(prefixed('echoCancellation'), String(val));
    set({ echoCancellation: val });
  },
  setAutoGainControl: (val) => {
    localStorage.setItem(prefixed('autoGainControl'), String(val));
    set({ autoGainControl: val });
  },
  setNoiseGateThreshold: (val) => {
    localStorage.setItem(prefixed('noiseGateThreshold'), String(val));
    set({ noiseGateThreshold: val });
  },
  setUserVolume: (userId, vol) => {
    set((s) => {
      const next = { ...s.userVolumes, [userId]: vol };
      localStorage.setItem(prefixed('userVolumes'), JSON.stringify(next));
      return { userVolumes: next };
    });
  },
}));
