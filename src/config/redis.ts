import { LogEngine } from '@wgtechlabs/log-engine';
import Redis from 'ioredis';

let redisClient: Redis | null = null;
let statsEnabled = false;

export async function initRedis(): Promise<void> {
  const enableStats = process.env.ENABLE_STATS === 'true';
  const redisUrl = process.env.REDIS_URL;

  if (!enableStats) {
    LogEngine.info('Stats tracking: DISABLED (privacy-first default)');
    statsEnabled = false;
    return;
  }

  if (!redisUrl) {
    LogEngine.warn(
      'Stats tracking enabled but REDIS_URL not configured. Stats will be disabled.',
    );
    statsEnabled = false;
    return;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          LogEngine.error(
            'Redis connection failed after 3 retries. Stats tracking disabled.',
          );
          return null;
        }
        const delay = Math.min(times * 100, 2000);
        return delay;
      },
      reconnectOnError(err) {
        LogEngine.error('Redis connection error:', err.message);
        return false;
      },
    });

    await redisClient.ping();
    statsEnabled = true;
    LogEngine.info('Stats tracking: ENABLED');
  } catch (error) {
    LogEngine.error(
      'Redis connection failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    LogEngine.info('Stats tracking: DISABLED');
    statsEnabled = false;
    if (redisClient) {
      await redisClient.quit().catch(() => {});
    }
    redisClient = null;
  }
}

export function getRedis(): Redis | null {
  return redisClient;
}

export function isStatsEnabled(): boolean {
  return statsEnabled && redisClient !== null;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
    statsEnabled = false;
  }
}
