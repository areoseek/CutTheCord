import { FastifyInstance } from 'fastify';
import { AccessToken } from 'livekit-server-sdk';
import { query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { getVoiceParticipants } from '../redis.js';
import type { VoiceTokenResponse } from '@ctc/shared';

export async function voiceRoutes(app: FastifyInstance): Promise<void> {
  // Get LiveKit token for a voice channel
  app.post<{ Body: { channel_id: string } }>(
    '/api/voice/token',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { channel_id } = request.body;
      if (!channel_id) return reply.code(400).send({ error: 'channel_id is required' });

      // Verify channel exists and is voice type, and user has access
      const channel = await queryOne<{ id: string; type: string; server_id: string }>(
        `SELECT c.id, c.type, c.server_id FROM channels c
         JOIN server_members sm ON sm.server_id = c.server_id
         WHERE c.id = $1 AND sm.user_id = $2`,
        [channel_id, request.user.sub]
      );

      if (!channel) return reply.code(404).send({ error: 'Channel not found' });
      if (channel.type !== 'voice') return reply.code(400).send({ error: 'Not a voice channel' });

      const token = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
        identity: request.user.sub,
        name: request.user.username,
      });

      token.addGrant({
        room: channel_id,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
      });

      const jwt = await token.toJwt();
      const response: VoiceTokenResponse = {
        token: jwt,
        url: config.livekit.url,
      };

      return response;
    }
  );

  // Get all voice participants for a server
  app.get<{ Params: { serverId: string } }>(
    '/api/servers/:serverId/voice-participants',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { serverId } = request.params;

      // Verify user is a member of this server
      const membership = await queryOne(
        'SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2',
        [serverId, request.user.sub]
      );
      if (!membership) return reply.code(403).send({ error: 'Not a member of this server' });

      // Get all voice channels for this server
      const voiceChannels = await query<{ id: string }>(
        "SELECT id FROM channels WHERE server_id = $1 AND type = 'voice'",
        [serverId]
      );

      const result: Record<string, Array<{ user_id: string; username: string; muted: boolean; deafened: boolean; video: boolean }>> = {};

      for (const ch of voiceChannels.rows) {
        const participants = await getVoiceParticipants(ch.id);
        const list = Object.entries(participants).map(([userId, data]) => ({
          user_id: userId,
          username: data.username,
          muted: data.muted ?? false,
          deafened: data.deafened ?? false,
          video: data.video ?? false,
        }));
        if (list.length > 0) {
          result[ch.id] = list;
        }
      }

      return result;
    }
  );
}
