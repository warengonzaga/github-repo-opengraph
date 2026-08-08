import { LogEngine } from '@wgtechlabs/log-engine';
import { Hono } from 'hono';
import { getRedis, isStatsEnabled } from '../config/redis.js';
import { renderOGImage } from '../og/render.js';
import type { OGOptions } from '../og/types.js';
import {
  isSafeImageUrl,
  isValidHexColor,
  sanitizeHeader,
} from '../utils/sanitize.js';

const ogRoute = new Hono();

const DEFAULTS: Omit<OGOptions, 'theme'> & { theme: 'dark' | 'light' } = {
  logo: '/assets/devin_icon.png',
  logoText: 'Devin AI',
  badge: 'Discord Bot',
  badgeIcon: '/assets/discord.svg',
  title: 'to your Discord Server',
  highlight: 'Devin AI',
  description:
    'Launch coding sessions with a mention or slash command, collaborate in dedicated threads, and handle PRs, tests, and bug fixes without leaving your channels.',
  pills: [
    'Slash Commands',
    'Threaded Conversations',
    'Live Status Updates',
    'Template System',
  ],
  pillColors: ['blurple', 'fuchsia', 'green', 'yellow'],
  footerLogo: '/assets/wgtechlabs_icon.svg',
  footerText: '@wgtechlabs',
  footerTag: ['Open Source', 'Self-Hosted', 'TypeScript'],
  bg: '0b0d10',
  color: 'f2f3f5',
  theme: 'dark',
};

function parseList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function safeImageSource(raw: string, fallback: string): string {
  const value = sanitizeHeader(raw, 500);
  return isSafeImageUrl(value) ? value : fallback;
}

ogRoute.get('/og', async (c) => {
  // Stats tracking — same logic as the reference repo's banner route
  const referer = c.req.header('referer') || '';
  const repoMatch = referer.match(/github\.com\/([^/]+\/[^/]+)(?:\/|$)/);

  if (repoMatch && isStatsEnabled()) {
    const repo = repoMatch[1];
    const nonRepoPrefixes = [
      'settings',
      'orgs',
      'users',
      'explore',
      'notifications',
      'issues',
      'pulls',
    ];
    const isNonRepoPath = nonRepoPrefixes.some(
      (p) => repo.startsWith(`${p}/`) || repo === p,
    );

    if (!isNonRepoPath) {
      const redis = getRedis();
      redis
        ?.sadd('repos:tracked', repo)
        .then(() => {
          LogEngine.log(`📊 Repository using OG image: ${repo}`);
        })
        .catch(() => {});
    }
  }

  const rawLogo = c.req.query('logo') || DEFAULTS.logo;
  const rawLogoText = c.req.query('logo_text') || DEFAULTS.logoText;
  const rawBadge = c.req.query('badge') ?? DEFAULTS.badge;
  const rawBadgeIcon = c.req.query('badge_icon') ?? DEFAULTS.badgeIcon;
  const rawTitle = c.req.query('title') || DEFAULTS.title;
  const rawHighlight = c.req.query('highlight') || DEFAULTS.highlight;
  const rawDescription = c.req.query('description') || DEFAULTS.description;
  const rawPills = c.req.query('pills');
  const rawPillColors = c.req.query('pill_colors');
  const rawFooterLogo = c.req.query('footer_logo') || DEFAULTS.footerLogo;
  const rawFooterText = c.req.query('footer_text') || DEFAULTS.footerText;
  const rawFooterTag = c.req.query('footer_tag');
  const bgParam = c.req.query('bg') || DEFAULTS.bg;
  const colorParam = c.req.query('color') || DEFAULTS.color;
  const themeParam = c.req.query('theme') || DEFAULTS.theme;
  const downloadParam = c.req.query('download');

  const bg = isValidHexColor(bgParam) ? bgParam : DEFAULTS.bg;
  const color = isValidHexColor(colorParam) ? colorParam : DEFAULTS.color;
  const theme: 'dark' | 'light' = themeParam === 'light' ? 'light' : 'dark';

  const options: OGOptions = {
    logo: safeImageSource(rawLogo, DEFAULTS.logo),
    logoText: sanitizeHeader(rawLogoText, 40),
    badge: rawBadge ? sanitizeHeader(rawBadge, 30) : '',
    badgeIcon: rawBadgeIcon
      ? safeImageSource(rawBadgeIcon, DEFAULTS.badgeIcon)
      : '',
    title: sanitizeHeader(rawTitle, 80),
    highlight: sanitizeHeader(rawHighlight, 40),
    description: sanitizeHeader(rawDescription, 200),
    pills: parseList(rawPills, DEFAULTS.pills).map((p) =>
      sanitizeHeader(p, 40),
    ),
    pillColors: parseList(rawPillColors, DEFAULTS.pillColors),
    footerLogo: safeImageSource(rawFooterLogo, DEFAULTS.footerLogo),
    footerText: sanitizeHeader(rawFooterText, 40),
    footerTag: parseList(rawFooterTag, DEFAULTS.footerTag).map((t) =>
      sanitizeHeader(t, 30),
    ),
    bg,
    color,
    theme,
  };

  const png = await renderOGImage(options);

  const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  const cacheControl = isDev
    ? 'no-cache, no-store, must-revalidate'
    : 'public, max-age=86400, s-maxage=86400';

  const headers: Record<string, string> = {
    'Content-Type': 'image/png',
    'Cache-Control': cacheControl,
  };

  if (downloadParam === 'true') {
    headers['Content-Disposition'] = 'attachment; filename="opengraph.png"';
  }

  return c.body(new Uint8Array(png), 200, headers);
});

export default ogRoute;
