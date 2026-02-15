// ── User ──
export interface User {
  id: string;
  username: string;
  first_name: string;
  must_change_pw: boolean;
  is_global_admin: boolean;
  avatar_url: string | null;
  status: UserStatus;
  created_at: string;
}

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface UserWithPassword extends User {
  password_hash: string;
}

// ── Server ──
export interface Server {
  id: string;
  name: string;
  icon_url: string | null;
  created_by: string;
  created_at: string;
}

// ── Server Member ──
export interface ServerMember {
  server_id: string;
  user_id: string;
  role: ServerRole;
  nickname: string | null;
  joined_at: string;
}

export type ServerRole = 'admin' | 'member';

export interface ServerMemberWithUser extends ServerMember {
  username: string;
  first_name: string;
  avatar_url: string | null;
  status: UserStatus;
}

// ── Channel ──
export interface Channel {
  id: string;
  server_id: string;
  name: string;
  type: ChannelType;
  position: number;
  created_at: string;
}

export type ChannelType = 'text' | 'voice';

// ── Message ──
export interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  edited_at: string | null;
  created_at: string;
  pinned?: boolean;
  author_username?: string;
  author_avatar_url?: string | null;
}

// ── Invite ──
export interface Invite {
  code: string;
  server_id: string;
  created_by: string;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  created_at: string;
  server_name?: string;
}

// ── Ban ──
export interface Ban {
  server_id: string;
  user_id: string;
  reason: string | null;
  banned_by: string;
  created_at: string;
}

// ── Auth ──
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  must_change_pw: boolean;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

// ── Socket Events ──
export interface ServerToClientEvents {
  'new-message': (message: Message) => void;
  'message-edited': (message: Message) => void;
  'message-deleted': (data: { id: string; channel_id: string }) => void;
  'presence-update': (data: { user_id: string; status: UserStatus }) => void;
  'typing-start': (data: { channel_id: string; user_id: string; username: string }) => void;
  'typing-stop': (data: { channel_id: string; user_id: string }) => void;
  'voice-state': (data: VoiceState) => void;
  'member-joined': (data: { server_id: string; member: ServerMemberWithUser }) => void;
  'member-left': (data: { server_id: string; user_id: string }) => void;
  'member-kicked': (data: { server_id: string; user_id: string }) => void;
  'member-banned': (data: { server_id: string; user_id: string }) => void;
  'channel-created': (channel: Channel) => void;
  'channel-updated': (channel: Channel) => void;
  'channel-deleted': (data: { id: string; server_id: string }) => void;
  'member-role-updated': (data: { server_id: string; user_id: string; role: ServerRole }) => void;
  'message-pinned': (message: Message) => void;
  'message-unpinned': (data: { id: string; channel_id: string }) => void;
  'server-updated': (server: Server) => void;
  'voice-move': (data: { channel_id: string; token: string; url: string }) => void;
}

export interface ClientToServerEvents {
  'join-server': (server_id: string, cb?: () => void) => void;
  'leave-server': (server_id: string) => void;
  'join-channel': (channel_id: string) => void;
  'leave-channel': (channel_id: string) => void;
  'send-message': (data: { channel_id: string; content: string }, cb: (msg: Message) => void) => void;
  'typing-start': (channel_id: string) => void;
  'typing-stop': (channel_id: string) => void;
  'voice-state-update': (data: { channel_id: string | null }) => void;
  'move-user': (data: { user_id: string; channel_id: string }) => void;
}

// ── Voice ──
export interface VoiceState {
  channel_id: string;
  user_id: string;
  username: string;
  muted: boolean;
  deafened: boolean;
  video: boolean;
  action: 'join' | 'leave' | 'update';
}

export interface VoiceTokenRequest {
  channel_id: string;
}

export interface VoiceTokenResponse {
  token: string;
  url: string;
}

// ── Pagination ──
export interface PaginatedResponse<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
}

// ── Admin ──
export interface RegisterRequest {
  first_name: string;
  username: string;
  password: string;
  confirm_password: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  is_global_admin?: boolean;
}

export interface CreateServerRequest {
  name: string;
  owner_id: string;
}

export interface AssignAdminRequest {
  user_id: string;
  server_id: string;
}
