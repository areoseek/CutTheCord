import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { queryOne, query } from '../db.js';
import {
  setUserOnline, setUserOffline, refreshPresence,
  setTyping, clearTyping,
  joinVoiceChannel, leaveVoiceChannel, getUserVoiceChannel, getVoiceParticipants
} from '../redis.js';
import { sanitizeHtml, validateMessageContent } from '@ctc/shared';
import type { JwtPayload } from '../middleware/auth.js';
import type { ServerToClientEvents, ClientToServerEvents, Message, VoiceState } from '@ctc/shared';
import { setIO } from './io.js';

export function setupSocket(httpServer: HttpServer): SocketServer<ClientToServerEvents, ServerToClientEvents> {
  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/socket.io',
  });

  // Auth middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) return next(new Error('No token'));
    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
      (socket.data as any).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  setIO(io);

  io.on('connection', async (socket) => {
    const user: JwtPayload = (socket.data as any).user;
    console.log(`Socket connected: ${user.username} (${user.sub})`);

    await setUserOnline(user.sub);
    // Update DB status
    await query('UPDATE users SET status = $1 WHERE id = $2', ['online', user.sub]);

    // Broadcast presence to all servers the user is in
    const servers = await query<{ server_id: string }>(
      'SELECT server_id FROM server_members WHERE user_id = $1',
      [user.sub]
    );
    for (const s of servers.rows) {
      socket.join(`server:${s.server_id}`);
      io.to(`server:${s.server_id}`).emit('presence-update', { user_id: user.sub, status: 'online' });
    }

    // Join server room
    socket.on('join-server', (serverId) => {
      socket.join(`server:${serverId}`);
    });

    socket.on('leave-server', (serverId) => {
      socket.leave(`server:${serverId}`);
    });

    // Join channel room (for typing indicators)
    socket.on('join-channel', (channelId) => {
      socket.join(`channel:${channelId}`);
    });

    socket.on('leave-channel', (channelId) => {
      socket.leave(`channel:${channelId}`);
    });

    // Real-time messages
    socket.on('send-message', async (data, cb) => {
      const { channel_id, content } = data;
      const contentError = validateMessageContent(content);
      if (contentError) return;

      // Verify access
      const access = await queryOne(
        `SELECT c.server_id FROM channels c
         JOIN server_members sm ON sm.server_id = c.server_id
         WHERE c.id = $1 AND sm.user_id = $2`,
        [channel_id, user.sub]
      );
      if (!access) return;

      const sanitized = sanitizeHtml(content.trim());
      const message = await queryOne<Message>(
        `WITH inserted AS (
           INSERT INTO messages (channel_id, author_id, content) VALUES ($1, $2, $3) RETURNING *
         )
         SELECT i.*, u.username as author_username, u.avatar_url as author_avatar_url
         FROM inserted i JOIN users u ON u.id = i.author_id`,
        [channel_id, user.sub, sanitized]
      );

      if (message) {
        io.to(`server:${access.server_id}`).emit('new-message', message);
        await clearTyping(channel_id, user.sub);
        cb(message);
      }
    });

    // Typing
    socket.on('typing-start', async (channelId) => {
      await setTyping(channelId, user.sub, user.username);
      socket.to(`channel:${channelId}`).emit('typing-start', {
        channel_id: channelId, user_id: user.sub, username: user.username,
      });
    });

    socket.on('typing-stop', async (channelId) => {
      await clearTyping(channelId, user.sub);
      socket.to(`channel:${channelId}`).emit('typing-stop', {
        channel_id: channelId, user_id: user.sub,
      });
    });

    // Voice state
    socket.on('voice-state-update', async (data) => {
      const { channel_id } = data;

      // Leave current voice channel if in one
      const currentChannel = await getUserVoiceChannel(user.sub);
      if (currentChannel) {
        await leaveVoiceChannel(currentChannel, user.sub);
        // Get server_id for the old channel
        const oldCh = await queryOne<{ server_id: string }>(
          'SELECT server_id FROM channels WHERE id = $1',
          [currentChannel]
        );
        if (oldCh) {
          io.to(`server:${oldCh.server_id}`).emit('voice-state', {
            channel_id: currentChannel,
            user_id: user.sub,
            username: user.username,
            muted: false,
            deafened: false,
            video: false,
            action: 'leave',
          });
        }
      }

      // Join new channel if specified
      if (channel_id) {
        await joinVoiceChannel(channel_id, user.sub, user.username);
        const ch = await queryOne<{ server_id: string }>(
          'SELECT server_id FROM channels WHERE id = $1',
          [channel_id]
        );
        if (ch) {
          io.to(`server:${ch.server_id}`).emit('voice-state', {
            channel_id,
            user_id: user.sub,
            username: user.username,
            muted: false,
            deafened: false,
            video: false,
            action: 'join',
          });
        }
      }
    });

    // Heartbeat for presence
    const presenceInterval = setInterval(() => refreshPresence(user.sub), 60000);

    // Disconnect
    socket.on('disconnect', async () => {
      clearInterval(presenceInterval);
      await setUserOffline(user.sub);
      await query('UPDATE users SET status = $1 WHERE id = $2', ['offline', user.sub]);

      // Leave voice if in one
      const currentChannel = await getUserVoiceChannel(user.sub);
      if (currentChannel) {
        await leaveVoiceChannel(currentChannel, user.sub);
        const ch = await queryOne<{ server_id: string }>('SELECT server_id FROM channels WHERE id = $1', [currentChannel]);
        if (ch) {
          io.to(`server:${ch.server_id}`).emit('voice-state', {
            channel_id: currentChannel,
            user_id: user.sub,
            username: user.username,
            muted: false,
            deafened: false,
            video: false,
            action: 'leave',
          });
        }
      }

      // Broadcast offline
      for (const s of servers.rows) {
        io.to(`server:${s.server_id}`).emit('presence-update', { user_id: user.sub, status: 'offline' });
      }

      console.log(`Socket disconnected: ${user.username}`);
    });
  });

  return io;
}
