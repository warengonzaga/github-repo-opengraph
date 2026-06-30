import { createIconSyntaxRegExp } from '../utils/icon-syntax.js';
import { sanitizeIconSlug } from '../utils/sanitize.js';

// ponytail: in-process cache, never invalidated. Fine for a CDN-backed icon set
// that rarely changes; add TTL if staleness ever matters.
const iconCache = new Map<string, string>();

const ICON_RE = createIconSyntaxRegExp('g');

/**
 * Fetch a Simple Icons SVG from CDN, return as base64 data URI.
 * Returns null on miss so the caller can skip rendering.
 */
export async function fetchSimpleIconDataUri(
  slug: string,
  color: string,
): Promise<string | null> {
  const cleanSlug = sanitizeIconSlug(slug);
  if (!cleanSlug) return null;

  const cacheKey = `${cleanSlug}-${color}`;
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey) ?? null;
  }

  const url = `https://cdn.simpleicons.org/${cleanSlug}/${color}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const svg = await res.text();
    const base64 = Buffer.from(svg).toString('base64');
    const dataUri = `data:image/svg+xml;base64,${base64}`;
    iconCache.set(cacheKey, dataUri);
    return dataUri;
  } catch {
    return null;
  }
}

/**
 * Resolve all ![slug] and ![slug](theme) tokens in a text string to inline
 * <img> tags. `iconColor` is the hex (no #) used for 'auto' theme icons.
 */
export async function resolveIconsInText(
  text: string,
  iconColor: string,
): Promise<string> {
  const matches = [...text.matchAll(ICON_RE)];
  if (matches.length === 0) return text;

  // Process in reverse so indexes stay valid as we splice
  let result = text;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    if (m.index === undefined) continue;
    const slug = m[1];
    const theme = (m[2] as 'light' | 'dark' | 'auto') || 'auto';
    // 'light' theme = light background → dark icon; 'dark' = dark bg → light icon
    const color =
      theme === 'auto' ? iconColor : theme === 'light' ? '000000' : 'ffffff';
    const dataUri = await fetchSimpleIconDataUri(slug, color);
    const replacement = dataUri
      ? `<img src="${dataUri}" style="display:inline-block;width:1em;height:1em;vertical-align:-0.125em;margin:0 0.1em;" alt="" />`
      : '';
    result =
      result.slice(0, m.index) +
      replacement +
      result.slice(m.index + m[0].length);
  }
  return result;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
