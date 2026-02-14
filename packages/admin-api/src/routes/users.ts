import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { pool } from '../index.js';
import { validateUsername, validatePassword, BCRYPT_ROUNDS } from '@ctc/shared';
import type { User, CreateUserRequest } from '@ctc/shared';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // List all users
  app.get('/admin/users', async () => {
    const result = await pool.query<User>(
      'SELECT id, username, first_name, must_change_pw, is_global_admin, avatar_url, status, created_at FROM users ORDER BY username'
    );
    return result.rows;
  });

  // Get single user
  app.get<{ Params: { id: string } }>('/admin/users/:id', async (request, reply) => {
    const result = await pool.query<User>(
      'SELECT id, username, first_name, must_change_pw, is_global_admin, avatar_url, status, created_at FROM users WHERE id = $1',
      [request.params.id]
    );
    if (result.rows.length === 0) return reply.code(404).send({ error: 'User not found' });
    return result.rows[0];
  });

  // Create user
  app.post<{ Body: CreateUserRequest }>('/admin/users', async (request, reply) => {
    const { username, password, is_global_admin } = request.body;

    const usernameError = validateUsername(username);
    if (usernameError) return reply.code(400).send({ error: usernameError });

    const passwordError = validatePassword(password);
    if (passwordError) return reply.code(400).send({ error: passwordError });

    // Check duplicate
    const existing = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) return reply.code(409).send({ error: 'Username already taken' });

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await pool.query<User>(
      `INSERT INTO users (username, password_hash, must_change_pw, is_global_admin)
       VALUES ($1, $2, true, $3)
       RETURNING id, username, first_name, must_change_pw, is_global_admin, avatar_url, status, created_at`,
      [username, hash, is_global_admin || false]
    );

    return reply.code(201).send(result.rows[0]);
  });

  // Update user
  app.patch<{ Params: { id: string }; Body: { username?: string; is_global_admin?: boolean } }>(
    '/admin/users/:id',
    async (request, reply) => {
      const { username, is_global_admin } = request.body;
      const updates: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      if (username !== undefined) {
        const usernameError = validateUsername(username);
        if (usernameError) return reply.code(400).send({ error: usernameError });
        updates.push(`username = $${paramIdx++}`);
        values.push(username);
      }
      if (is_global_admin !== undefined) {
        updates.push(`is_global_admin = $${paramIdx++}`);
        values.push(is_global_admin);
      }

      if (updates.length === 0) return reply.code(400).send({ error: 'No fields to update' });

      values.push(request.params.id);
      const result = await pool.query<User>(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx}
         RETURNING id, username, first_name, must_change_pw, is_global_admin, avatar_url, status, created_at`,
        values
      );

      if (result.rows.length === 0) return reply.code(404).send({ error: 'User not found' });
      return result.rows[0];
    }
  );

  // Reset password
  app.post<{ Params: { id: string }; Body: { password: string } }>(
    '/admin/users/:id/reset-password',
    async (request, reply) => {
      const { password } = request.body;
      const passwordError = validatePassword(password);
      if (passwordError) return reply.code(400).send({ error: passwordError });

      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const result = await pool.query(
        'UPDATE users SET password_hash = $1, must_change_pw = true WHERE id = $2',
        [hash, request.params.id]
      );

      if (result.rowCount === 0) return reply.code(404).send({ error: 'User not found' });
      return { success: true };
    }
  );

  // Delete user
  app.delete<{ Params: { id: string } }>('/admin/users/:id', async (request, reply) => {
    const result = await pool.query('DELETE FROM users WHERE id = $1', [request.params.id]);
    if (result.rowCount === 0) return reply.code(404).send({ error: 'User not found' });
    return { success: true };
  });
}
