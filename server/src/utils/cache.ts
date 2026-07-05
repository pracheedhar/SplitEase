import { createClient } from 'redis';
import { logger } from './logger.js';

let redisClient: ReturnType<typeof createClient> | null = null;

export const getRedisClient = async () => {
  if (redisClient && redisClient.isOpen) return redisClient;

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn('REDIS_URL not defined — caching disabled');
    return null;
  }

  try {
    redisClient = createClient({ url });
    redisClient.on('error', (err) => logger.error(`Redis error: ${err.message}`));
    redisClient.on('connect', () => logger.info('Redis connected'));
    await redisClient.connect();
    return redisClient;
  } catch (err: any) {
    logger.warn(`Redis connection failed: ${err.message}. Caching disabled.`);
    return null;
  }
};

export const cacheGet = async (key: string): Promise<string | null> => {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    return await client.get(key);
  } catch {
    return null;
  }
};

export const cacheSet = async (key: string, value: string, ttlSeconds: number): Promise<void> => {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.setEx(key, ttlSeconds, value);
  } catch (err: any) {
    logger.warn(`Redis set failed: ${err.message}`);
  }
};

export const cacheDel = async (key: string): Promise<void> => {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.del(key);
  } catch {}
};
