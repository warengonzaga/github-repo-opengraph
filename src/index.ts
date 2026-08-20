import 'dotenv/config';
import { createRequire } from 'node:module';
import { serve } from '@hono/node-server';
import { LogEngine, LogMode } from '@wgtechlabs/log-engine';
import { Hono } from 'hono';
import { initRedis, isStatsEnabled } from './config/redis.js';
import ogRoute from './routes/og.js';
import statsRoute from './routes/stats.js';
import uiRoute from './routes/ui.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const env = process.env.NODE_ENV || 'development';
LogEngine.configure({
  mode: env === 'production' ? LogMode.INFO : LogMode.DEBUG,
});

const app = new Hono();

app.get('/health', (c) => {
  const health: {
    status: string;
    timestamp: string;
    stats: {
      enabled: boolean;
      endpoint?: string;
    };
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    stats: {
      enabled: isStatsEnabled(),
    },
  };

  if (isStatsEnabled()) {
    health.stats.endpoint = '/stats';
  }

  return c.json(health);
});

app.route('/', uiRoute);
app.route('/', ogRoute);
app.route('/', statsRoute);

const port = parseInt(process.env.PORT || '3000', 10);

await initRedis();

serve({ fetch: app.fetch, port }, (info) => {
  LogEngine.info('='.repeat(50));
  LogEngine.info('GitHub Repo Opengraph Service');
  LogEngine.info(`📦 Version: ${version}`);
  LogEngine.info('👤 Author: Waren Gonzaga');
  LogEngine.info('='.repeat(50));
  LogEngine.info(`🚀 Server: http://localhost:${info.port}`);
  LogEngine.info(
    `📊 Stats: ${isStatsEnabled() ? 'Enabled (/stats)' : 'Disabled'}`,
  );
  LogEngine.info('='.repeat(50));
});
