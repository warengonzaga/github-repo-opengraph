import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, resolveIconsInText, resolveImageSource } from './icons.js';
import type { OGOptions } from './types.js';

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

const PILL_DOT_COLORS: Record<string, string> = {
  blurple: 'var(--discord-blurple)',
  fuchsia: 'var(--discord-fuchsia)',
  green: '#57f287',
  yellow: '#fee75c',
  red: '#ed4245',
  blue: '#3b82f6',
};

function pillDotColor(variant: string): string {
  return PILL_DOT_COLORS[variant] ?? PILL_DOT_COLORS.blurple;
}

/**
 * Build the pills HTML block from labels + color variants.
 */
function buildPills(pills: string[], colors: string[]): string {
  if (pills.length === 0) return '';
  return pills
    .map((label, i) => {
      const dotColor = pillDotColor(colors[i] ?? 'blurple');
      const safeLabel = escapeHtml(label);
      return `        <span class="pill"><span class="pill-dot" style="background:${dotColor};"></span>${safeLabel}</span>`;
    })
    .join('\n');
}

function buildFooterTag(items: string[]): string {
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
  const html = loadTemplate();

  // Icon color for 'auto' theme icons — light icon on dark bg, dark icon on light bg
  const iconColor = options.theme === 'dark' ? 'ffffff' : '000000';

  // Resolve icons in all text fields
  const [title, logoText, badge, description, footerText] = await Promise.all([
    resolveIconsInText(options.title, iconColor),
    resolveIconsInText(options.logoText, iconColor),
    options.badge ? resolveIconsInText(options.badge, iconColor) : '',
    resolveIconsInText(options.description, iconColor),
    resolveIconsInText(options.footerText, iconColor),
  ]);
  const [logoSrc, badgeIconSrc, footerLogoSrc] = await Promise.all([
    resolveImageSource(options.logo, iconColor),
    resolveImageSource(options.badgeIcon, iconColor),
    resolveImageSource(options.footerLogo, iconColor),
  ]);

  const badgeHtml = badge
    ? `<span class="logo-badge">${
        badgeIconSrc
          ? `<img class="badge-icon" src="${escapeHtml(badgeIconSrc)}" alt="" />`
          : ''
      }${badge}</span>`
    : '';

  const pillsHtml = buildPills(options.pills, options.pillColors);
  const footerTagHtml = buildFooterTag(options.footerTag);

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
    .replace('{{BG_COLOR}}', `#${options.bg}`)
    .replace('{{TEXT_COLOR}}', `#${options.color}`)
    .replace('{{LOGO_SRC}}', escapeHtml(logoSrc))
    .replace('{{LOGO_TEXT}}', logoText)
    .replace('{{BADGE}}', badgeHtml)
    .replace('{{TITLE}}', title)
    .replace('{{HIGHLIGHT}}', escapeHtml(options.highlight))
    .replace('{{DESCRIPTION}}', description)
    .replace('{{PILLS}}', pillsHtml)
    .replace('{{FOOTER_LOGO_SRC}}', escapeHtml(footerLogoSrc))
    .replace('{{FOOTER_TEXT}}', footerText)
    .replace('{{FOOTER_TAG}}', footerTagHtml);
}
