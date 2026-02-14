import React from 'react';
import { useChatStore } from '../stores/chatStore';
import Avatar from './Avatar';

export default function MemberList() {
  const members = useChatStore((s) => s.members);

  const onlineMembers = members.filter(m => m.status !== 'offline');
  const offlineMembers = members.filter(m => m.status === 'offline');

  const statusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'dnd': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const renderMember = (member: typeof members[0]) => (
    <div key={member.user_id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[#35373c] cursor-pointer">
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
    </div>
  );
}
