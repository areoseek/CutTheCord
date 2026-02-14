export const FIRST_NAME_MIN = 1;
export const FIRST_NAME_MAX = 50;
export const USERNAME_MIN = 2;
export const USERNAME_MAX = 32;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 128;
export const SERVER_NAME_MIN = 1;
export const SERVER_NAME_MAX = 100;
export const CHANNEL_NAME_MIN = 1;
export const CHANNEL_NAME_MAX = 100;
export const MESSAGE_MAX = 4000;
export const INVITE_CODE_LENGTH = 8;

const FIRST_NAME_RE = /^[a-zA-Z\s'-]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]+$/;
const CHANNEL_NAME_RE = /^[a-z0-9-]+$/;

export function validateFirstName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < FIRST_NAME_MIN || trimmed.length > FIRST_NAME_MAX) {
    return `First name must be ${FIRST_NAME_MIN}-${FIRST_NAME_MAX} characters`;
  }
  if (!FIRST_NAME_RE.test(trimmed)) {
    return 'First name may only contain letters, spaces, hyphens, and apostrophes';
  }
  return null;
}

export function validateUsername(name: string): string | null {
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) {
    return `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters`;
  }
  if (!USERNAME_RE.test(name)) {
    return 'Username may only contain letters, numbers, underscores, dots, and hyphens';
  }
  return null;
}

export function validatePassword(pw: string): string | null {
  if (pw.length < PASSWORD_MIN || pw.length > PASSWORD_MAX) {
    return `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters`;
  }
  return null;
}

export function validateServerName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < SERVER_NAME_MIN || trimmed.length > SERVER_NAME_MAX) {
    return `Server name must be ${SERVER_NAME_MIN}-${SERVER_NAME_MAX} characters`;
  }
  return null;
}

export function validateChannelName(name: string): string | null {
  if (name.length < CHANNEL_NAME_MIN || name.length > CHANNEL_NAME_MAX) {
    return `Channel name must be ${CHANNEL_NAME_MIN}-${CHANNEL_NAME_MAX} characters`;
  }
  if (!CHANNEL_NAME_RE.test(name)) {
    return 'Channel names must be lowercase and may only contain letters, numbers, and hyphens';
  }
  return null;
}

export function validateMessageContent(content: string): string | null {
  const trimmed = content.trim();
  if (trimmed.length === 0) return 'Message cannot be empty';
  if (trimmed.length > MESSAGE_MAX) return `Message cannot exceed ${MESSAGE_MAX} characters`;
  return null;
}

export function sanitizeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
