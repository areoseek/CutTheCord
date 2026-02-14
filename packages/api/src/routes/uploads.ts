import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { query, queryOne } from '../db.js';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { nanoid } from 'nanoid';

const UPLOAD_DIR = '/app/uploads/avatars';
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  // Ensure upload directory exists
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  // Upload avatar
  app.post('/api/users/avatar', {
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    if (!ALLOWED_TYPES.includes(data.mimetype)) {
      return reply.code(400).send({ error: 'Invalid file type. Allowed: PNG, JPEG, WebP, GIF' });
    }

    const buffer = await data.toBuffer();

    // Limit file size (5MB)
    if (buffer.length > 5 * 1024 * 1024) {
      return reply.code(400).send({ error: 'File too large. Maximum 5MB' });
    }

    // Resize to 256x256
    const resized = await sharp(buffer)
      .resize(256, 256, { fit: 'cover' })
      .png()
      .toBuffer();

    // Delete old avatar if exists
    const oldUser = await queryOne<{ avatar_url: string | null }>(
      'SELECT avatar_url FROM users WHERE id = $1',
      [request.user.sub]
    );
    if (oldUser?.avatar_url) {
      const oldFilename = oldUser.avatar_url.split('/').pop();
      if (oldFilename) {
        await fs.unlink(path.join(UPLOAD_DIR, oldFilename)).catch(() => {});
      }
    }

    const filename = `${nanoid()}.png`;
    await fs.writeFile(path.join(UPLOAD_DIR, filename), resized);

    const avatarUrl = `/api/uploads/avatars/${filename}`;
    await query(
      'UPDATE users SET avatar_url = $1 WHERE id = $2',
      [avatarUrl, request.user.sub]
    );

    return { avatar_url: avatarUrl };
  });

  // Serve avatar files
  app.get<{ Params: { filename: string } }>('/api/uploads/avatars/:filename', async (request, reply) => {
    const { filename } = request.params;

    // Sanitize filename
    if (filename.includes('..') || filename.includes('/')) {
      return reply.code(400).send({ error: 'Invalid filename' });
    }

    const filePath = path.join(UPLOAD_DIR, filename);
    try {
      const data = await fs.readFile(filePath);
      return reply
        .header('Content-Type', 'image/png')
        .header('Cache-Control', 'public, max-age=86400')
        .send(data);
    } catch {
      return reply.code(404).send({ error: 'Not found' });
    }
  });

  // Delete avatar
  app.delete('/api/users/avatar', {
    preHandler: [requireAuth],
  }, async (request) => {
    const user = await queryOne<{ avatar_url: string | null }>(
      'SELECT avatar_url FROM users WHERE id = $1',
      [request.user.sub]
    );

    if (user?.avatar_url) {
      const filename = user.avatar_url.split('/').pop();
      if (filename) {
        await fs.unlink(path.join(UPLOAD_DIR, filename)).catch(() => {});
      }
    }

    await query(
      'UPDATE users SET avatar_url = NULL WHERE id = $1',
      [request.user.sub]
    );

    return { success: true };
  });
}
