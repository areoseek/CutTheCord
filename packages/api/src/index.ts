import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { pool, runMigrations } from './db.js';
import { redis } from './redis.js';
import { authRoutes } from './routes/auth.js';
import { serverRoutes } from './routes/servers.js';
import { messageRoutes } from './routes/messages.js';
import { inviteRoutes } from './routes/invites.js';
import { voiceRoutes } from './routes/voice.js';
import { uploadRoutes } from './routes/uploads.js';
import { setupSocket } from './socket/index.js';

async function main() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  // Plugins
  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });

  // Health check
  app.get('/api/health', async () => {
    const dbOk = await pool.query('SELECT 1').then(() => true).catch(() => false);
    const redisOk = await redis.ping().then(() => true).catch(() => false);
    return {
      status: dbOk && redisOk ? 'ok' : 'degraded',
      db: dbOk,
      redis: redisOk,
      timestamp: new Date().toISOString(),
    };
  });

  // Run database migrations
  await runMigrations();

  // Routes
  await app.register(authRoutes);
  await app.register(serverRoutes);
  await app.register(messageRoutes);
  await app.register(inviteRoutes);
  await app.register(voiceRoutes);
  await app.register(uploadRoutes);

  // Start Fastify
  await app.listen({ port: config.port, host: config.host });

  // Attach Socket.IO to the underlying Node HTTP server
  const httpServer = app.server;
  setupSocket(httpServer);

  console.log(`CutTheCord API listening on ${config.host}:${config.port}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    await app.close();
    await pool.end();
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
