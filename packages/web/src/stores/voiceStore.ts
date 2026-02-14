import { create } from 'zustand';
import type { VoiceState } from '@ctc/shared';

// Android foreground service for keeping voice alive in background
// Disabled for debugging — re-enable once voice itself works in WebView
function startAndroidVoiceService() {
  // no-op for now
}

function stopAndroidVoiceService() {
  // no-op for now
}

interface VoiceStoreState {
  currentChannelId: string | null;
  token: string | null;
  url: string | null;
  channelParticipants: Map<string, Map<string, VoiceState>>;
  isMuted: boolean;
  isDeafened: boolean;
  isVideoOn: boolean;

  joinChannel: (channelId: string, token: string, url: string) => void;
  leaveChannel: () => void;
  setParticipant: (state: VoiceState) => void;
  removeParticipant: (channelId: string, userId: string) => void;
  loadServerParticipants: (data: Record<string, Array<{ user_id: string; username: string; muted: boolean; deafened: boolean; video: boolean }>>) => void;
  setMuted: (val: boolean) => void;
  setDeafened: (val: boolean) => void;
  setVideoOn: (val: boolean) => void;
}

export const useVoiceStore = create<VoiceStoreState>((set) => ({
  currentChannelId: null,
  token: null,
  url: null,
  channelParticipants: new Map(),
  isMuted: false,
  isDeafened: false,
  isVideoOn: false,

  joinChannel: (channelId, token, url) => {
    startAndroidVoiceService();
    set({ currentChannelId: channelId, token, url });
  },
  leaveChannel: () => {
    stopAndroidVoiceService();
    set({
      currentChannelId: null,
      token: null,
      url: null,
      isMuted: false,
      isDeafened: false,
      isVideoOn: false,
    });
  },
  setParticipant: (state) => set((s) => {
    const next = new Map(s.channelParticipants);
    const channelMap = new Map(next.get(state.channel_id) || new Map());
    channelMap.set(state.user_id, state);
    next.set(state.channel_id, channelMap);
    return { channelParticipants: next };
  }),
  removeParticipant: (channelId, userId) => set((s) => {
    const next = new Map(s.channelParticipants);
    const channelMap = next.get(channelId);
    if (channelMap) {
      const nextChannel = new Map(channelMap);
      nextChannel.delete(userId);
      if (nextChannel.size === 0) {
        next.delete(channelId);
      } else {
        next.set(channelId, nextChannel);
      }
    }
    return { channelParticipants: next };
  }),
  loadServerParticipants: (data) => set((s) => {
    const next = new Map(s.channelParticipants);
    for (const [channelId, participants] of Object.entries(data)) {
      const channelMap = new Map<string, VoiceState>();
      for (const p of participants) {
        channelMap.set(p.user_id, {
          channel_id: channelId,
          user_id: p.user_id,
          username: p.username,
          muted: p.muted,
          deafened: p.deafened,
          video: p.video,
          action: 'join',
        });
      }
      if (channelMap.size > 0) {
        next.set(channelId, channelMap);
      }
    }
    return { channelParticipants: next };
  }),
  setMuted: (val) => set({ isMuted: val }),
  setDeafened: (val) => set({ isDeafened: val }),
  setVideoOn: (val) => set({ isVideoOn: val }),
}));
