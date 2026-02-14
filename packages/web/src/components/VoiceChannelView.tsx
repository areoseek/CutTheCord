import React, { useState, useRef, useCallback } from 'react';
import {
  useParticipants,
  useLocalParticipant,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useChatStore } from '../stores/chatStore';
import { useVoiceStore } from '../stores/voiceStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getSocket } from '../hooks/useSocket';
import * as api from '../api';
import { primeMediaAudioContext } from '../utils/mediaAudioContext';
import UserVolumePopover from './UserVolumePopover';
import Avatar from './Avatar';

function ParticipantTile({
  participant,
  className,
  style,
  isLocal,
  onSingleClick,
  onDoubleClick,
  onContextMenu,
  avatarUrl,
}: {
  participant: ReturnType<typeof useParticipants>[number];
  className?: string;
  style?: React.CSSProperties;
  isLocal?: boolean;
  onSingleClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  avatarUrl?: string | null;
}) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const cameraTrack = tracks.find(
    (t) => t.participant.identity === participant.identity && t.source === Track.Source.Camera
  );
  const hasVideo = cameraTrack?.publication && !cameraTrack.publication.isMuted;
  const displayName = participant.name || participant.identity || '?';
  const tileRef = useRef<HTMLDivElement>(null);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (onDoubleClick) onDoubleClick(e);
    if (tileRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        tileRef.current.requestFullscreen().catch(() => {});
      }
    }
  }, [onDoubleClick]);

  return (
    <div
      ref={tileRef}
      className={`relative bg-[#1e1f22] rounded-lg overflow-hidden flex items-center justify-center cursor-pointer select-none ${className || ''}`}
      style={style}
      onClick={onSingleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={onContextMenu}
    >
      {hasVideo && cameraTrack ? (
        <VideoTrack
          trackRef={cameraTrack}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Avatar username={displayName} avatarUrl={avatarUrl} size={64} />
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black/60 rounded px-2 py-0.5 text-xs text-white flex items-center gap-1.5">
        {!participant.isMicrophoneEnabled && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-red-400">
            <path d="M2 2l20 20M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6M17 16.95A7 7 0 0 1 5 12m14 0a7 7 0 0 1-.78 3.22M12 19v4m-4 0h8" />
          </svg>
        )}
        <span>{displayName}{isLocal ? ' (You)' : ''}</span>
      </div>
      {participant.isSpeaking && (
        <div className="absolute inset-0 border-2 border-green-500 rounded-lg pointer-events-none" />
      )}
    </div>
  );
}

function VideoGrid() {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const isVideoOn = useVoiceStore((s) => s.isVideoOn);
  const videoInputDeviceId = useSettingsStore((s) => s.videoInputDeviceId);
  const members = useChatStore((s) => s.members);
  const [focusedIdentity, setFocusedIdentity] = useState<string | null>(null);
  const [volumePopover, setVolumePopover] = useState<{ userId: string; username: string; x: number; y: number } | null>(null);

  // Sync camera state with LiveKit
  React.useEffect(() => {
    if (isVideoOn) {
      const opts = videoInputDeviceId ? { deviceId: videoInputDeviceId } : undefined;
      localParticipant.setCameraEnabled(true, opts).catch((err) => {
        console.error('Failed to enable camera:', err);
        useVoiceStore.getState().setVideoOn(false);
      });
    } else {
      localParticipant.setCameraEnabled(false).catch(console.error);
    }
  }, [isVideoOn, localParticipant, videoInputDeviceId]);

  const getAvatarUrl = (identity: string) => {
    const member = members.find((m) => m.user_id === identity);
    return member?.avatar_url ?? null;
  };

  const remoteParticipants = participants.filter((p) => p.identity !== localParticipant.identity);
  const totalCount = participants.length;

  const handleClick = (identity: string, e: React.MouseEvent) => {
    // Don't focus local participant
    if (identity === localParticipant.identity) return;
    setFocusedIdentity((prev) => (prev === identity ? null : identity));
  };

  const handleRightClick = (identity: string, username: string, e: React.MouseEvent) => {
    if (identity === localParticipant.identity) return;
    e.preventDefault();
    setVolumePopover({ userId: identity, username, x: e.clientX, y: e.clientY });
  };

  // 1 participant: full space
  if (totalCount <= 1) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {participants.map((p) => (
          <ParticipantTile
            key={p.identity}
            participant={p}
            className="w-full h-full max-w-2xl max-h-[80vh] aspect-video"
            isLocal={p.identity === localParticipant.identity}
            avatarUrl={getAvatarUrl(p.identity)}
          />
        ))}
      </div>
    );
  }

  // 2 participants: remote fills space, local is small PiP
  if (totalCount === 2) {
    const remote = remoteParticipants[0];
    return (
      <div className="flex-1 relative overflow-hidden">
        {remote && (
          <ParticipantTile
            key={remote.identity}
            participant={remote}
            className="w-full h-full"
            onSingleClick={(e) => handleRightClick(remote.identity, remote.name || remote.identity, e)}
            avatarUrl={getAvatarUrl(remote.identity)}
          />
        )}
        {/* Local PiP */}
        <div className="absolute bottom-4 right-4 w-32 h-24 sm:w-48 sm:h-36 z-10">
          <ParticipantTile
            participant={localParticipant}
            className="w-full h-full shadow-lg border border-[#3f4147]"
            isLocal
            avatarUrl={getAvatarUrl(localParticipant.identity)}
          />
        </div>
        {volumePopover && (
          <UserVolumePopover
            userId={volumePopover.userId}
            username={volumePopover.username}
            position={{ x: volumePopover.x, y: volumePopover.y }}
            onClose={() => setVolumePopover(null)}
          />
        )}
      </div>
    );
  }

  // 3+ participants with focus
  if (focusedIdentity) {
    const focused = participants.find((p) => p.identity === focusedIdentity);
    const others = participants.filter((p) => p.identity !== focusedIdentity && p.identity !== localParticipant.identity);

    if (!focused) {
      setFocusedIdentity(null);
      return null;
    }

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main focused area */}
        <div className="flex-1 relative p-2 min-h-0">
          <ParticipantTile
            participant={focused}
            className="w-full h-full"
            onSingleClick={(e) => handleClick(focused.identity, e)}
            onDoubleClick={() => {}}
            onContextMenu={(e) => handleRightClick(focused.identity, focused.name || focused.identity, e)}
            avatarUrl={getAvatarUrl(focused.identity)}
          />
          {/* Local PiP */}
          <div className="absolute bottom-4 right-4 w-28 h-20 sm:w-36 sm:h-28 z-10">
            <ParticipantTile
              participant={localParticipant}
              className="w-full h-full shadow-lg border border-[#3f4147]"
              isLocal
              avatarUrl={getAvatarUrl(localParticipant.identity)}
            />
          </div>
        </div>
        {/* Bottom strip */}
        {others.length > 0 && (
          <div className="flex gap-2 p-2 overflow-x-auto flex-shrink-0">
            {others.map((p) => (
              <div key={p.identity} className="w-40 h-28 flex-shrink-0">
                <ParticipantTile
                  participant={p}
                  className="w-full h-full"
                  onSingleClick={(e) => handleClick(p.identity, e)}
                  onContextMenu={(e) => handleRightClick(p.identity, p.name || p.identity, e)}
                  avatarUrl={getAvatarUrl(p.identity)}
                />
              </div>
            ))}
          </div>
        )}
        {volumePopover && (
          <UserVolumePopover
            userId={volumePopover.userId}
            username={volumePopover.username}
            position={{ x: volumePopover.x, y: volumePopover.y }}
            onClose={() => setVolumePopover(null)}
          />
        )}
      </div>
    );
  }

  // 3+ participants, no focus: grid layout, local tile smaller
  const gridCols =
    totalCount <= 4
      ? 'grid-cols-1 sm:grid-cols-2'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 relative p-4 min-h-0">
        <div className={`grid ${gridCols} gap-3 h-full auto-rows-fr`}>
          {remoteParticipants.map((p) => (
            <ParticipantTile
              key={p.identity}
              participant={p}
              className="w-full h-full min-h-0"
              onSingleClick={(e) => handleClick(p.identity, e)}
              onContextMenu={(e) => handleRightClick(p.identity, p.name || p.identity, e)}
              avatarUrl={getAvatarUrl(p.identity)}
            />
          ))}
        </div>
        {/* Local PiP */}
        <div className="absolute bottom-4 right-4 w-28 h-20 sm:w-40 sm:h-28 z-10">
          <ParticipantTile
            participant={localParticipant}
            className="w-full h-full shadow-lg border border-[#3f4147]"
            isLocal
            avatarUrl={getAvatarUrl(localParticipant.identity)}
          />
        </div>
      </div>
      {volumePopover && (
        <UserVolumePopover
          userId={volumePopover.userId}
          username={volumePopover.username}
          position={{ x: volumePopover.x, y: volumePopover.y }}
          onClose={() => setVolumePopover(null)}
        />
      )}
    </div>
  );
}

function StoreParticipantList({ channelId }: { channelId: string }) {
  const channelParticipants = useVoiceStore((s) => s.channelParticipants);
  const members = useChatStore((s) => s.members);
  const participantMap = channelParticipants.get(channelId);
  const participants = participantMap ? Array.from(participantMap.values()) : [];

  if (participants.length === 0) return null;

  return (
    <div className="space-y-2 mb-4 w-full max-w-md">
      {participants.map((p) => {
        const member = members.find((m) => m.user_id === p.user_id);
        return (
          <div key={p.user_id} className="flex items-center gap-3 px-3 py-2 rounded bg-[#2b2d31]">
            <div className="relative">
              <Avatar username={p.username} avatarUrl={member?.avatar_url} size={32} />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#23a55a] border-2 border-[#2b2d31]" />
            </div>
            <span className="text-white text-sm">{p.username}</span>
            {p.muted && <span className="text-red-400 text-xs ml-auto">muted</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function VoiceChannelView() {
  const currentChannel = useChatStore((s) => s.currentChannel);
  const { currentChannelId: voiceChannelId, joinChannel, isVideoOn, setVideoOn } = useVoiceStore();
  const channelParticipants = useVoiceStore((s) => s.channelParticipants);

  const isConnected = voiceChannelId === currentChannel?.id;

  const handleJoinVoice = async () => {
    if (!currentChannel) return;
    try {
      // Prime the media AudioContext on this user gesture BEFORE WebRTC
      // starts, so Android keeps audio routed through the loudspeaker
      await primeMediaAudioContext();
      const { token, url } = await api.getVoiceToken(currentChannel.id);
      const socket = getSocket();
      socket?.emit('voice-state-update', { channel_id: currentChannel.id });
      joinChannel(currentChannel.id, token, url);
    } catch (e) {
      console.error('Failed to join voice:', e);
    }
  };

  if (!currentChannel) return null;

  const participantMap = channelParticipants.get(currentChannel.id);
  const participantCount = participantMap ? participantMap.size : 0;

  if (isConnected) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 flex items-center gap-3 border-b border-[#1e1f22] flex-shrink-0">
          <p className="text-green-400 text-sm font-medium whitespace-nowrap">Connected to voice</p>
          <button
            onClick={() => setVideoOn(!isVideoOn)}
            className={`ml-auto px-3 sm:px-4 py-1.5 rounded text-xs font-medium transition whitespace-nowrap ${
              isVideoOn
                ? 'bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50'
                : 'bg-[#383a40] text-[#b5bac1] hover:text-white hover:bg-[#404249]'
            }`}
          >
            {isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
          </button>
        </div>
        <VideoGrid />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto">
      <div className="text-center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="mx-auto mb-4 text-[#949ba4]">
          <path d="M12 3a1 1 0 0 0-1 1v8a3 3 0 0 0 6 0V4a1 1 0 0 0-1-1h-4zM8 12a4 4 0 0 0 8 0V4a4 4 0 0 0-8 0v8zM5 12a7 7 0 0 0 14 0h2a9 9 0 0 1-8 8.94V23h-2v-2.06A9 9 0 0 1 3 12h2z" />
        </svg>
        <h2 className="text-2xl font-bold text-white mb-1">{currentChannel.name}</h2>
        {participantCount > 0 ? (
          <p className="text-[#949ba4] text-sm mb-4">{participantCount} user{participantCount !== 1 ? 's' : ''} in voice</p>
        ) : (
          <p className="text-[#949ba4] text-sm mb-4">No one is currently in voice.</p>
        )}
        <StoreParticipantList channelId={currentChannel.id} />
        <button
          onClick={handleJoinVoice}
          className="bg-[#248046] hover:bg-[#1a6334] text-white font-medium px-8 py-2.5 rounded-md transition"
        >
          Join Voice
        </button>
      </div>
    </div>
  );
}
