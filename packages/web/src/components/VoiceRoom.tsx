import React, { useEffect, useRef, type ReactNode } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
} from '@livekit/components-react';
import { useVoiceStore } from '../stores/voiceStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useNoiseGate } from '../hooks/useNoiseGate';
import { getMediaAudioContext } from '../utils/mediaAudioContext';

function VoiceControls() {
  const { localParticipant } = useLocalParticipant();
  const isMuted = useVoiceStore((s) => s.isMuted);
  const audioInputDeviceId = useSettingsStore((s) => s.audioInputDeviceId);
  const noiseSuppression = useSettingsStore((s) => s.noiseSuppression);
  const echoCancellation = useSettingsStore((s) => s.echoCancellation);
  const autoGainControl = useSettingsStore((s) => s.autoGainControl);

  // Noise gate hook
  useNoiseGate();

  // Sync mic mute state with LiveKit, using selected device + audio processing constraints
  useEffect(() => {
    const opts: any = {};
    if (audioInputDeviceId) opts.deviceId = audioInputDeviceId;
    opts.noiseSuppression = noiseSuppression;
    opts.echoCancellation = echoCancellation;
    opts.autoGainControl = autoGainControl;
    localParticipant.setMicrophoneEnabled(!isMuted, opts).catch(console.error);
  }, [isMuted, localParticipant, audioInputDeviceId, noiseSuppression, echoCancellation, autoGainControl]);

  return null;
}

function RemoteVolumeSync() {
  const remoteParticipants = useRemoteParticipants();
  const userVolumes = useSettingsStore((s) => s.userVolumes);

  useEffect(() => {
    for (const p of remoteParticipants) {
      const vol = userVolumes[p.identity] ?? 100;
      for (const pub of p.audioTrackPublications.values()) {
        if (pub.track) {
          pub.track.setVolume(vol / 100);
        }
      }
    }
  }, [remoteParticipants, userVolumes]);

  return null;
}

export default function LiveKitWrapper({ children }: { children: ReactNode }) {
  const { token, url, currentChannelId } = useVoiceStore();
  const audioCtxRef = useRef<AudioContext | undefined>(undefined);

  // Get or create the media AudioContext for webAudioMix
  if (!audioCtxRef.current) {
    audioCtxRef.current = getMediaAudioContext();
  }

  if (!token || !url || !currentChannelId) {
    return <>{children}</>;
  }

  return (
    <LiveKitRoom
      key={currentChannelId}
      token={token}
      serverUrl={url}
      connect={true}
      audio={true}
      video={false}
      options={{ webAudioMix: audioCtxRef.current }}
      style={{ display: 'contents' }}
      onDisconnected={() => {
        console.log('LiveKit disconnected');
      }}
      onError={(err) => {
        console.error('LiveKit error:', err);
      }}
    >
      <RoomAudioRenderer />
      <VoiceControls />
      <RemoteVolumeSync />
      {children}
    </LiveKitRoom>
  );
}
