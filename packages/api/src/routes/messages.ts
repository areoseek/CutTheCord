import { FastifyInstance } from 'fastify';
import { query, queryOne } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { validateMessageContent, MESSAGES_PER_PAGE, sanitizeHtml } from '@ctc/shared';
import type { Message, PaginatedResponse } from '@ctc/shared';
import { getIO } from '../socket/io.js';

export async function messageRoutes(app: FastifyInstance): Promise<void> {
  // Get messages (cursor-based pagination)
  app.get<{ Params: { channelId: string }; Querystring: { cursor?: string; limit?: string } }>(
    '/api/channels/:channelId/messages',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      // Verify channel membership via server
      const access = await queryOne(
        `SELECT 1 FROM channels c
         JOIN server_members sm ON sm.server_id = c.server_id
         WHERE c.id = $1 AND sm.user_id = $2`,
        [request.params.channelId, request.user.sub]
      );
      if (!access) return reply.code(403).send({ error: 'No access to this channel' });

      const limit = Math.min(parseInt(request.query.limit || String(MESSAGES_PER_PAGE), 10), 100);
      const cursor = request.query.cursor;

      let rows: Message[];
      if (cursor) {
        const result = await query<Message>(
          `SELECT m.id, m.channel_id, m.author_id, m.content, m.edited_at, m.created_at,
                  u.username as author_username, u.avatar_url as author_avatar_url
           FROM messages m
           JOIN users u ON u.id = m.author_id
           WHERE m.channel_id = $1 AND m.created_at < (SELECT created_at FROM messages WHERE id = $2)
           ORDER BY m.created_at DESC
           LIMIT $3`,
          [request.params.channelId, cursor, limit + 1]
        );
        rows = result.rows;
      } else {
        const result = await query<Message>(
          `SELECT m.id, m.channel_id, m.author_id, m.content, m.edited_at, m.created_at,
                  u.username as author_username, u.avatar_url as author_avatar_url
           FROM messages m
           JOIN users u ON u.id = m.author_id
           WHERE m.channel_id = $1
           ORDER BY m.created_at DESC
           LIMIT $2`,
          [request.params.channelId, limit + 1]
        );
        rows = result.rows;
      }

      const hasMore = rows.length > limit;
      if (hasMore) rows.pop();

      const response: PaginatedResponse<Message> = {
        items: rows.reverse(), // oldest first for display
        next_cursor: hasMore ? rows[0]?.id ?? null : null,
        has_more: hasMore,
      };

      return response;
    }
  );

  // Send message
  app.post<{ Params: { channelId: string }; Body: { content: string } }>(
    '/api/channels/:channelId/messages',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const access = await queryOne(
        `SELECT 1 FROM channels c
         JOIN server_members sm ON sm.server_id = c.server_id
         WHERE c.id = $1 AND sm.user_id = $2`,
        [request.params.channelId, request.user.sub]
      );
      if (!access) return reply.code(403).send({ error: 'No access to this channel' });

      const contentError = validateMessageContent(request.body.content);
      if (contentError) return reply.code(400).send({ error: contentError });

      const sanitized = sanitizeHtml(request.body.content.trim());

      const message = await queryOne<Message>(
        `WITH inserted AS (
           INSERT INTO messages (channel_id, author_id, content)
           VALUES ($1, $2, $3)
           RETURNING *
         )
         SELECT i.*, u.username as author_username, u.avatar_url as author_avatar_url
         FROM inserted i
         JOIN users u ON u.id = i.author_id`,
        [request.params.channelId, request.user.sub, sanitized]
      );

      if (message) {
        // Get server_id for broadcasting
        const channel = await queryOne<{ server_id: string }>(
          'SELECT server_id FROM channels WHERE id = $1',
          [request.params.channelId]
        );
        if (channel) {
          getIO().to(`server:${channel.server_id}`).emit('new-message', message);
        }
      }

      return reply.code(201).send(message);
    }
  );

  // Edit message
  app.patch<{ Params: { channelId: string; messageId: string }; Body: { content: string } }>(
    '/api/channels/:channelId/messages/:messageId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const contentError = validateMessageContent(request.body.content);
      if (contentError) return reply.code(400).send({ error: contentError });

      const sanitized = sanitizeHtml(request.body.content.trim());

      const message = await queryOne<Message>(
        `UPDATE messages SET content = $1, edited_at = now()
         WHERE id = $2 AND channel_id = $3 AND author_id = $4
         RETURNING *`,
        [sanitized, request.params.messageId, request.params.channelId, request.user.sub]
      );
      if (!message) return reply.code(404).send({ error: 'Message not found or not yours' });

      const channel = await queryOne<{ server_id: string }>(
        'SELECT server_id FROM channels WHERE id = $1',
        [request.params.channelId]
      );
      if (channel) {
        getIO().to(`server:${channel.server_id}`).emit('message-edited', message);
      }

      return message;
    }
  );

  // Delete message
  app.delete<{ Params: { channelId: string; messageId: string } }>(
    '/api/channels/:channelId/messages/:messageId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      // Allow author or server admin
      const result = await query(
        `DELETE FROM messages
         WHERE id = $1 AND channel_id = $2
         AND (author_id = $3 OR EXISTS (
           SELECT 1 FROM channels c
           JOIN server_members sm ON sm.server_id = c.server_id
           WHERE c.id = $2 AND sm.user_id = $3 AND sm.role = 'admin'
         ))`,
        [request.params.messageId, request.params.channelId, request.user.sub]
      );
      if (result.rowCount === 0) return reply.code(404).send({ error: 'Message not found' });

      const channel = await queryOne<{ server_id: string }>(
        'SELECT server_id FROM channels WHERE id = $1',
        [request.params.channelId]
      );
      if (channel) {
        getIO().to(`server:${channel.server_id}`).emit('message-deleted', { id: request.params.messageId, channel_id: request.params.channelId });
      }

      return { success: true };
    }
  );
}
