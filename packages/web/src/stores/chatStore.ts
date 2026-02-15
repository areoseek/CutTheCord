import { create } from 'zustand';
import type { Server, Channel, Message, ServerMemberWithUser } from '@ctc/shared';

interface ChatState {
  servers: Server[];
  currentServer: Server | null;
  channels: Channel[];
  currentChannel: Channel | null;
  messages: Message[];
  members: ServerMemberWithUser[];
  hasMoreMessages: boolean;
  nextCursor: string | null;
  typingUsers: Map<string, { username: string; timeout: ReturnType<typeof setTimeout> }>;

  setServers: (servers: Server[]) => void;
  setCurrentServer: (server: Server | null) => void;
  setChannels: (channels: Channel[]) => void;
  setCurrentChannel: (channel: Channel | null) => void;
  setMessages: (messages: Message[]) => void;
  prependMessages: (messages: Message[], cursor: string | null, hasMore: boolean) => void;
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  removeMessage: (id: string) => void;
  setMembers: (members: ServerMemberWithUser[]) => void;
  updateMemberStatus: (userId: string, status: string) => void;
  addMember: (member: ServerMemberWithUser) => void;
  removeMember: (userId: string) => void;
  setTyping: (channelId: string, userId: string, username: string) => void;
  clearTyping: (channelId: string, userId: string) => void;
  updateMemberRole: (userId: string, role: string) => void;
  pinMessage: (id: string) => void;
  unpinMessage: (id: string) => void;
  addChannel: (channel: Channel) => void;
  updateChannel: (channel: Channel) => void;
  removeChannel: (id: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  servers: [],
  currentServer: null,
  channels: [],
  currentChannel: null,
  messages: [],
  members: [],
  hasMoreMessages: false,
  nextCursor: null,
  typingUsers: new Map(),

  setServers: (servers) => set({ servers }),
  setCurrentServer: (server) => set({ currentServer: server, channels: [], currentChannel: null, messages: [], members: [] }),
  setChannels: (channels) => set({ channels }),
  setCurrentChannel: (channel) => set({ currentChannel: channel, messages: [], hasMoreMessages: false, nextCursor: null }),
  setMessages: (messages) => set({ messages }),
  prependMessages: (newMessages, cursor, hasMore) => set((s) => ({
    messages: [...newMessages, ...s.messages],
    nextCursor: cursor,
    hasMoreMessages: hasMore,
  })),
  addMessage: (message) => set((s) => ({
    messages: [...s.messages, message],
  })),
  updateMessage: (message) => set((s) => ({
    messages: s.messages.map(m => m.id === message.id ? message : m),
  })),
  removeMessage: (id) => set((s) => ({
    messages: s.messages.filter(m => m.id !== id),
  })),
  setMembers: (members) => set({ members }),
  updateMemberStatus: (userId, status) => set((s) => ({
    members: s.members.map(m => m.user_id === userId ? { ...m, status: status as any } : m),
  })),
  addMember: (member) => set((s) => ({
    members: [...s.members, member],
  })),
  removeMember: (userId) => set((s) => ({
    members: s.members.filter(m => m.user_id !== userId),
  })),
  setTyping: (channelId, userId, username) => {
    const current = get().typingUsers;
    const existing = current.get(userId);
    if (existing) clearTimeout(existing.timeout);
    const timeout = setTimeout(() => {
      get().clearTyping(channelId, userId);
    }, 5000);
    const next = new Map(current);
    next.set(userId, { username, timeout });
    set({ typingUsers: next });
  },
  clearTyping: (channelId, userId) => {
    const current = get().typingUsers;
    const existing = current.get(userId);
    if (existing) clearTimeout(existing.timeout);
    const next = new Map(current);
    next.delete(userId);
    set({ typingUsers: next });
  },
  updateMemberRole: (userId, role) => set((s) => ({
    members: s.members.map(m => m.user_id === userId ? { ...m, role: role as any } : m),
  })),
  pinMessage: (id) => set((s) => ({
    messages: s.messages.map(m => m.id === id ? { ...m, pinned: true } : m),
  })),
  unpinMessage: (id) => set((s) => ({
    messages: s.messages.map(m => m.id === id ? { ...m, pinned: false } : m),
  })),
  addChannel: (channel) => set((s) => ({
    channels: [...s.channels, channel].sort((a, b) => a.position - b.position),
  })),
  updateChannel: (channel) => set((s) => ({
    channels: s.channels.map(c => c.id === channel.id ? channel : c),
  })),
  removeChannel: (id) => set((s) => ({
    channels: s.channels.filter(c => c.id !== id),
    currentChannel: s.currentChannel?.id === id ? null : s.currentChannel,
  })),
}));
