import { useAuthStore } from './stores/authStore';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Auth
export const login = (username: string, password: string) =>
  request<any>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });

export const register = (first_name: string, username: string, password: string, confirm_password: string) =>
  request<any>('/auth/register', { method: 'POST', body: JSON.stringify({ first_name, username, password, confirm_password }) });

export const changePassword = (current_password: string, new_password: string) =>
  request<any>('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) });

export const getMe = () => request<any>('/auth/me');

// Servers
export const createServer = (name: string) =>
  request<any>('/servers', { method: 'POST', body: JSON.stringify({ name }) });
export const getServers = () => request<any[]>('/servers');
export const getServer = (id: string) => request<any>(`/servers/${id}`);
export const getServerMembers = (id: string) => request<any[]>(`/servers/${id}/members`);
export const getServerChannels = (id: string) => request<any[]>(`/servers/${id}/channels`);
export const renameServer = (id: string, name: string) =>
  request<any>(`/servers/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });

// Channels
export const createChannel = (serverId: string, name: string, type: string) =>
  request<any>(`/servers/${serverId}/channels`, { method: 'POST', body: JSON.stringify({ name, type }) });
export const renameChannel = (serverId: string, channelId: string, name: string) =>
  request<any>(`/servers/${serverId}/channels/${channelId}`, { method: 'PATCH', body: JSON.stringify({ name }) });
export const deleteChannel = (serverId: string, channelId: string) =>
  request<any>(`/servers/${serverId}/channels/${channelId}`, { method: 'DELETE' });

// Messages
export const getMessages = (channelId: string, cursor?: string) =>
  request<any>(`/channels/${channelId}/messages${cursor ? `?cursor=${cursor}` : ''}`);
export const sendMessage = (channelId: string, content: string) =>
  request<any>(`/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
export const editMessage = (channelId: string, messageId: string, content: string) =>
  request<any>(`/channels/${channelId}/messages/${messageId}`, { method: 'PATCH', body: JSON.stringify({ content }) });
export const deleteMessage = (channelId: string, messageId: string) =>
  request<any>(`/channels/${channelId}/messages/${messageId}`, { method: 'DELETE' });
export const pinMessage = (channelId: string, messageId: string) =>
  request<any>(`/channels/${channelId}/messages/${messageId}/pin`, { method: 'POST', body: JSON.stringify({}) });
export const unpinMessage = (channelId: string, messageId: string) =>
  request<any>(`/channels/${channelId}/messages/${messageId}/pin`, { method: 'DELETE' });

// Invites
export const getInvite = (code: string) => request<any>(`/invites/${code}`);
export const acceptInvite = (code: string) =>
  request<any>(`/invites/${code}/accept`, { method: 'POST' });
export const declineInvite = (code: string) =>
  request<any>(`/invites/${code}/decline`, { method: 'POST' });
export const createInvite = (serverId: string, data?: { max_uses?: number; expires_hours?: number }) =>
  request<any>(`/servers/${serverId}/invites`, { method: 'POST', body: JSON.stringify(data || {}) });
export const getServerInvites = (serverId: string) => request<any[]>(`/servers/${serverId}/invites`);
export const deleteInvite = (serverId: string, code: string) =>
  request<any>(`/servers/${serverId}/invites/${code}`, { method: 'DELETE' });

// Members
export const kickMember = (serverId: string, userId: string) =>
  request<any>(`/servers/${serverId}/members/${userId}`, { method: 'DELETE' });
export const banMember = (serverId: string, userId: string, reason?: string) =>
  request<any>(`/servers/${serverId}/bans/${userId}`, { method: 'POST', body: JSON.stringify({ reason }) });
export const updateMemberRole = (serverId: string, userId: string, role: 'admin' | 'member') =>
  request<any>(`/servers/${serverId}/members/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });

// Voice
export const getVoiceToken = (channel_id: string) =>
  request<{ token: string; url: string }>('/voice/token', { method: 'POST', body: JSON.stringify({ channel_id }) });
export const getServerVoiceParticipants = (serverId: string) =>
  request<Record<string, Array<{ user_id: string; username: string; muted: boolean; deafened: boolean; video: boolean }>>>(`/servers/${serverId}/voice-participants`);

// Avatar
export async function uploadAvatar(blob: Blob): Promise<{ avatar_url: string }> {
  const token = useAuthStore.getState().token;
  const form = new FormData();
  form.append('avatar', blob, 'avatar.png');
  const res = await fetch(`${BASE}/users/avatar`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (res.status === 401) {
    useAuthStore.getState().logout();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export const deleteAvatar = () =>
  request<{ success: boolean }>('/users/avatar', { method: 'DELETE' });
