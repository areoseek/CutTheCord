import Redis from 'ioredis';
import { config } from './config.js';

export const redis = new Redis(config.redis.url);

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

// Presence helpers
const PRESENCE_KEY = 'presence:';
const PRESENCE_TTL = 300; // 5 minutes

export async function setUserOnline(userId: string): Promise<void> {
  await redis.set(`${PRESENCE_KEY}${userId}`, 'online', 'EX', PRESENCE_TTL);
}

export async function setUserOffline(userId: string): Promise<void> {
  await redis.del(`${PRESENCE_KEY}${userId}`);
}

export async function getUserStatus(userId: string): Promise<string> {
  return (await redis.get(`${PRESENCE_KEY}${userId}`)) || 'offline';
}

export async function refreshPresence(userId: string): Promise<void> {
  await redis.expire(`${PRESENCE_KEY}${userId}`, PRESENCE_TTL);
}

// Voice state helpers
const VOICE_KEY = 'voice:channel:';
const USER_VOICE_KEY = 'voice:user:';

export async function joinVoiceChannel(channelId: string, userId: string, username: string): Promise<void> {
  await redis.hset(`${VOICE_KEY}${channelId}`, userId, JSON.stringify({ username, muted: false, deafened: false, video: false }));
  await redis.set(`${USER_VOICE_KEY}${userId}`, channelId);
}

export async function leaveVoiceChannel(channelId: string, userId: string): Promise<void> {
  await redis.hdel(`${VOICE_KEY}${channelId}`, userId);
  await redis.del(`${USER_VOICE_KEY}${userId}`);
}

export async function getUserVoiceChannel(userId: string): Promise<string | null> {
  return redis.get(`${USER_VOICE_KEY}${userId}`);
}

export async function getVoiceParticipants(channelId: string): Promise<Record<string, any>> {
  const data = await redis.hgetall(`${VOICE_KEY}${channelId}`);
  const result: Record<string, any> = {};
  for (const [uid, json] of Object.entries(data)) {
    result[uid] = JSON.parse(json);
  }
  return result;
}

// Typing indicators
const TYPING_KEY = 'typing:';

export async function setTyping(channelId: string, userId: string, username: string): Promise<void> {
  await redis.hset(`${TYPING_KEY}${channelId}`, userId, JSON.stringify({ username, ts: Date.now() }));
  await redis.expire(`${TYPING_KEY}${channelId}`, 10);
}

export async function clearTyping(channelId: string, userId: string): Promise<void> {
  await redis.hdel(`${TYPING_KEY}${channelId}`, userId);
}
