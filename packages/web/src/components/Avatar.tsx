import React from 'react';

interface AvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

export default function Avatar({ username, avatarUrl, size = 32, className = '' }: AvatarProps) {
  const letter = (username || '?')[0].toUpperCase();
  const fontSize = size < 32 ? 'text-xs' : size < 48 ? 'text-sm' : size < 80 ? 'text-2xl' : 'text-3xl';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-[#5865f2] flex items-center justify-center text-white font-semibold flex-shrink-0 ${fontSize} ${className}`}
      style={{ width: size, height: size }}
    >
      {letter}
    </div>
  );
}
