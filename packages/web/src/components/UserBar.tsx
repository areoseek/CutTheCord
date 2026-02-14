import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import Avatar from './Avatar';

export default function UserBar() {
  const { user, logout } = useAuthStore();
  const openSettings = useUIStore((s) => s.openSettings);

  if (!user) return null;

  return (
    <div className="h-[52px] bg-[#232428] px-2 flex items-center gap-2 flex-shrink-0">
      <Avatar username={user.username} avatarUrl={user.avatar_url} size={32} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{user.username}</div>
      </div>
      <button
        onClick={openSettings}
        className="text-[#b5bac1] hover:text-white p-1.5 rounded hover:bg-[#35373c]"
        title="User Settings"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z" />
        </svg>
      </button>
      <button
        onClick={logout}
        className="text-[#b5bac1] hover:text-red-400 p-1.5 rounded hover:bg-[#35373c]"
        title="Log Out"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
        </svg>
      </button>
    </div>
  );
}
