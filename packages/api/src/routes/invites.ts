import { FastifyInstance } from 'fastify';
import { query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { nanoid } from 'nanoid';
import { INVITE_CODE_LENGTH } from '@ctc/shared';
import type { Invite } from '@ctc/shared';

export async function inviteRoutes(app: FastifyInstance): Promise<void> {
  // Create invite (server admin only)
  app.post<{ Params: { id: string }; Body: { max_uses?: number; expires_hours?: number } }>(
    '/api/servers/:id/invites',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const member = await queryOne<{ role: string }>(
        'SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2',
        [request.params.id, request.user.sub]
      );
      if (!member || member.role !== 'admin') {
        return reply.code(403).send({ error: 'Only server admins can create invites' });
      }

      const code = nanoid(INVITE_CODE_LENGTH);
      const expiresAt = request.body.expires_hours
        ? new Date(Date.now() + request.body.expires_hours * 3600000).toISOString()
        : null;

      const invite = await queryOne<Invite>(
        `INSERT INTO invites (code, server_id, created_by, max_uses, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [code, request.params.id, request.user.sub, request.body.max_uses || null, expiresAt]
      );

      return reply.code(201).send(invite);
    }
  );

  // List invites for a server
  app.get<{ Params: { id: string } }>(
    '/api/servers/:id/invites',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const member = await queryOne<{ role: string }>(
        'SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2',
        [request.params.id, request.user.sub]
      );
      if (!member || member.role !== 'admin') {
        return reply.code(403).send({ error: 'Only server admins can view invites' });
      }

      const result = await query<Invite>(
        'SELECT * FROM invites WHERE server_id = $1 ORDER BY created_at DESC',
        [request.params.id]
      );
      return result.rows;
    }
  );

  // Resolve invite (public, returns server info)
  app.get<{ Params: { code: string } }>('/api/invites/:code', async (request, reply) => {
    const invite = await queryOne<Invite & { server_name: string }>(
      `SELECT i.*, s.name as server_name
       FROM invites i
       JOIN servers s ON s.id = i.server_id
       WHERE i.code = $1`,
      [request.params.code]
    );

    if (!invite) return reply.code(404).send({ error: 'Invite not found' });

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return reply.code(410).send({ error: 'Invite has expired' });
    }
    if (invite.max_uses && invite.use_count >= invite.max_uses) {
      return reply.code(410).send({ error: 'Invite has reached max uses' });
    }

    return { code: invite.code, server_id: invite.server_id, server_name: invite.server_name };
  });

  // Accept invite
  app.post<{ Params: { code: string } }>('/api/invites/:code/accept', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const invite = await queryOne<Invite>(
      'SELECT * FROM invites WHERE code = $1',
      [request.params.code]
    );

    if (!invite) return reply.code(404).send({ error: 'Invite not found' });
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return reply.code(410).send({ error: 'Invite has expired' });
    }
    if (invite.max_uses && invite.use_count >= invite.max_uses) {
      return reply.code(410).send({ error: 'Invite has reached max uses' });
    }

    // Check if banned
    const banned = await queryOne(
      'SELECT 1 FROM bans WHERE server_id = $1 AND user_id = $2',
      [invite.server_id, request.user.sub]
    );
    if (banned) return reply.code(403).send({ error: 'You are banned from this server' });

    // Check if already a member
    const existing = await queryOne(
      'SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2',
      [invite.server_id, request.user.sub]
    );
    if (existing) return reply.code(409).send({ error: 'Already a member of this server' });

    // Join server
    await query(
      'INSERT INTO server_members (server_id, user_id) VALUES ($1, $2)',
      [invite.server_id, request.user.sub]
    );
    // One-time use: delete invite after accept
    await query('DELETE FROM invites WHERE code = $1', [request.params.code]);

    return { success: true, server_id: invite.server_id };
  });

  // Decline invite (destroys the link)
  app.post<{ Params: { code: string } }>('/api/invites/:code/decline', async (request, reply) => {
    const result = await query('DELETE FROM invites WHERE code = $1', [request.params.code]);
    if (result.rowCount === 0) return reply.code(404).send({ error: 'Invite not found' });
    return { success: true };
  });

  // Delete invite
  app.delete<{ Params: { id: string; code: string } }>(
    '/api/servers/:id/invites/:code',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const member = await queryOne<{ role: string }>(
        'SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2',
        [request.params.id, request.user.sub]
      );
      if (!member || member.role !== 'admin') {
        return reply.code(403).send({ error: 'Only server admins can delete invites' });
      }

      await query('DELETE FROM invites WHERE code = $1 AND server_id = $2', [request.params.code, request.params.id]);
      return { success: true };
    }
  );
}
