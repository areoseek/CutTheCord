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
import { AccessToken } from 'livekit-server-sdk';
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
    socket.on('join-server', (serverId, cb) => {
      socket.join(`server:${serverId}`);
      if (typeof cb === 'function') cb();
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

    // Move user between voice channels (admin only)
    socket.on('move-user', async (data) => {
      const { user_id, channel_id } = data;

      // Get target channel and its server
      const targetCh = await queryOne<{ id: string; server_id: string; type: string }>(
        'SELECT id, server_id, type FROM channels WHERE id = $1',
        [channel_id]
      );
      if (!targetCh || targetCh.type !== 'voice') return;

      // Verify requester is admin on that server
      const requesterMember = await queryOne<{ role: string }>(
        'SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2',
        [targetCh.server_id, user.sub]
      );
      if (!requesterMember || requesterMember.role !== 'admin') return;

      // Verify target user is in the same server
      const targetMember = await queryOne(
        'SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2',
        [targetCh.server_id, user_id]
      );
      if (!targetMember) return;

      // Get target user's current voice channel
      const currentVoiceCh = await getUserVoiceChannel(user_id);
      if (!currentVoiceCh) return; // user not in voice

      // Get the target user's username
      const targetUser = await queryOne<{ username: string }>(
        'SELECT username FROM users WHERE id = $1',
        [user_id]
      );
      if (!targetUser) return;

      // If already in the target channel, nothing to do
      if (currentVoiceCh === channel_id) return;

      // Leave old channel
      await leaveVoiceChannel(currentVoiceCh, user_id);
      const oldCh = await queryOne<{ server_id: string }>(
        'SELECT server_id FROM channels WHERE id = $1',
        [currentVoiceCh]
      );
      if (oldCh) {
        io.to(`server:${oldCh.server_id}`).emit('voice-state', {
          channel_id: currentVoiceCh,
          user_id,
          username: targetUser.username,
          muted: false,
          deafened: false,
          video: false,
          action: 'leave',
        });
      }

      // Join new channel
      await joinVoiceChannel(channel_id, user_id, targetUser.username);
      io.to(`server:${targetCh.server_id}`).emit('voice-state', {
        channel_id,
        user_id,
        username: targetUser.username,
        muted: false,
        deafened: false,
        video: false,
        action: 'join',
      });

      // Generate LiveKit token for the target user
      const token = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
        identity: user_id,
        name: targetUser.username,
      });
      token.addGrant({
        room: channel_id,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
      });
      const jwt_token = await token.toJwt();

      // Find the target user's socket and emit voice-move
      const allSockets = await io.fetchSockets();
      for (const s of allSockets) {
        if ((s.data as any).user?.sub === user_id) {
          s.emit('voice-move', {
            channel_id,
            token: jwt_token,
            url: config.livekit.url,
          });
          break;
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
