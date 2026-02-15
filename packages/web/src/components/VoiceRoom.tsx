import React, { useEffect, useRef, type ReactNode } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
} from '@livekit/components-react';
import { createLocalAudioTrack } from 'livekit-client';
import { useVoiceStore } from '../stores/voiceStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useNoiseGate } from '../hooks/useNoiseGate';
import { useRNNoise } from '../hooks/useRNNoise';
import { getMediaAudioContext } from '../utils/mediaAudioContext';

function VoiceControls() {
  const { localParticipant } = useLocalParticipant();
  const isMuted = useVoiceStore((s) => s.isMuted);
  const audioInputDeviceId = useSettingsStore((s) => s.audioInputDeviceId);
  const noiseSuppression = useSettingsStore((s) => s.noiseSuppression);
  const echoCancellation = useSettingsStore((s) => s.echoCancellation);
  const autoGainControl = useSettingsStore((s) => s.autoGainControl);

  // Get processed audio with RNNoise (only when enabled)
  const { stream: processedStream, isReady, error } = useRNNoise({
    enabled: noiseSuppression,
    deviceId: audioInputDeviceId,
    echoCancellation,
    autoGainControl,
  });

  // Noise gate hook
  useNoiseGate();

  // Debug logging
  useEffect(() => {
    if (error) console.error('[VoiceControls] RNNoise error:', error);
  }, [error]);

  // When RNNoise is enabled, publish the processed track
  useEffect(() => {
    // Only use manual publishing when noise suppression is enabled
    if (!noiseSuppression) return;
    if (!isReady || !processedStream) return;

    let mounted = true;
    let audioTrack: any = null;

    async function publishAudio() {
      try {
        // First, unpublish ALL existing audio tracks
        const existingPubs = Array.from(localParticipant.audioTrackPublications.values());
        console.log('[VoiceControls] Unpublishing', existingPubs.length, 'existing audio tracks');
        for (const pub of existingPubs) {
          if (pub.track) {
            await localParticipant.unpublishTrack(pub.track);
          }
        }

        const tracks = processedStream.getAudioTracks();
        console.log('[VoiceControls] Stream has', tracks.length, 'audio tracks');

        if (tracks.length === 0) {
          console.error('[VoiceControls] No audio tracks in stream');
          return;
        }

        const mediaTrack = tracks[0];
        console.log('[VoiceControls] Publishing processed track:', mediaTrack.label, 'readyState:', mediaTrack.readyState);

        // Use the MediaStreamTrack directly
        await localParticipant.publishTrack(mediaTrack, {
          name: 'microphone',
          source: 'microphone' as any,
        });

        console.log('[VoiceControls] ✓ Track published');
      } catch (err) {
        console.error('[VoiceControls] Publish error:', err);
      }
    }

    publishAudio();

    return () => {
      mounted = false;
      // Unpublish by track name
      const pub = Array.from(localParticipant.audioTrackPublications.values()).find(
        p => p.trackName === 'microphone'
      );
      if (pub) {
        console.log('[VoiceControls] Unpublishing track');
        localParticipant.unpublishTrack(pub.track!).catch(console.error);
      }
    };
  }, [localParticipant, noiseSuppression, isReady, processedStream]);

  // When RNNoise is disabled, use LiveKit's default audio handling
  useEffect(() => {
    if (noiseSuppression) return; // RNNoise handles it

    const opts: any = {};
    if (audioInputDeviceId) opts.deviceId = audioInputDeviceId;
    opts.echoCancellation = echoCancellation;
    opts.autoGainControl = autoGainControl;
    opts.noiseSuppression = false; // Browser NS doesn't work well

    localParticipant.setMicrophoneEnabled(!isMuted, opts).catch(console.error);
  }, [noiseSuppression, isMuted, localParticipant, audioInputDeviceId, echoCancellation, autoGainControl]);

  // Handle mute state (for RNNoise mode)
  useEffect(() => {
    if (!noiseSuppression) return; // LiveKit handles mute in default mode

    const pubs = Array.from(localParticipant.audioTrackPublications.values());
    const track = pubs[0]?.track;
    if (track) {
      isMuted ? track.mute() : track.unmute();
    }
  }, [noiseSuppression, isMuted, localParticipant]);

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
  const noiseSuppression = useSettingsStore((s) => s.noiseSuppression);
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
      audio={!noiseSuppression} // Only auto-create audio when RNNoise is OFF
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
