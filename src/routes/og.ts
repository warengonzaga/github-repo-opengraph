import { LogEngine } from '@wgtechlabs/log-engine';
import { Hono } from 'hono';
import { getRedis, isStatsEnabled } from '../config/redis.js';
import { renderOGImage } from '../og/render.js';
import type {
  RepositoryOGOptions,
  Theme,
  WebsiteOGOptions,
} from '../og/types.js';
import {
  isSafeImageUrl,
  isValidHexColor,
  sanitizeHeader,
} from '../utils/sanitize.js';

const ogRoute = new Hono();

const DEFAULTS: Omit<RepositoryOGOptions, 'type'> = {
  projectLogo: '/assets/devin_icon.png',
  projectName: 'Devin AI',
  projectBadgeText: 'Discord Bot',
  projectBadgeIcon: '/assets/discord.svg',
  headline: '[highlight]OpenGraph[/highlight] images for GitHub repositories',
  description:
    'Launch coding sessions with a mention or slash command, collaborate in dedicated threads, and handle PRs, tests, and bug fixes without leaving your channels.',
  features: [
    'Slash Commands',
    'Threaded Conversations',
    'Live Status Updates',
    'Template System',
  ],
  featureColors: ['blurple', 'fuchsia', 'green', 'yellow'],
  publisherLogo: '/assets/wgtechlabs_icon.svg',
  publisherName: '@wgtechlabs',
  publisherTags: ['Open Source', 'Self-Hosted', 'TypeScript'],
  background: '0b0d10',
  textColor: 'f2f3f5',
  theme: 'dark',
};

const WEBSITE_DEFAULTS: WebsiteOGOptions = {
  type: 'website',
  headerTitle: '',
  headerSubtitle: '',
  mainImage: '/assets/devin_icon.png',
  mainImagePosition: 'right',
  heading: 'Build a better web presence',
  subheading: 'A focused personal website for your next project',
  description:
    'Show what you make, explain why it matters, and give visitors one clear place to continue.',
  footerText: '',
  url: 'https://example.com',
  urlIcon: '',
  urlIconMode: 'auto',
  urlIconPosition: 'left',
  background: '0b0d10',
  textColor: 'f2f3f5',
  theme: 'dark',
};

function optionalImageSource(raw: string): string {
  const value = sanitizeHeader(raw, 500);
  return value && isSafeImageUrl(value) ? value : '';
}

function websiteUrl(raw: string): string {
  try {
    const value = new URL(raw);
    return value.protocol === 'https:' || value.protocol === 'http:'
      ? value.toString()
      : WEBSITE_DEFAULTS.url;
  } catch {
    return WEBSITE_DEFAULTS.url;
  }
}

function websiteOptions(
  c: { req: { query(name: string): string | undefined } },
  type: 'website' | 'custom',
): WebsiteOGOptions {
  const theme: Theme = c.req.query('theme') === 'light' ? 'light' : 'dark';
  const background = c.req.query('background') ?? WEBSITE_DEFAULTS.background;
  const textColor = c.req.query('text_color') ?? WEBSITE_DEFAULTS.textColor;
  const iconMode = c.req.query('url_icon_mode');
  return {
    type,
    headerTitle: sanitizeHeader(
      c.req.query('header_title') ?? WEBSITE_DEFAULTS.headerTitle,
      500,
    ),
    headerSubtitle: sanitizeHeader(
      c.req.query('header_subtitle') ?? WEBSITE_DEFAULTS.headerSubtitle,
      500,
    ),
    mainImage: optionalImageSource(
      c.req.query('main_image') ?? WEBSITE_DEFAULTS.mainImage,
    ),
    mainImagePosition:
      c.req.query('main_image_position') === 'left' ? 'left' : 'right',
    heading: sanitizeHeader(
      c.req.query('heading') ?? WEBSITE_DEFAULTS.heading,
      500,
    ),
    subheading: sanitizeHeader(
      c.req.query('subheading') ?? WEBSITE_DEFAULTS.subheading,
      500,
    ),
    description: sanitizeHeader(
      c.req.query('description') ?? WEBSITE_DEFAULTS.description,
      500,
    ),
    footerText: sanitizeHeader(
      c.req.query('footer_text') ?? WEBSITE_DEFAULTS.footerText,
      500,
    ),
    url: websiteUrl(c.req.query('url') ?? WEBSITE_DEFAULTS.url),
    urlIcon: optionalImageSource(
      c.req.query('url_icon') ?? WEBSITE_DEFAULTS.urlIcon,
    ),
    urlIconMode:
      iconMode === 'custom' || iconMode === 'none' ? iconMode : 'auto',
    urlIconPosition:
      c.req.query('url_icon_position') === 'right' ? 'right' : 'left',
    background: isValidHexColor(background)
      ? background
      : WEBSITE_DEFAULTS.background,
    textColor: isValidHexColor(textColor)
      ? textColor
      : WEBSITE_DEFAULTS.textColor,
    theme,
  };
}

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

  const requestedType = c.req.query('og_type');
  if (requestedType === 'website' || requestedType === 'custom') {
    const png = await renderOGImage(websiteOptions(c, requestedType));
    const isDev =
      !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    const headers: Record<string, string> = {
      'Content-Type': 'image/png',
      'Cache-Control': isDev
        ? 'no-cache, no-store, must-revalidate'
        : 'public, max-age=86400, s-maxage=86400',
    };
    if (c.req.query('download') === 'true') {
      headers['Content-Disposition'] = 'attachment; filename="opengraph.png"';
    }
    return c.body(new Uint8Array(png), 200, headers);
  }

  const rawProjectLogo =
    c.req.query('project_logo') ||
    c.req.query('brand_logo') ||
    c.req.query('logo') ||
    DEFAULTS.projectLogo;
  const rawProjectName =
    c.req.query('project_name') ||
    c.req.query('brand_name') ||
    c.req.query('logo_text') ||
    DEFAULTS.projectName;
  const rawProjectBadgeText =
    c.req.query('project_badge_text') ??
    c.req.query('badge_text') ??
    c.req.query('badge') ??
    DEFAULTS.projectBadgeText;
  const rawProjectBadgeIcon =
    c.req.query('project_badge_icon') ??
    c.req.query('badge_icon') ??
    DEFAULTS.projectBadgeIcon;
  const rawHeadline = c.req.query('headline');
  const legacyTitle = c.req.query('title');
  const legacyHighlight = c.req.query('highlight');
  const legacyHeadline = [
    legacyHighlight
      ? `[highlight]${sanitizeHeader(legacyHighlight, 40)}[/highlight]`
      : '',
    legacyTitle ? sanitizeHeader(legacyTitle, 80) : '',
  ]
    .filter(Boolean)
    .join(' ');
  const headline = rawHeadline || legacyHeadline || DEFAULTS.headline;
  const rawDescription = c.req.query('description') || DEFAULTS.description;
  const rawFeatures = c.req.query('features') ?? c.req.query('pills');
  const rawFeatureColors =
    c.req.query('feature_colors') ?? c.req.query('pill_colors');
  const rawPublisherLogo =
    c.req.query('publisher_logo') ||
    c.req.query('footer_logo') ||
    DEFAULTS.publisherLogo;
  const rawPublisherName =
    c.req.query('publisher_name') ||
    c.req.query('footer_text') ||
    DEFAULTS.publisherName;
  const rawPublisherTags =
    c.req.query('publisher_tags') ?? c.req.query('footer_tag');
  const backgroundParam =
    c.req.query('background') || c.req.query('bg') || DEFAULTS.background;
  const textColorParam =
    c.req.query('text_color') || c.req.query('color') || DEFAULTS.textColor;
  const themeParam = c.req.query('theme') || DEFAULTS.theme;
  const downloadParam = c.req.query('download');

  const background = isValidHexColor(backgroundParam)
    ? backgroundParam
    : DEFAULTS.background;
  const textColor = isValidHexColor(textColorParam)
    ? textColorParam
    : DEFAULTS.textColor;
  const theme: 'dark' | 'light' = themeParam === 'light' ? 'light' : 'dark';

  const options: RepositoryOGOptions = {
    type: 'repository',
    projectLogo: safeImageSource(rawProjectLogo, DEFAULTS.projectLogo),
    projectName: sanitizeHeader(rawProjectName, 40),
    projectBadgeText: rawProjectBadgeText
      ? sanitizeHeader(rawProjectBadgeText, 30)
      : '',
    projectBadgeIcon: rawProjectBadgeIcon
      ? safeImageSource(rawProjectBadgeIcon, DEFAULTS.projectBadgeIcon)
      : '',
    headline: sanitizeHeader(headline, 160),
    description: sanitizeHeader(rawDescription, 200),
    features: parseList(rawFeatures, DEFAULTS.features).map((feature) =>
      sanitizeHeader(feature, 40),
    ),
    featureColors: parseList(rawFeatureColors, DEFAULTS.featureColors),
    publisherLogo: safeImageSource(rawPublisherLogo, DEFAULTS.publisherLogo),
    publisherName: sanitizeHeader(rawPublisherName, 40),
    publisherTags: parseList(rawPublisherTags, DEFAULTS.publisherTags).map(
      (tag) => sanitizeHeader(tag, 30),
    ),
    background,
    textColor,
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
