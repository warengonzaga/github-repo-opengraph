import { existsSync } from 'node:fs';
import chromium from '@sparticuz/chromium';
import { LogEngine } from '@wgtechlabs/log-engine';
import puppeteer from 'puppeteer-core';
import { renderTemplate } from './template.js';
import type { OGOptions } from './types.js';

// ponytail: single shared browser instance. Per-request pages are cheap;
// a new browser per request would tank cold-start latency. If throughput
// ever matters and pages start blocking, add a small page pool.
let browserPromise: Promise<puppeteer.Browser> | null = null;

const LOCAL_CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter((p): p is string => !!p && existsSync(p));

async function resolveExecutablePath(): Promise<string | undefined> {
  // Local dev: use a system Chrome if available (sparticuz binary is a
  // serverless/Linux build and won't run on Windows).
  if (LOCAL_CHROME_CANDIDATES.length > 0) {
    return LOCAL_CHROME_CANDIDATES[0];
  }
  // Production / serverless: use the bundled sparticuz chromium.
  try {
    return await chromium.executablePath();
  } catch {
    LogEngine.error(
      'No Chrome binary found. Set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH.',
    );
    return undefined;
  }
}

async function getBrowser(): Promise<puppeteer.Browser> {
  if (!browserPromise) {
    const executablePath = await resolveExecutablePath();
    const useLocal = LOCAL_CHROME_CANDIDATES.length > 0;
    browserPromise = puppeteer.launch({
      args: useLocal ? [] : chromium.args,
      executablePath,
      headless: true,
    });

    browserPromise.catch(() => {
      browserPromise = null;
    });
    browserPromise.then((b) => {
      b.on('disconnected', () => {
        browserPromise = null;
      });
    });
  }
  return browserPromise;
}

export async function renderOGImage(options: OGOptions): Promise<Buffer> {
  const html = await renderTemplate(options);
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: 1200,
      height: 630,
      deviceScaleFactor: 2,
    });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Wait for fonts + images so nothing renders half-loaded
    try {
      await page.evaluate(() => document.fonts.ready);
    } catch {
      // fonts API unavailable — proceed
    }
    try {
      await page.waitForNetworkIdle({ timeout: 3000 });
    } catch {
      // timeout is acceptable; we still screenshot
    }

    const buffer = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: 1200, height: 630 },
    });
    return Buffer.from(buffer);
  } finally {
    await page.close().catch((err) => {
      LogEngine.warn('Failed to close page:', err.message);
    });
  }
}
