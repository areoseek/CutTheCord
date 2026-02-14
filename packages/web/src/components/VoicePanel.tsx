import React from 'react';
import { useVoiceStore } from '../stores/voiceStore';
import { useChatStore } from '../stores/chatStore';
import { getSocket } from '../hooks/useSocket';

export default function VoicePanel() {
  const { currentChannelId, leaveChannel, isMuted, isDeafened, setMuted, setDeafened } = useVoiceStore();
  const channels = useChatStore((s) => s.channels);

  if (!currentChannelId) return null;

  const channel = channels.find(c => c.id === currentChannelId);

  const handleDisconnect = () => {
    const socket = getSocket();
    socket?.emit('voice-state-update', { channel_id: null });
    leaveChannel();
  };

  return (
    <div className="border-t border-[#1e1f22] p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs text-green-400 font-semibold">Voice Connected</div>
          <div className="text-xs text-[#949ba4]">{channel?.name || 'Unknown'}</div>
        </div>
        <button
          onClick={handleDisconnect}
          className="text-[#b5bac1] hover:text-red-400 p-1"
          title="Disconnect"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
          </svg>
        </button>
      </div>

      <div className="flex gap-1">
        <button
          onClick={() => setMuted(!isMuted)}
          className={`flex-1 py-1.5 rounded text-xs font-medium ${
            isMuted ? 'bg-red-600/30 text-red-300' : 'bg-[#383a40] text-[#b5bac1] hover:text-white'
          }`}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button
          onClick={() => setDeafened(!isDeafened)}
          className={`flex-1 py-1.5 rounded text-xs font-medium ${
            isDeafened ? 'bg-red-600/30 text-red-300' : 'bg-[#383a40] text-[#b5bac1] hover:text-white'
          }`}
        >
          {isDeafened ? 'Undeafen' : 'Deafen'}
        </button>
      </div>
    </div>
  );
}
