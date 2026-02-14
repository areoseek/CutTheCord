function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env.API_PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  database: {
    url: required('DATABASE_URL'),
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    secret: required('JWT_SECRET'),
    expiry: '7d' as const,
  },
  livekit: {
    apiKey: required('LIVEKIT_API_KEY'),
    apiSecret: required('LIVEKIT_API_SECRET'),
    url: required('LIVEKIT_URL'),
  },
};
