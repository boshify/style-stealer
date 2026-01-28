/**
 * Web scraping service with Cheerio (Railway deployment - Cheerio only)
 * Note: Playwright has been removed to avoid build-time bundling issues
 */

import * as cheerio from 'cheerio';
import type { ScrapedData, ScraperOptions } from './types';
import { toAbsoluteUrl, normalizeUrl } from './utils';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEFAULT_OPTIONS: Required<ScraperOptions> = {
  timeout: 30000,
  userAgent: DEFAULT_USER_AGENT,
  forcePlaywright: false,
  waitForNetwork: true,
  screenshotPath: '',
};

/**
 * Main scraping function - uses Cheerio only (Railway deployment)
 */
export async function scrapeWebsite(
  url: string,
  options: ScraperOptions = {}
): Promise<ScrapedData> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const normalizedUrl = normalizeUrl(url);

  console.log(`[Scraper] Fetching: ${normalizedUrl}`);

  // Use Cheerio for all scraping (Playwright removed for Railway deployment)
  const data = await scrapeWithCheerio(normalizedUrl, opts);
  console.log(`[Scraper] Success with Cheerio (${data.css.length} chars of CSS)`);
  return data;
}

/**
 * Scrape using HTTP + Cheerio (fast, works for static sites)
 */
async function scrapeWithCheerio(
  url: string,
  options: Required<ScraperOptions>
): Promise<ScrapedData> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout);

  try {
    // Fetch HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': options.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title
    const title = $('title').text().trim() || 'Untitled';

    // Extract inline styles
    const inlineStyles: string[] = [];
    $('style').each((_, elem) => {
      const content = $(elem).html();
      if (content) inlineStyles.push(content);
    });

    // Extract external stylesheets
    const cssUrls: string[] = [];
    $('link[rel="stylesheet"]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        cssUrls.push(toAbsoluteUrl(href, url));
      }
    });

    // Fetch external CSS files
    const externalCss = await Promise.all(
      cssUrls.slice(0, 10).map(async (cssUrl) => {
        try {
          const cssResponse = await fetch(cssUrl, {
            headers: { 'User-Agent': options.userAgent },
            signal: controller.signal,
          });
          return cssResponse.ok ? await cssResponse.text() : '';
        } catch {
          return '';
        }
      })
    );

    // Combine all CSS
    const css = [...inlineStyles, ...externalCss].join('\n\n');

    return {
      html,
      css,
      url,
      title,
      method: 'cheerio',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Test if a URL is accessible
 */
export async function testUrl(url: string): Promise<boolean> {
  try {
    const normalized = normalizeUrl(url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(normalized, {
      method: 'HEAD',
      headers: { 'User-Agent': DEFAULT_USER_AGENT },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
