import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { query, queryOne } from '../db.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validateUsername, validatePassword, validateFirstName, BCRYPT_ROUNDS } from '@ctc/shared';
import type { User, LoginRequest, ChangePasswordRequest, RegisterRequest } from '@ctc/shared';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Auto-migrate: add first_name column if missing
  await query(`
    DO $$ BEGIN
      ALTER TABLE users ADD COLUMN first_name VARCHAR(50) NOT NULL DEFAULT '';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;
  `);

  // Register (public)
  app.post<{ Body: RegisterRequest }>('/api/auth/register', async (request, reply) => {
    const { first_name, username, password, confirm_password } = request.body;
    if (!first_name || !username || !password || !confirm_password) {
      return reply.code(400).send({ error: 'All fields are required' });
    }

    const fnError = validateFirstName(first_name);
    if (fnError) return reply.code(400).send({ error: fnError });

    const unError = validateUsername(username);
    if (unError) return reply.code(400).send({ error: unError });

    const pwError = validatePassword(password);
    if (pwError) return reply.code(400).send({ error: pwError });

    if (password !== confirm_password) {
      return reply.code(400).send({ error: 'Passwords do not match' });
    }

    // Check username taken
    const existing = await queryOne('SELECT 1 FROM users WHERE username = $1', [username]);
    if (existing) {
      return reply.code(409).send({ error: 'Username is already taken' });
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const row = await queryOne<User>(
      `INSERT INTO users (username, first_name, password_hash, must_change_pw)
       VALUES ($1, $2, $3, false)
       RETURNING id, username, first_name, must_change_pw, is_global_admin, avatar_url, status, created_at`,
      [username, first_name.trim(), hash]
    );

    const token = signToken({
      sub: row!.id,
      username: row!.username,
      is_global_admin: row!.is_global_admin,
    });

    return reply.code(201).send({ token, user: row, must_change_pw: false });
  });

  // Login
  app.post<{ Body: LoginRequest }>('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body;
    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password are required' });
    }

    const row = await queryOne<{ id: string; username: string; first_name: string; password_hash: string; must_change_pw: boolean; is_global_admin: boolean; avatar_url: string | null; status: string; created_at: string }>(
      'SELECT id, username, first_name, password_hash, must_change_pw, is_global_admin, avatar_url, status, created_at FROM users WHERE username = $1',
      [username]
    );

    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      return reply.code(401).send({ error: 'Invalid username or password' });
    }

    const token = signToken({
      sub: row.id,
      username: row.username,
      is_global_admin: row.is_global_admin,
    });

    const user: User = {
      id: row.id,
      username: row.username,
      first_name: row.first_name,
      must_change_pw: row.must_change_pw,
      is_global_admin: row.is_global_admin,
      avatar_url: row.avatar_url,
      status: row.status as User['status'],
      created_at: row.created_at,
    };

    return { token, user, must_change_pw: row.must_change_pw };
  });

  // Change password
  app.post<{ Body: ChangePasswordRequest }>('/api/auth/change-password', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const { current_password, new_password } = request.body;

    const pwError = validatePassword(new_password);
    if (pwError) return reply.code(400).send({ error: pwError });

    const row = await queryOne<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [request.user.sub]
    );

    if (!row || !(await bcrypt.compare(current_password, row.password_hash))) {
      return reply.code(400).send({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    await query(
      'UPDATE users SET password_hash = $1, must_change_pw = false WHERE id = $2',
      [hash, request.user.sub]
    );

    return { success: true };
  });

  // Logout (client-side token discard; could add Redis blacklist later)
  app.post('/api/auth/logout', {
    preHandler: [requireAuth],
  }, async () => {
    return { success: true };
  });

  // Get current user
  app.get('/api/auth/me', {
    preHandler: [requireAuth],
  }, async (request) => {
    const row = await queryOne<User>(
      'SELECT id, username, first_name, must_change_pw, is_global_admin, avatar_url, status, created_at FROM users WHERE id = $1',
      [request.user.sub]
    );
    return row;
  });
}
