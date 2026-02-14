import React from 'react';
import { useChatStore } from '../stores/chatStore';

interface Props {
  onCreateServer?: () => void;
}

export default function ServerSidebar({ onCreateServer }: Props) {
  const { servers, currentServer, setCurrentServer } = useChatStore();

  return (
    <div className="w-[72px] bg-[#1e1f22] flex flex-col items-center py-3 gap-2 flex-shrink-0 overflow-y-auto">
      {/* Home button */}
      <button
        onClick={() => setCurrentServer(null)}
        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 hover:rounded-xl ${
          !currentServer
            ? 'bg-indigo-600 rounded-xl text-white'
            : 'bg-[#313338] text-[#dbdee1] hover:bg-indigo-600 hover:text-white'
        }`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </button>

      <div className="w-8 h-0.5 bg-[#35363c] rounded-full mx-auto" />

      {/* Server list */}
      {servers.map((server) => (
        <button
          key={server.id}
          onClick={() => setCurrentServer(server)}
          title={server.name}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 hover:rounded-xl text-sm font-semibold ${
            currentServer?.id === server.id
              ? 'bg-indigo-600 rounded-xl text-white'
              : 'bg-[#313338] text-[#dbdee1] hover:bg-indigo-600 hover:text-white'
          }`}
        >
          {server.icon_url ? (
            <img src={server.icon_url} alt="" className="w-12 h-12 rounded-inherit object-cover" />
          ) : (
            server.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
          )}
        </button>
      ))}

      {/* Create server button */}
      {onCreateServer && (
        <button
          onClick={onCreateServer}
          title="Create a Server"
          className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 hover:rounded-xl bg-[#313338] text-[#3ba55c] hover:bg-[#3ba55c] hover:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 11V5h-2v6H5v2h6v6h2v-6h6v-2h-6z" />
          </svg>
        </button>
      )}
    </div>
  );
}
