import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, resolveIconsInText, resolveImageSource } from './icons.js';
import { renderInlineMarkup } from './inline-markup.js';
import type { OGOptions, RepositoryOGOptions } from './types.js';
import { renderWebsiteTemplate } from './website.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Works in dev (src/og/) and prod (dist/)
function findTemplatePath(): string {
  const candidates = [
    resolve(__dirname, '..', '..', 'og-image.html'), // dev: src/og/../../og-image.html
    resolve(__dirname, '..', 'og-image.html'), // prod: dist/../og-image.html
    resolve(__dirname, 'og-image.html'), // prod fallback
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
let cachedTemplate: string | null = null;

function loadTemplate(): string {
  if (!cachedTemplate || isDev) {
    cachedTemplate = readFileSync(findTemplatePath(), 'utf-8');
  }
  return cachedTemplate;
}

const FEATURE_DOT_COLORS: Record<string, string> = {
  blurple: 'var(--discord-blurple)',
  fuchsia: 'var(--discord-fuchsia)',
  green: '#57f287',
  yellow: '#fee75c',
  red: '#ed4245',
  blue: '#3b82f6',
};

function featureDotColor(variant: string): string {
  return FEATURE_DOT_COLORS[variant] ?? FEATURE_DOT_COLORS.blurple;
}

/**
 * Build the feature HTML block from labels + color variants.
 */
function buildFeatures(features: string[], colors: string[]): string {
  if (features.length === 0) return '';
  return features
    .map((label, i) => {
      const dotColor = featureDotColor(colors[i] ?? 'blurple');
      const safeLabel = escapeHtml(label);
      return `        <span class="feature"><span class="feature-dot" style="background:${dotColor};"></span>${safeLabel}</span>`;
    })
    .join('\n');
}

function buildPublisherTags(items: string[]): string {
  if (items.length === 0) return '';
  return items
    .map((item) => `<span>${escapeHtml(item)}</span>`)
    .join('<span class="sep">·</span>');
}

/**
 * Render the og-image.html template with the given options.
 * Image tokens (![slug]) in text fields are resolved to inline <img> tags.
 */
export async function renderTemplate(options: OGOptions): Promise<string> {
  if (options.type !== 'repository') return renderWebsiteTemplate(options);
  return renderRepositoryTemplate(options);
}

async function renderRepositoryTemplate(
  options: RepositoryOGOptions,
): Promise<string> {
  const html = loadTemplate();

  // Icon color for 'auto' theme icons — light icon on dark bg, dark icon on light bg
  const iconColor = options.theme === 'dark' ? 'ffffff' : '000000';

  // Resolve icons in all text fields
  const [headline, projectName, projectBadgeText, description, publisherName] =
    await Promise.all([
      renderInlineMarkup(options.headline, iconColor),
      resolveIconsInText(options.projectName, iconColor),
      options.projectBadgeText
        ? resolveIconsInText(options.projectBadgeText, iconColor)
        : '',
      resolveIconsInText(options.description, iconColor),
      resolveIconsInText(options.publisherName, iconColor),
    ]);
  const [projectLogoSrc, projectBadgeIconSrc, publisherLogoSrc] =
    await Promise.all([
      resolveImageSource(options.projectLogo, iconColor),
      resolveImageSource(options.projectBadgeIcon, iconColor),
      resolveImageSource(options.publisherLogo, iconColor),
    ]);

  const badgeHtml = projectBadgeText
    ? `<span class="project-badge">${
        projectBadgeIconSrc
          ? `<img class="badge-icon" src="${escapeHtml(projectBadgeIconSrc)}" alt="" />`
          : ''
      }${projectBadgeText}</span>`
    : '';

  const featuresHtml = buildFeatures(options.features, options.featureColors);
  const publisherTagsHtml = buildPublisherTags(options.publisherTags);

  // Theme overrides applied as a <style> injection in <head>
  const themeOverride =
    options.theme === 'light'
      ? `<style>
    :root {
      --bg-primary: #f8f9fb;
      --bg-card: #ffffff;
      --text-primary: #0b0d10;
      --text-secondary: #4a5060;
      --text-muted: #6b7280;
      --border-color: #e5e7eb;
    }
    .glow { background: radial-gradient(circle, rgba(88, 101, 242, 0.10) 0%, transparent 70%); }
    .glow-alt { background: radial-gradient(circle, rgba(235, 69, 158, 0.06) 0%, transparent 70%); }
  </style>`
      : '';

  // ponytail: string replacement over a static template — no template engine.
  // Tokens map 1:1 to visible elements. Add a new token by editing the HTML.
  return html
    .replace('{{THEME_OVERRIDE}}', themeOverride)
    .replace('{{THEME}}', options.theme)
    .replace('{{BACKGROUND_COLOR}}', `#${options.background}`)
    .replace('{{TEXT_COLOR}}', `#${options.textColor}`)
    .replace('{{PROJECT_LOGO_SRC}}', escapeHtml(projectLogoSrc))
    .replace('{{PROJECT_NAME}}', projectName)
    .replace('{{BADGE}}', badgeHtml)
    .replace('{{HEADLINE}}', headline)
    .replace('{{DESCRIPTION}}', description)
    .replace('{{FEATURES}}', featuresHtml)
    .replace('{{PUBLISHER_LOGO_SRC}}', escapeHtml(publisherLogoSrc))
    .replace('{{PUBLISHER_NAME}}', publisherName)
    .replace('{{PUBLISHER_TAGS}}', publisherTagsHtml);
}
