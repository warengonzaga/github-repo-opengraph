import { isValidHexColor } from '../utils/sanitize.js';
import { escapeHtml, resolveIconsInText, resolveMarkupMedia } from './icons.js';

const MARKUP_RE =
  /\[(highlight|tag|media)(?:\s+([^\]]*))?\]([\s\S]*?)\[\/\1\]/g;
const TAG_COLORS = new Set(['accent', 'success', 'warning', 'neutral']);

function attributes(raw: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw) return result;
  for (const match of raw.matchAll(/([a-z]+)="([^"]*)"/g)) {
    result[match[1]] = match[2];
  }
  return result;
}

function tagColor(value: string | undefined): string {
  if (!value) return 'accent';
  const hex = value.startsWith('#') ? value.slice(1) : value;
  if (isValidHexColor(hex)) return `#${hex}`;
  if (!TAG_COLORS.has(value)) return 'var(--accent)';
  return `var(--tag-${value})`;
}

export async function renderInlineMarkup(
  text: string,
  iconColor: string,
): Promise<string> {
  const matches = [...text.matchAll(MARKUP_RE)];
  if (matches.length === 0) return resolveIconsInText(text, iconColor);

  let result = '';
  let cursor = 0;
  for (const match of matches) {
    if (match.index === undefined) continue;

    const style = match[1] as 'highlight' | 'tag' | 'media';
    const attrs = attributes(match[2]);
    const end = match.index + match[0].length;
    result += await resolveIconsInText(
      text.slice(cursor, match.index),
      iconColor,
    );
    if (style === 'highlight') {
      result += `<span data-style="highlight">${await resolveIconsInText(match[3], iconColor)}</span>`;
    } else if (style === 'tag') {
      result += `<span class="text-tag" style="--tag-color:${escapeHtml(tagColor(attrs.color))}">${await resolveIconsInText(match[3], iconColor)}</span>`;
    } else {
      const source = await resolveMarkupMedia(attrs.content ?? '', iconColor);
      const mediaType = attrs.type === 'avatar' ? 'avatar' : 'icon';
      result += source
        ? `<img class="inline-media ${mediaType}" src="${escapeHtml(source)}" alt="" onerror="this.remove()" />`
        : '';
    }
    cursor = end;
  }

  return result + (await resolveIconsInText(text.slice(cursor), iconColor));
}
