import React from 'react';
import { useSettingsStore } from '../stores/settingsStore';

interface Props {
  userId: string;
  username: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export default function UserVolumePopover({ userId, username, position, onClose }: Props) {
  const userVolumes = useSettingsStore((s) => s.userVolumes);
  const setUserVolume = useSettingsStore((s) => s.setUserVolume);
  const volume = userVolumes[userId] ?? 100;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Popover */}
      <div
        className="fixed z-50 bg-[#232428] rounded-lg shadow-xl border border-[#1e1f22] p-4 w-64"
        style={{ left: position.x, top: position.y }}
      >
        <div className="text-sm font-medium text-white mb-3 truncate">{username}</div>
        <div className="mb-2">
          <label className="block text-xs font-semibold text-[#b5bac1] uppercase mb-1">
            Volume: {volume}%
          </label>
          <input
            type="range"
            min="0"
            max="200"
            value={volume}
            onChange={(e) => setUserVolume(userId, parseInt(e.target.value))}
            className="w-full"
          />
        </div>
        <button
          onClick={() => setUserVolume(userId, volume === 0 ? 100 : 0)}
          className={`text-xs px-3 py-1.5 rounded font-medium ${
            volume === 0
              ? 'bg-red-600/30 text-red-300 hover:bg-red-600/50'
              : 'bg-[#383a40] text-[#b5bac1] hover:text-white hover:bg-[#404249]'
          }`}
        >
          {volume === 0 ? 'Unmute' : 'Mute'}
        </button>
      </div>
    </>
  );
}
