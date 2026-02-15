import React, { useEffect, useState } from 'react';
import { useSocket, getSocket } from '../hooks/useSocket';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import * as api from '../api';
import { useVoiceStore } from '../stores/voiceStore';
import ServerSidebar from './ServerSidebar';
import ChannelSidebar from './ChannelSidebar';
import ChatArea from './ChatArea';
import MemberList from './MemberList';
import VoiceChannelView from './VoiceChannelView';
import LiveKitWrapper from './VoiceRoom';
import UserBar from './UserBar';
import VoicePanel from './VoicePanel';
import SettingsOverlay from './SettingsOverlay';
import { useUIStore } from '../stores/uiStore';
import { useMobile } from '../hooks/useMobile';
import { validateServerName } from '@ctc/shared';

export default function MainLayout() {
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const mobilePanel = useUIStore((s) => s.mobilePanel);
  const setMobilePanel = useUIStore((s) => s.setMobilePanel);
  const isMobile = useMobile();
  useSocket();
  const user = useAuthStore((s) => s.user);
  const { servers, currentServer, currentChannel, setServers, setCurrentServer, setChannels, setMembers, setCurrentChannel } = useChatStore();

  // Create server modal
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [createServerError, setCreateServerError] = useState('');
  const [creatingServer, setCreatingServer] = useState(false);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const isAdmin = useChatStore((s) =>
    s.members.some(m => m.user_id === user?.id && m.role === 'admin')
  );

  // Load servers on mount, auto-select first server
  useEffect(() => {
    api.getServers().then((servers) => {
      setServers(servers);
      if (!useChatStore.getState().currentServer && servers.length > 0) {
        setCurrentServer(servers[0]);
      }
    }).catch(console.error);
  }, []);

  // Load channels and members when server changes
  useEffect(() => {
    if (!currentServer) return;
    const socket = getSocket();

    // Clear stale voice participants from the previous server
    useVoiceStore.getState().clearParticipants();

    // Join socket room first, then fetch voice participants to avoid race condition
    if (socket) {
      socket.emit('join-server', currentServer.id, () => {
        api.getServerVoiceParticipants(currentServer.id)
          .then((data) => useVoiceStore.getState().loadServerParticipants(data))
          .catch(console.error);
      });
    }

    api.getServerChannels(currentServer.id).then((channels) => {
      setChannels(channels);
      // Auto-select first text channel
      const textChannel = channels.find((c: any) => c.type === 'text');
      if (textChannel) setCurrentChannel(textChannel);
    }).catch(console.error);

    api.getServerMembers(currentServer.id).then(setMembers).catch(console.error);

    return () => {
      if (socket) socket.emit('leave-server', currentServer.id);
    };
  }, [currentServer?.id]);

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateServerError('');
    const nameErr = validateServerName(newServerName);
    if (nameErr) { setCreateServerError(nameErr); return; }

    setCreatingServer(true);
    try {
      const server = await api.createServer(newServerName.trim());
      setServers([...useChatStore.getState().servers, server]);
      setCurrentServer(server);
      setShowCreateServer(false);
      setNewServerName('');
    } catch (e: any) {
      setCreateServerError(e.message);
    } finally {
      setCreatingServer(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!currentServer) return;
    setCreatingInvite(true);
    try {
      const invite = await api.createInvite(currentServer.id, { max_uses: 1 });
      setInviteLink(`${window.location.origin}/invite/${invite.code}`);
      setShowInviteModal(true);
      setInviteCopied(false);
    } catch (e: any) {
      console.error(e);
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteLink);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  // Create server modal (shared between no-server and main views)
  const createServerModal = showCreateServer && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateServer(false)}>
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleCreateServer}
        className="bg-[#313338] rounded-lg p-6 w-96 max-w-[calc(100vw-2rem)] shadow-xl"
      >
        <h3 className="text-lg font-semibold text-white mb-4">Create a Server</h3>
        {createServerError && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 px-3 py-2 rounded mb-3 text-sm">
            {createServerError}
          </div>
        )}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-2">Server Name</label>
          <input
            value={newServerName}
            onChange={e => setNewServerName(e.target.value)}
            className="w-full bg-[#1e1f22] rounded px-3 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="My Awesome Server"
            required
            autoFocus
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => setShowCreateServer(false)} className="text-[#b5bac1] hover:text-white px-4 py-2">
            Cancel
          </button>
          <button type="submit" disabled={creatingServer} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded disabled:opacity-50">
            {creatingServer ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );

  // Invite modal
  const inviteModal = showInviteModal && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowInviteModal(false)}>
      <div onClick={e => e.stopPropagation()} className="bg-[#313338] rounded-lg p-6 w-96 max-w-[calc(100vw-2rem)] shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-2">Invite People</h3>
        <p className="text-[#b5bac1] text-sm mb-4">Share this one-time invite link:</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={inviteLink}
            className="flex-1 bg-[#1e1f22] rounded px-3 py-2 text-white outline-none text-sm min-w-0"
            onFocus={e => e.target.select()}
          />
          <button
            onClick={handleCopyInvite}
            className={`px-4 py-2 rounded text-white font-medium text-sm transition flex-shrink-0 ${
              inviteCopied ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {inviteCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-[#949ba4] text-xs mt-3">This link can only be used once.</p>
        <div className="flex justify-end mt-4">
          <button onClick={() => setShowInviteModal(false)} className="text-[#b5bac1] hover:text-white px-4 py-2 text-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  );

  // No servers state
  if (servers.length === 0 && !currentServer) {
    return (
      <div className="h-screen flex overflow-hidden">
        {!isMobile && <ServerSidebar onCreateServer={() => setShowCreateServer(true)} />}
        <div className="flex-1 flex items-center justify-center bg-[#313338]">
          <div className="text-center px-4">
            <h2 className="text-2xl font-bold text-white mb-2">No servers yet</h2>
            <p className="text-[#b5bac1] mb-6">Create a server to get started!</p>
            <button
              onClick={() => setShowCreateServer(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded transition"
            >
              Create a Server
            </button>
          </div>
        </div>
        {createServerModal}
      </div>
    );
  }

  // --- MOBILE LAYOUT ---
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-[#313338]">
        {/* Mobile header */}
        <div className="h-12 flex items-center px-3 border-b border-[#1e1f22] shadow-sm flex-shrink-0 gap-2">
          {mobilePanel === 'chat' ? (
            <>
              <button
                onClick={() => setMobilePanel('channels')}
                className="w-9 h-9 flex items-center justify-center text-[#b5bac1] hover:text-white rounded-md hover:bg-[#35373c] flex-shrink-0"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
                </svg>
              </button>
              {currentChannel && (
                <div className="flex items-center min-w-0">
                  {currentChannel.type === 'voice' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-[#949ba4] mr-1.5 flex-shrink-0">
                      <path d="M12 3a1 1 0 0 0-1 1v8a3 3 0 0 0 6 0V4a1 1 0 0 0-1-1h-4zM8 12a4 4 0 0 0 8 0V4a4 4 0 0 0-8 0v8zM5 12a7 7 0 0 0 14 0h2a9 9 0 0 1-8 8.94V23h-2v-2.06A9 9 0 0 1 3 12h2z" />
                    </svg>
                  ) : (
                    <span className="text-[#949ba4] mr-1.5">#</span>
                  )}
                  <h3 className="font-semibold text-white truncate">{currentChannel.name}</h3>
                </div>
              )}
              {currentChannel?.type === 'text' && (
                <button
                  onClick={() => setMobilePanel('members')}
                  className="w-9 h-9 flex items-center justify-center text-[#b5bac1] hover:text-white rounded-md hover:bg-[#35373c] ml-auto flex-shrink-0"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                  </svg>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => setMobilePanel('chat')}
                className="w-9 h-9 flex items-center justify-center text-[#b5bac1] hover:text-white rounded-md hover:bg-[#35373c] flex-shrink-0"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                </svg>
              </button>
              <h3 className="font-semibold text-white truncate">
                {mobilePanel === 'channels' ? (currentServer?.name || 'Channels') : 'Members'}
              </h3>
            </>
          )}
        </div>

        {/* Mobile content */}
        <LiveKitWrapper>
          <div className="flex-1 flex min-h-0 relative">
            {/* Chat panel (default) */}
            {mobilePanel === 'chat' && (
              <div className="flex-1 flex flex-col min-h-0">
                {currentChannel ? (
                  currentChannel.type === 'voice' ? (
                    <VoiceChannelView />
                  ) : (
                    <ChatArea />
                  )
                ) : (
                  <div className="flex-1 flex items-center justify-center text-[#949ba4]">
                    {currentServer ? 'Select a channel' : 'Welcome to CutTheCord'}
                  </div>
                )}
              </div>
            )}

            {/* Channels panel */}
            {mobilePanel === 'channels' && (
              <div className="flex-1 flex min-h-0">
                <ServerSidebar onCreateServer={() => setShowCreateServer(true)} />
                <div className="flex-1 bg-[#2b2d31] flex flex-col min-h-0">
                  {currentServer ? (
                    <>
                      <div className="h-12 px-4 flex items-center justify-between border-b border-[#1e1f22] shadow-sm flex-shrink-0">
                        <h2 className="font-semibold text-white truncate">{currentServer.name}</h2>
                        {isAdmin && (
                          <button
                            onClick={handleCreateInvite}
                            disabled={creatingInvite}
                            className="text-[#949ba4] hover:text-white flex-shrink-0 ml-2"
                            title="Invite People"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M15 14c2.67 0 8 1.33 8 4v2H7v-2c0-2.67 5.33-4 8-4zm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 15v-3H2v-2h3V7h2v3h3v2H7v3H5z" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <ChannelSidebar />
                      <VoicePanel />
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-[#949ba4] text-sm px-4 text-center">
                      Select a server to get started
                    </div>
                  )}
                  <UserBar />
                </div>
              </div>
            )}

            {/* Members panel */}
            {mobilePanel === 'members' && (
              <div className="flex-1 bg-[#2b2d31] min-h-0 overflow-y-auto">
                <MemberList />
              </div>
            )}
          </div>
        </LiveKitWrapper>

        {settingsOpen && <SettingsOverlay />}
        {createServerModal}
        {inviteModal}
      </div>
    );
  }

  // --- DESKTOP LAYOUT (unchanged) ---
  return (
    <div className="h-screen flex overflow-hidden">
      {/* Server sidebar (leftmost icons) */}
      <ServerSidebar onCreateServer={() => setShowCreateServer(true)} />

      {/* Channel sidebar + user bar */}
      <div className="w-44 sm:w-60 bg-[#2b2d31] flex flex-col flex-shrink-0">
        {currentServer ? (
          <>
            <div className="h-12 px-4 flex items-center justify-between border-b border-[#1e1f22] shadow-sm">
              <h2 className="font-semibold text-white truncate">{currentServer.name}</h2>
              {isAdmin && (
                <button
                  onClick={handleCreateInvite}
                  disabled={creatingInvite}
                  className="text-[#949ba4] hover:text-white flex-shrink-0 ml-2"
                  title="Invite People"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15 14c2.67 0 8 1.33 8 4v2H7v-2c0-2.67 5.33-4 8-4zm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 15v-3H2v-2h3V7h2v3h3v2H7v3H5z" />
                  </svg>
                </button>
              )}
            </div>
            <ChannelSidebar />
            <VoicePanel />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#949ba4] text-sm px-4 text-center">
            Select a server to get started
          </div>
        )}
        <UserBar />
      </div>

      {/* Main content — wrapped in LiveKitWrapper so voice channel view can use LiveKit hooks */}
      <LiveKitWrapper>
        <div className="flex-1 flex flex-col bg-[#313338] min-w-0">
          {currentChannel ? (
            <>
              <div className="h-12 px-4 flex items-center border-b border-[#1e1f22] shadow-sm flex-shrink-0">
                {currentChannel.type === 'voice' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-[#949ba4] mr-2 flex-shrink-0">
                    <path d="M12 3a1 1 0 0 0-1 1v8a3 3 0 0 0 6 0V4a1 1 0 0 0-1-1h-4zM8 12a4 4 0 0 0 8 0V4a4 4 0 0 0-8 0v8zM5 12a7 7 0 0 0 14 0h2a9 9 0 0 1-8 8.94V23h-2v-2.06A9 9 0 0 1 3 12h2z" />
                  </svg>
                ) : (
                  <span className="text-[#949ba4] mr-2">#</span>
                )}
                <h3 className="font-semibold text-white">{currentChannel.name}</h3>
              </div>
              {currentChannel.type === 'voice' ? (
                <VoiceChannelView />
              ) : (
                <div className="flex-1 flex min-h-0">
                  <ChatArea />
                  <MemberList />
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#949ba4]">
              {currentServer ? 'Select a channel' : 'Welcome to CutTheCord'}
            </div>
          )}
        </div>
      </LiveKitWrapper>
      {settingsOpen && <SettingsOverlay />}
      {createServerModal}
      {inviteModal}
    </div>
  );
}
