import { FastifyInstance } from 'fastify';
import { query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { validateServerName, validateChannelName } from '@ctc/shared';
import type { Server, Channel, ServerMemberWithUser } from '@ctc/shared';

export async function serverRoutes(app: FastifyInstance): Promise<void> {
  // List servers the user belongs to
  app.get('/api/servers', { preHandler: [requireAuth] }, async (request) => {
    const result = await query<Server>(
      `SELECT s.id, s.name, s.icon_url, s.created_by, s.created_at
       FROM servers s
       JOIN server_members sm ON sm.server_id = s.id
       WHERE sm.user_id = $1
       ORDER BY s.name`,
      [request.user.sub]
    );
    return result.rows;
  });

  // Create server (authenticated user)
  app.post<{ Body: { name: string } }>('/api/servers', { preHandler: [requireAuth] }, async (request, reply) => {
    const { name } = request.body;
    if (!name) return reply.code(400).send({ error: 'Server name is required' });

    const nameError = validateServerName(name);
    if (nameError) return reply.code(400).send({ error: nameError });

    // Create server
    const server = await queryOne<Server>(
      'INSERT INTO servers (name, created_by) VALUES ($1, $2) RETURNING *',
      [name.trim(), request.user.sub]
    );

    // Add creator as admin
    await query(
      'INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, $3)',
      [server!.id, request.user.sub, 'admin']
    );

    // Create default channels
    await query(
      'INSERT INTO channels (server_id, name, type, position) VALUES ($1, $2, $3, $4)',
      [server!.id, 'general', 'text', 0]
    );
    await query(
      'INSERT INTO channels (server_id, name, type, position) VALUES ($1, $2, $3, $4)',
      [server!.id, 'voice', 'voice', 1]
    );

    return reply.code(201).send(server);
  });

  // Get single server
  app.get<{ Params: { id: string } }>('/api/servers/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const server = await queryOne<Server>(
      `SELECT s.* FROM servers s
       JOIN server_members sm ON sm.server_id = s.id
       WHERE s.id = $1 AND sm.user_id = $2`,
      [request.params.id, request.user.sub]
    );
    if (!server) return reply.code(404).send({ error: 'Server not found' });
    return server;
  });

  // Get server members
  app.get<{ Params: { id: string } }>('/api/servers/:id/members', { preHandler: [requireAuth] }, async (request, reply) => {
    // Verify membership
    const member = await queryOne(
      'SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2',
      [request.params.id, request.user.sub]
    );
    if (!member) return reply.code(403).send({ error: 'Not a member of this server' });

    const result = await query<ServerMemberWithUser>(
      `SELECT sm.server_id, sm.user_id, sm.role, sm.nickname, sm.joined_at,
              u.username, u.first_name, u.avatar_url, u.status
       FROM server_members sm
       JOIN users u ON u.id = sm.user_id
       WHERE sm.server_id = $1
       ORDER BY sm.role DESC, u.username`,
      [request.params.id]
    );
    return result.rows;
  });

  // Get channels for a server
  app.get<{ Params: { id: string } }>('/api/servers/:id/channels', { preHandler: [requireAuth] }, async (request, reply) => {
    const member = await queryOne(
      'SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2',
      [request.params.id, request.user.sub]
    );
    if (!member) return reply.code(403).send({ error: 'Not a member of this server' });

    const result = await query<Channel>(
      'SELECT * FROM channels WHERE server_id = $1 ORDER BY position, created_at',
      [request.params.id]
    );
    return result.rows;
  });

  // Create channel (server admin only)
  app.post<{ Params: { id: string }; Body: { name: string; type: string } }>('/api/servers/:id/channels', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const member = await queryOne<{ role: string }>(
      'SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2',
      [request.params.id, request.user.sub]
    );
    if (!member || member.role !== 'admin') {
      return reply.code(403).send({ error: 'Only server admins can create channels' });
    }

    const { name, type } = request.body;
    const nameError = validateChannelName(name);
    if (nameError) return reply.code(400).send({ error: nameError });
    if (type !== 'text' && type !== 'voice') {
      return reply.code(400).send({ error: 'Channel type must be text or voice' });
    }

    // Get next position
    const posResult = await queryOne<{ max: number }>(
      'SELECT COALESCE(MAX(position), -1) as max FROM channels WHERE server_id = $1',
      [request.params.id]
    );

    const channel = await queryOne<Channel>(
      'INSERT INTO channels (server_id, name, type, position) VALUES ($1, $2, $3, $4) RETURNING *',
      [request.params.id, name, type, (posResult?.max ?? -1) + 1]
    );

    return reply.code(201).send(channel);
  });

  // Rename channel
  app.patch<{ Params: { id: string; channelId: string }; Body: { name: string } }>(
    '/api/servers/:id/channels/:channelId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const member = await queryOne<{ role: string }>(
        'SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2',
        [request.params.id, request.user.sub]
      );
      if (!member || member.role !== 'admin') {
        return reply.code(403).send({ error: 'Only server admins can rename channels' });
      }

      const nameError = validateChannelName(request.body.name);
      if (nameError) return reply.code(400).send({ error: nameError });

      const channel = await queryOne<Channel>(
        'UPDATE channels SET name = $1 WHERE id = $2 AND server_id = $3 RETURNING *',
        [request.body.name, request.params.channelId, request.params.id]
      );
      if (!channel) return reply.code(404).send({ error: 'Channel not found' });
      return channel;
    }
  );

  // Delete channel
  app.delete<{ Params: { id: string; channelId: string } }>(
    '/api/servers/:id/channels/:channelId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const member = await queryOne<{ role: string }>(
        'SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2',
        [request.params.id, request.user.sub]
      );
      if (!member || member.role !== 'admin') {
        return reply.code(403).send({ error: 'Only server admins can delete channels' });
      }

      const result = await query(
        'DELETE FROM channels WHERE id = $1 AND server_id = $2',
        [request.params.channelId, request.params.id]
      );
      if (result.rowCount === 0) return reply.code(404).send({ error: 'Channel not found' });
      return { success: true };
    }
  );

  // Kick member
  app.delete<{ Params: { id: string; userId: string } }>(
    '/api/servers/:id/members/:userId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const member = await queryOne<{ role: string }>(
        'SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2',
        [request.params.id, request.user.sub]
      );
      if (!member || member.role !== 'admin') {
        return reply.code(403).send({ error: 'Only server admins can kick members' });
      }

      if (request.params.userId === request.user.sub) {
        return reply.code(400).send({ error: 'Cannot kick yourself' });
      }

      await query(
        'DELETE FROM server_members WHERE server_id = $1 AND user_id = $2',
        [request.params.id, request.params.userId]
      );
      return { success: true };
    }
  );

  // Ban member
  app.post<{ Params: { id: string; userId: string }; Body: { reason?: string } }>(
    '/api/servers/:id/bans/:userId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const member = await queryOne<{ role: string }>(
        'SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2',
        [request.params.id, request.user.sub]
      );
      if (!member || member.role !== 'admin') {
        return reply.code(403).send({ error: 'Only server admins can ban members' });
      }

      if (request.params.userId === request.user.sub) {
        return reply.code(400).send({ error: 'Cannot ban yourself' });
      }

      // Remove from server and add ban
      await query('DELETE FROM server_members WHERE server_id = $1 AND user_id = $2', [request.params.id, request.params.userId]);
      await query(
        'INSERT INTO bans (server_id, user_id, reason, banned_by) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [request.params.id, request.params.userId, request.body.reason || null, request.user.sub]
      );
      return { success: true };
    }
  );

  // Rename server
  app.patch<{ Params: { id: string }; Body: { name: string } }>(
    '/api/servers/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const member = await queryOne<{ role: string }>(
        'SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2',
        [request.params.id, request.user.sub]
      );
      if (!member || member.role !== 'admin') {
        return reply.code(403).send({ error: 'Only server admins can rename the server' });
      }

      const nameError = validateServerName(request.body.name);
      if (nameError) return reply.code(400).send({ error: nameError });

      const server = await queryOne<Server>(
        'UPDATE servers SET name = $1 WHERE id = $2 RETURNING *',
        [request.body.name.trim(), request.params.id]
      );
      return server;
    }
  );
}
