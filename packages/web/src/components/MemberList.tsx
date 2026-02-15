import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import * as api from '../api';
import Avatar from './Avatar';

export default function MemberList() {
  const members = useChatStore((s) => s.members);
  const currentServer = useChatStore((s) => s.currentServer);
  const user = useAuthStore((s) => s.user);
  const isAdmin = members.some(m => m.user_id === user?.id && m.role === 'admin');

  const onlineMembers = members.filter(m => m.status !== 'offline');
  const offlineMembers = members.filter(m => m.status === 'offline');

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; member: typeof members[0] } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ctxMenu]);

  const handleContextMenu = (e: React.MouseEvent, member: typeof members[0]) => {
    if (!isAdmin || member.user_id === user?.id) return;
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, member });
  };

  const handleRoleToggle = async () => {
    if (!ctxMenu || !currentServer) return;
    const newRole = ctxMenu.member.role === 'admin' ? 'member' : 'admin';
    try {
      await api.updateMemberRole(currentServer.id, ctxMenu.member.user_id, newRole);
    } catch (err) {
      console.error(err);
    }
    setCtxMenu(null);
  };

  const handleKick = async () => {
    if (!ctxMenu || !currentServer) return;
    try {
      await api.kickMember(currentServer.id, ctxMenu.member.user_id);
    } catch (err) {
      console.error(err);
    }
    setCtxMenu(null);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'dnd': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const renderMember = (member: typeof members[0]) => (
    <div
      key={member.user_id}
      onContextMenu={(e) => handleContextMenu(e, member)}
      className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#35373c] cursor-pointer"
    >
      <div className="relative">
        <Avatar username={member.nickname || member.username} avatarUrl={member.avatar_url} size={32} />
        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#2b2d31] ${statusColor(member.status)}`} />
      </div>
      <div className="min-w-0">
        <div className="text-sm truncate flex items-center gap-1.5">
          <span className={member.status === 'offline' ? 'text-[#949ba4]' : 'text-[#f2f3f5]'}>
            {member.nickname || member.username}
          </span>
          {member.role === 'admin' && (
            <span className="text-[10px] bg-indigo-600/30 text-indigo-300 px-1.5 py-0.5 rounded">Admin</span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-60 bg-[#2b2d31] flex-shrink-0 overflow-y-auto px-2 py-4">
      {onlineMembers.length > 0 && (
        <>
          <h4 className="text-xs font-semibold text-[#949ba4] uppercase px-2 mb-2">
            Online — {onlineMembers.length}
          </h4>
          {onlineMembers.map(renderMember)}
        </>
      )}

      {offlineMembers.length > 0 && (
        <>
          <h4 className="text-xs font-semibold text-[#949ba4] uppercase px-2 mb-2 mt-4">
            Offline — {offlineMembers.length}
          </h4>
          {offlineMembers.map(renderMember)}
        </>
      )}

      {/* Member context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed bg-[#111214] rounded-lg py-1.5 shadow-xl border border-[#1e1f22] z-50 min-w-[160px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          <button
            onClick={handleRoleToggle}
            className="w-full text-left px-3 py-1.5 text-sm text-[#dbdee1] hover:bg-[#4752c4] hover:text-white rounded-sm"
          >
            {ctxMenu.member.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
          </button>
          <button
            onClick={handleKick}
            className="w-full text-left px-3 py-1.5 text-sm text-[#f23f42] hover:bg-[#f23f42] hover:text-white rounded-sm"
          >
            Kick
          </button>
        </div>
      )}
    </div>
  );
}
