import Fastify from 'fastify';
import cors from '@fastify/cors';
import pg from 'pg';
import { userRoutes } from './routes/users.js';
import { serverRoutes } from './routes/servers.js';

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export { pool };

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.get('/admin/health', async () => {
    const dbOk = await pool.query('SELECT 1').then(() => true).catch(() => false);
    return { status: dbOk ? 'ok' : 'error', db: dbOk };
  });

  await app.register(userRoutes);
  await app.register(serverRoutes);

  const port = parseInt(process.env.ADMIN_API_PORT || '4001', 10);
  const host = process.env.HOST || '0.0.0.0';

  await app.listen({ port, host });
  console.log(`Admin API listening on ${host}:${port}`);
}

main().catch((err) => {
  console.error('Admin API failed to start:', err);
  process.exit(1);
});
