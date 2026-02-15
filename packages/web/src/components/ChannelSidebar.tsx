import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import { useVoiceStore } from '../stores/voiceStore';
import { useUIStore } from '../stores/uiStore';
import { useMobile } from '../hooks/useMobile';
import { getSocket } from '../hooks/useSocket';
import * as api from '../api';
import type { Channel } from '@ctc/shared';

export default function ChannelSidebar() {
  const { channels, currentChannel, currentServer, setCurrentChannel, members } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'text' | 'voice'>('text');

  const channelParticipants = useVoiceStore((s) => s.channelParticipants);
  const setMobilePanel = useUIStore((s) => s.setMobilePanel);
  const isMobile = useMobile();
  const isAdmin = members.some(m => m.user_id === user?.id && m.role === 'admin');
  const textChannels = channels.filter(c => c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');
  const [dragOverChannelId, setDragOverChannelId] = useState<string | null>(null);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; channel: Channel } | null>(null);
  const [renameTarget, setRenameTarget] = useState<Channel | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ctxMenu]);

  const handleContextMenu = (e: React.MouseEvent, channel: Channel) => {
    if (!isAdmin) return;
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, channel });
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !currentServer || !renameValue.trim()) return;
    try {
      await api.renameChannel(currentServer.id, renameTarget.id, renameValue.trim());
      setRenameTarget(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !currentServer) return;
    try {
      await api.deleteChannel(currentServer.id, deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectChannel = (channel: Channel) => {
    if (currentChannel?.id === channel.id) {
      if (isMobile) setMobilePanel('chat');
      return;
    }
    const socket = getSocket();
    if (currentChannel && currentChannel.type === 'text') {
      socket?.emit('leave-channel', currentChannel.id);
    }
    setCurrentChannel(channel);
    if (channel.type === 'text') {
      socket?.emit('join-channel', channel.id);
    }
    if (isMobile) setMobilePanel('chat');
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentServer) return;
    try {
      await api.createChannel(currentServer.id, newName, newType);
      setNewName('');
      setShowCreate(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-2 py-3">
      {/* Text Channels */}
      <div className="mb-4">
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-xs font-semibold text-[#949ba4] uppercase">Text Channels</span>
          {isAdmin && (
            <button
              onClick={() => { setShowCreate(true); setNewType('text'); }}
              className="text-[#949ba4] hover:text-white text-lg leading-none"
              title="Create Channel"
            >
              +
            </button>
          )}
        </div>
        {textChannels.map(channel => (
          <button
            key={channel.id}
            onClick={() => handleSelectChannel(channel)}
            onContextMenu={(e) => handleContextMenu(e, channel)}
            className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-1.5 text-sm transition ${
              currentChannel?.id === channel.id
                ? 'bg-[#404249] text-white'
                : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]'
            }`}
          >
            <span className="text-[#949ba4]">#</span>
            <span className="truncate">{channel.name}</span>
          </button>
        ))}
      </div>

      {/* Voice Channels */}
      <div>
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-xs font-semibold text-[#949ba4] uppercase">Voice Channels</span>
          {isAdmin && (
            <button
              onClick={() => { setShowCreate(true); setNewType('voice'); }}
              className="text-[#949ba4] hover:text-white text-lg leading-none"
              title="Create Channel"
            >
              +
            </button>
          )}
        </div>
        {voiceChannels.map(channel => {
          const participantMap = channelParticipants.get(channel.id);
          const participants = participantMap ? Array.from(participantMap.values()) : [];
          const isDragOver = dragOverChannelId === channel.id;
          return (
            <div
              key={channel.id}
              onDragOver={isAdmin ? (e) => { e.preventDefault(); setDragOverChannelId(channel.id); } : undefined}
              onDragLeave={isAdmin ? () => setDragOverChannelId(null) : undefined}
              onDrop={isAdmin ? (e) => {
                e.preventDefault();
                setDragOverChannelId(null);
                const userId = e.dataTransfer.getData('text/user-id');
                if (userId) {
                  const socket = getSocket();
                  socket?.emit('move-user', { user_id: userId, channel_id: channel.id });
                }
              } : undefined}
              className={`rounded transition-colors ${isDragOver ? 'bg-[#23a55a]/20 ring-1 ring-[#23a55a]' : ''}`}
            >
              <button
                onClick={() => handleSelectChannel(channel)}
                onContextMenu={(e) => handleContextMenu(e, channel)}
                className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-1.5 text-sm transition ${
                  currentChannel?.id === channel.id
                    ? 'bg-[#404249] text-white'
                    : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                  <path d="M12 3a1 1 0 0 0-1 1v8a3 3 0 0 0 6 0V4a1 1 0 0 0-1-1h-4zM8 12a4 4 0 0 0 8 0V4a4 4 0 0 0-8 0v8zM5 12a7 7 0 0 0 14 0h2a9 9 0 0 1-8 8.94V23h-2v-2.06A9 9 0 0 1 3 12h2z" />
                </svg>
                <span className="truncate">{channel.name}</span>
              </button>
              {participants.length > 0 && (
                <div className="ml-6 mt-0.5 mb-1 space-y-0.5">
                  {participants.map((p) => (
                    <div
                      key={p.user_id}
                      draggable={isAdmin}
                      onDragStart={isAdmin ? (e) => {
                        e.dataTransfer.setData('text/user-id', p.user_id);
                        e.dataTransfer.effectAllowed = 'move';
                      } : undefined}
                      className={`flex items-center gap-2 px-1 py-0.5 text-xs text-[#b5bac1] ${isAdmin ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    >
                      <div className="relative flex-shrink-0">
                        <div className="w-5 h-5 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-[10px] font-medium">
                          {(p.username || '?')[0].toUpperCase()}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#23a55a] border border-[#2b2d31]" />
                      </div>
                      <span className="truncate">{p.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Channel context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed bg-[#111214] rounded-lg py-1.5 shadow-xl border border-[#1e1f22] z-50 min-w-[160px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <button
            onClick={() => {
              setRenameTarget(ctxMenu.channel);
              setRenameValue(ctxMenu.channel.name);
              setCtxMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-[#dbdee1] hover:bg-[#4752c4] hover:text-white rounded-sm mx-0"
          >
            Rename Channel
          </button>
          <button
            onClick={() => {
              setDeleteTarget(ctxMenu.channel);
              setCtxMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-[#f23f42] hover:bg-[#f23f42] hover:text-white rounded-sm mx-0"
          >
            Delete Channel
          </button>
        </div>
      )}

      {/* Rename modal */}
      {renameTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setRenameTarget(null)}>
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={handleRename}
            className="bg-[#313338] rounded-lg p-6 w-96 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Rename Channel</h3>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-2">Channel Name</label>
              <input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                className="w-full bg-[#1e1f22] rounded px-3 py-2 text-white outline-none"
                autoFocus
                required
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setRenameTarget(null)} className="text-[#b5bac1] hover:text-white px-4 py-2">
                Cancel
              </button>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded">
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteTarget(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-[#313338] rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Channel</h3>
            <p className="text-[#b5bac1] mb-4">
              Are you sure you want to delete <strong className="text-white">#{deleteTarget.name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="text-[#b5bac1] hover:text-white px-4 py-2">
                Cancel
              </button>
              <button onClick={handleDelete} className="bg-[#f23f42] hover:bg-[#a12d2f] text-white px-4 py-2 rounded">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create channel modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={handleCreateChannel}
            className="bg-[#313338] rounded-lg p-6 w-96 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              Create {newType === 'text' ? 'Text' : 'Voice'} Channel
            </h3>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-2">Channel Name</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                className="w-full bg-[#1e1f22] rounded px-3 py-2 text-white outline-none"
                placeholder={newType === 'text' ? 'new-channel' : 'Voice Room'}
                required
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowCreate(false)} className="text-[#b5bac1] hover:text-white px-4 py-2">
                Cancel
              </button>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded">
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
