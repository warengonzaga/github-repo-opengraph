import {
  createIconSyntaxRegExp,
  createIconSyntaxStartRegExp,
  ICON_SLUG_SANITIZE_RE,
} from './icon-syntax.js';

const XML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export function escapeXml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => XML_ESCAPE_MAP[ch] ?? ch);
}

// Use strict lowercase flags ('g' only, no 'i') to be consistent with parsing
// and width-estimation logic that also uses createIconSyntaxRegExp('g')
const ICON_SYNTAX_RE = createIconSyntaxRegExp('g');
const ICON_SYNTAX_START_RE = createIconSyntaxStartRegExp('');

// Hard cap on raw input length to prevent unbounded load
const RAW_MAX_LENGTH = 500;
// Maximum number of icons allowed per text field
const MAX_ICONS = 5;

export function sanitizeHeader(raw: string, maxLength: number = 80): string {
  const stripped = raw.replace(/<[^>]*>/g, '');

  // Apply hard cap before any other processing
  const safeCapped = stripped.slice(
    0,
    Math.min(stripped.length, RAW_MAX_LENGTH),
  );

  // Calculate display length by removing icon syntax from the count
  const displayText = safeCapped.replace(ICON_SYNTAX_RE, '');
  const totalIcons = (safeCapped.match(ICON_SYNTAX_RE) || []).length;

  if (displayText.length <= maxLength && totalIcons <= MAX_ICONS) {
    return safeCapped;
  }

  // Need to truncate while preserving complete icon syntax
  let result = '';
  let displayCount = 0;
  let iconCount = 0;
  let i = 0;

  while (i < safeCapped.length && displayCount < maxLength) {
    if (safeCapped.slice(i).match(ICON_SYNTAX_START_RE)) {
      const iconMatch = safeCapped.slice(i).match(ICON_SYNTAX_START_RE);
      if (iconMatch) {
        if (iconCount < MAX_ICONS) {
          result += iconMatch[0];
          iconCount++;
        }
        i += iconMatch[0].length;
        continue;
      }
    }

    result += safeCapped[i];
    displayCount++;
    i++;
  }

  const lastOpenBracket = result.lastIndexOf('![');
  if (lastOpenBracket !== -1) {
    const afterOpen = result.slice(lastOpenBracket);
    const hasClosing = afterOpen.includes(']');

    if (!hasClosing) {
      result = result.slice(0, lastOpenBracket);
    } else {
      const themeStartIndex = afterOpen.indexOf('](');
      if (themeStartIndex !== -1) {
        const afterThemeStart = afterOpen.slice(themeStartIndex + 2);
        if (!afterThemeStart.includes(')')) {
          result = result.slice(0, lastOpenBracket);
        }
      }
    }
  }

  return result.trimEnd();
}

export function sanitizeFontName(raw: string, maxLength: number = 50): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9\s+]/g, '').trim();
  return cleaned.slice(0, maxLength);
}

export function sanitizeIconSlug(raw: string, maxLength: number = 50): string {
  const cleaned = raw.toLowerCase().replace(ICON_SLUG_SANITIZE_RE, '');
  return cleaned.slice(0, maxLength);
}

const HEX_COLOR_RE = /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value);
}

// ponytail: simple URL validation — checks protocol + hostname only, no SSRF-proofing.
// Tighten with an allowlist if untrusted users start pointing at internal hosts.
export function isSafeImageUrl(value: string): boolean {
  if (!value) return false;
  if (value.match(createIconSyntaxRegExp())?.[0] === value) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
