import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useVoiceStore } from '../stores/voiceStore';
import type { ServerToClientEvents, ClientToServerEvents } from '@ctc/shared';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let globalSocket: TypedSocket | null = null;

export function getSocket(): TypedSocket | null {
  return globalSocket;
}

export function useSocket() {
  const token = useAuthStore((s) => s.token);
  const socketRef = useRef<TypedSocket | null>(null);

  useEffect(() => {
    if (!token) return;

    const socket: TypedSocket = io(window.location.origin, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;
    globalSocket = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('new-message', (message) => {
      const currentChannel = useChatStore.getState().currentChannel;
      if (currentChannel && message.channel_id === currentChannel.id) {
        useChatStore.getState().addMessage(message);
      }
    });

    socket.on('message-edited', (message) => {
      useChatStore.getState().updateMessage(message);
    });

    socket.on('message-deleted', ({ id }) => {
      useChatStore.getState().removeMessage(id);
    });

    socket.on('presence-update', ({ user_id, status }) => {
      useChatStore.getState().updateMemberStatus(user_id, status);
    });

    socket.on('typing-start', ({ channel_id, user_id, username }) => {
      const me = useAuthStore.getState().user;
      if (user_id !== me?.id) {
        useChatStore.getState().setTyping(channel_id, user_id, username);
      }
    });

    socket.on('typing-stop', ({ channel_id, user_id }) => {
      useChatStore.getState().clearTyping(channel_id, user_id);
    });

    socket.on('voice-state', (state) => {
      if (state.action === 'join' || state.action === 'update') {
        useVoiceStore.getState().setParticipant(state);
      } else if (state.action === 'leave') {
        useVoiceStore.getState().removeParticipant(state.channel_id, state.user_id);
      }
    });

    socket.on('member-joined', ({ member }) => {
      useChatStore.getState().addMember(member);
    });

    socket.on('member-left', ({ user_id }) => {
      useChatStore.getState().removeMember(user_id);
    });

    socket.on('member-kicked', ({ user_id }) => {
      useChatStore.getState().removeMember(user_id);
      const me = useAuthStore.getState().user;
      if (user_id === me?.id) {
        useChatStore.getState().setCurrentServer(null);
      }
    });

    socket.on('member-banned', ({ user_id }) => {
      useChatStore.getState().removeMember(user_id);
      const me = useAuthStore.getState().user;
      if (user_id === me?.id) {
        useChatStore.getState().setCurrentServer(null);
      }
    });

    socket.on('channel-created', (channel) => {
      useChatStore.getState().addChannel(channel);
    });

    socket.on('channel-updated', (channel) => {
      useChatStore.getState().updateChannel(channel);
    });

    socket.on('channel-deleted', ({ id }) => {
      useChatStore.getState().removeChannel(id);
    });

    return () => {
      socket.disconnect();
      globalSocket = null;
    };
  }, [token]);

  return socketRef;
}
