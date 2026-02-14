import { FastifyInstance } from 'fastify';
import { pool } from '../index.js';
import { validateServerName } from '@ctc/shared';
import type { Server, CreateServerRequest } from '@ctc/shared';

export async function serverRoutes(app: FastifyInstance): Promise<void> {
  // List all servers
  app.get('/admin/servers', async () => {
    const result = await pool.query<Server & { member_count: number }>(
      `SELECT s.*, (SELECT COUNT(*) FROM server_members WHERE server_id = s.id)::int as member_count
       FROM servers s ORDER BY s.name`
    );
    return result.rows;
  });

  // Get single server with members
  app.get<{ Params: { id: string } }>('/admin/servers/:id', async (request, reply) => {
    const server = await pool.query<Server>(
      'SELECT * FROM servers WHERE id = $1',
      [request.params.id]
    );
    if (server.rows.length === 0) return reply.code(404).send({ error: 'Server not found' });

    const members = await pool.query(
      `SELECT sm.*, u.username FROM server_members sm
       JOIN users u ON u.id = sm.user_id
       WHERE sm.server_id = $1
       ORDER BY sm.role DESC, u.username`,
      [request.params.id]
    );

    const channels = await pool.query(
      'SELECT * FROM channels WHERE server_id = $1 ORDER BY position',
      [request.params.id]
    );

    return { ...server.rows[0], members: members.rows, channels: channels.rows };
  });

  // Create server
  app.post<{ Body: CreateServerRequest }>('/admin/servers', async (request, reply) => {
    const { name, owner_id } = request.body;

    const nameError = validateServerName(name);
    if (nameError) return reply.code(400).send({ error: nameError });

    // Verify owner exists
    const owner = await pool.query('SELECT 1 FROM users WHERE id = $1', [owner_id]);
    if (owner.rows.length === 0) return reply.code(400).send({ error: 'Owner user not found' });

    // Create server + add owner as admin + create default channels
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const serverResult = await client.query<Server>(
        'INSERT INTO servers (name, created_by) VALUES ($1, $2) RETURNING *',
        [name.trim(), owner_id]
      );
      const server = serverResult.rows[0];

      await client.query(
        "INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, 'admin')",
        [server.id, owner_id]
      );

      await client.query(
        "INSERT INTO channels (server_id, name, type, position) VALUES ($1, 'general', 'text', 0)",
        [server.id]
      );
      await client.query(
        "INSERT INTO channels (server_id, name, type, position) VALUES ($1, 'voice', 'voice', 1)",
        [server.id]
      );

      await client.query('COMMIT');
      return reply.code(201).send(server);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Update server
  app.patch<{ Params: { id: string }; Body: { name?: string } }>(
    '/admin/servers/:id',
    async (request, reply) => {
      if (!request.body.name) return reply.code(400).send({ error: 'Name is required' });

      const nameError = validateServerName(request.body.name);
      if (nameError) return reply.code(400).send({ error: nameError });

      const result = await pool.query<Server>(
        'UPDATE servers SET name = $1 WHERE id = $2 RETURNING *',
        [request.body.name.trim(), request.params.id]
      );
      if (result.rows.length === 0) return reply.code(404).send({ error: 'Server not found' });
      return result.rows[0];
    }
  );

  // Delete server
  app.delete<{ Params: { id: string } }>('/admin/servers/:id', async (request, reply) => {
    const result = await pool.query('DELETE FROM servers WHERE id = $1', [request.params.id]);
    if (result.rowCount === 0) return reply.code(404).send({ error: 'Server not found' });
    return { success: true };
  });

  // Assign server admin role
  app.post<{ Body: { user_id: string; server_id: string } }>('/admin/assign-admin', async (request, reply) => {
    const { user_id, server_id } = request.body;

    // Check if member exists
    const member = await pool.query(
      'SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2',
      [server_id, user_id]
    );

    if (member.rows.length === 0) {
      // Add as admin member
      await pool.query(
        "INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, 'admin')",
        [server_id, user_id]
      );
    } else {
      // Update to admin
      await pool.query(
        "UPDATE server_members SET role = 'admin' WHERE server_id = $1 AND user_id = $2",
        [server_id, user_id]
      );
    }

    return { success: true };
  });

  // Add member to server
  app.post<{ Params: { id: string }; Body: { user_id: string; role?: string } }>(
    '/admin/servers/:id/members',
    async (request, reply) => {
      const { user_id, role } = request.body;

      const user = await pool.query('SELECT 1 FROM users WHERE id = $1', [user_id]);
      if (user.rows.length === 0) return reply.code(400).send({ error: 'User not found' });

      const existing = await pool.query(
        'SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2',
        [request.params.id, user_id]
      );
      if (existing.rows.length > 0) return reply.code(409).send({ error: 'User already a member' });

      await pool.query(
        'INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, $3)',
        [request.params.id, user_id, role || 'member']
      );
      return reply.code(201).send({ success: true });
    }
  );
}
