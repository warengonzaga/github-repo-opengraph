import { isSafeImageUrl } from '../utils/sanitize.js';
import { escapeHtml, resolveImageSource } from './icons.js';
import { renderInlineMarkup } from './inline-markup.js';
import type { WebsiteOGOptions } from './types.js';

function autoFavicon(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? `${parsed.origin}/favicon.ico` : '';
  } catch {
    return '';
  }
}

function displayUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export async function renderWebsiteTemplate(
  options: WebsiteOGOptions,
): Promise<string> {
  const iconColor = options.theme === 'dark' ? 'ffffff' : '000000';
  const [
    headerTitle,
    headerSubtitle,
    heading,
    subheading,
    description,
    footerText,
  ] = await Promise.all([
    renderInlineMarkup(options.headerTitle, iconColor),
    renderInlineMarkup(options.headerSubtitle, iconColor),
    renderInlineMarkup(options.heading, iconColor),
    renderInlineMarkup(options.subheading, iconColor),
    renderInlineMarkup(options.description, iconColor),
    renderInlineMarkup(options.footerText, iconColor),
  ]);
  const mainImage = options.mainImage
    ? await resolveImageSource(options.mainImage, iconColor)
    : '';
  const customIcon = options.urlIcon
    ? await resolveImageSource(options.urlIcon, iconColor)
    : '';
  const urlIcon =
    options.urlIconMode === 'none'
      ? ''
      : options.urlIconMode === 'auto'
        ? autoFavicon(options.url)
        : customIcon;
  const safeUrlIcon = isSafeImageUrl(urlIcon) ? urlIcon : '';
  const mainImageHtml = mainImage
    ? '<img class="main-image" src="' +
      escapeHtml(mainImage) +
      '" alt="" onerror="this.closest(\'.media-panel\').remove()" />'
    : '';
  const urlIconHtml = safeUrlIcon
    ? '<img class="url-icon" src="' +
      escapeHtml(safeUrlIcon) +
      '" alt="" onerror="this.remove()" />'
    : '';
  const headerHtml =
    headerTitle || headerSubtitle
      ? '<header class="site-header"><div>' +
        headerTitle +
        '</div><small>' +
        headerSubtitle +
        '</small></header>'
      : '';
  const footerHtml = footerText
    ? `<div class="footer-text">${footerText}</div>`
    : '';

  return WEBSITE_TEMPLATE.replace('{{THEME}}', options.theme)
    .replace('{{BACKGROUND}}', `#${options.background}`)
    .replace('{{TEXT_COLOR}}', `#${options.textColor}`)
    .replace('{{IMAGE_POSITION}}', options.mainImagePosition)
    .replace('{{HEADER}}', headerHtml)
    .replace('{{MAIN_IMAGE}}', mainImageHtml)
    .replace('{{HEADING}}', heading)
    .replace('{{SUBHEADING}}', subheading)
    .replace('{{DESCRIPTION}}', description)
    .replace('{{FOOTER_TEXT}}', footerHtml)
    .replace('{{URL_ICON}}', urlIconHtml)
    .replace('{{URL_ICON_POSITION}}', options.urlIconPosition)
    .replace('{{URL}}', escapeHtml(displayUrl(options.url)));
}

const WEBSITE_TEMPLATE = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><style>
:root { --bg: {{BACKGROUND}}; --text: {{TEXT_COLOR}}; --muted: #a8afb9; --surface: rgba(255,255,255,.08); --border: rgba(255,255,255,.15); --accent: #7c8cff; --accent-2: #ee6db3; --tag-accent: var(--accent); --tag-success: #57f287; --tag-warning: #fee75c; --tag-neutral: var(--muted); font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
* { box-sizing: border-box; } html,body { width:1200px;height:630px;margin:0; } body { background:var(--bg);color:var(--text);overflow:hidden; } body[data-theme="light"] { --muted:#52606d; --surface:rgba(0,0,0,.05); --border:rgba(0,0,0,.12); --accent:#4752c4; }
.canvas { height:100%;padding:62px 74px 48px;display:flex;flex-direction:column;position:relative;isolation:isolate; } .canvas::before { content:"";position:absolute;z-index:-1;width:760px;height:760px;left:22%;top:-430px;border-radius:50%;background:radial-gradient(circle,rgba(124,140,255,.28),transparent 67%); }
.site-header { display:flex;align-items:baseline;gap:14px;min-height:28px;font-size:22px;font-weight:750; } .site-header small { color:var(--muted);font-size:15px;font-weight:600; }
.content { flex:1;display:grid;grid-template-columns:1fr 1.05fr;gap:58px;align-items:center; } .content[data-image-position="right"] { grid-template-columns:1.05fr 1fr; } .content[data-image-position="right"] .copy { order:1; } .content[data-image-position="right"] .media-panel { order:2; }
.media-panel { min-width:0;min-height:318px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:26px;background:var(--surface);overflow:hidden; } .media-panel:empty { display:none; } .main-image { width:100%;height:318px;object-fit:cover; }
.copy h1 { margin:0;font-size:56px;line-height:1.04;letter-spacing:-2.2px; } .subheading { margin:18px 0 0;font-size:25px;line-height:1.25;font-weight:650;color:var(--text); } .description { margin:16px 0 0;max-width:540px;font-size:19px;line-height:1.48;color:var(--muted); }
[data-style="highlight"] { background:linear-gradient(135deg,var(--accent),var(--accent-2));-webkit-background-clip:text;background-clip:text;color:transparent; }.text-tag { --tag-color:var(--accent);display:inline-flex;align-items:center;margin:0 .08em;padding:.12em .45em;border-radius:.35em;background:color-mix(in srgb,var(--tag-color) 18%,transparent);color:var(--tag-color);font-size:.72em;font-weight:750;vertical-align:.08em; }.inline-media { width:1em;height:1em;object-fit:contain;vertical-align:-.12em;margin:0 .08em; }.inline-media.avatar { border-radius:50%; }
.site-footer { display:flex;align-items:center;justify-content:space-between;gap:24px;padding-top:23px;border-top:1px solid var(--border);color:var(--muted);font-size:16px; }.footer-text { max-width:700px; }.url { display:flex;align-items:center;gap:10px;font-weight:700;color:var(--text);white-space:nowrap; }.url[data-icon-position="right"] .url-icon { order:2; }.url-icon { width:20px;height:20px;object-fit:contain;border-radius:4px; }
</style></head><body data-theme="{{THEME}}"><main class="canvas">{{HEADER}}<section class="content" data-image-position="{{IMAGE_POSITION}}"><div class="media-panel">{{MAIN_IMAGE}}</div><div class="copy"><h1>{{HEADING}}</h1><p class="subheading">{{SUBHEADING}}</p><p class="description">{{DESCRIPTION}}</p></div></section><footer class="site-footer">{{FOOTER_TEXT}}<div class="url" data-icon-position="{{URL_ICON_POSITION}}">{{URL_ICON}}<span>{{URL}}</span></div></footer></main></body></html>`;
