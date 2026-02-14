import { useEffect, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { useSettingsStore } from '../stores/settingsStore';

export function useNoiseGate() {
  const { localParticipant } = useLocalParticipant();
  const threshold = useSettingsStore((s) => s.noiseGateThreshold);
  const gatedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (threshold === 0) {
      // Gate disabled — ensure mic follows normal mute state
      gatedRef.current = false;
      return;
    }

    const normalizedThreshold = threshold / 100; // 0..1

    const interval = setInterval(() => {
      const level = localParticipant.audioLevel ?? 0; // 0..1

      if (level >= normalizedThreshold) {
        // Above threshold → open gate
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        if (gatedRef.current) {
          gatedRef.current = false;
          localParticipant.setMicrophoneEnabled(true).catch(() => {});
        }
      } else if (!gatedRef.current) {
        // Below threshold → debounce before closing gate
        if (!debounceRef.current) {
          debounceRef.current = setTimeout(() => {
            gatedRef.current = true;
            localParticipant.setMicrophoneEnabled(false).catch(() => {});
            debounceRef.current = null;
          }, 200);
        }
      }
    }, 50);

    return () => {
      clearInterval(interval);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      // Re-enable mic when gate is removed
      if (gatedRef.current) {
        gatedRef.current = false;
        localParticipant.setMicrophoneEnabled(true).catch(() => {});
      }
    };
  }, [threshold, localParticipant]);
}
