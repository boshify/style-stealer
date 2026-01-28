/**
 * Web scraping service with Cheerio (primary) and Playwright (fallback)
 */

import * as cheerio from 'cheerio';
import type { ScrapedData, ScraperOptions } from './types';
import { toAbsoluteUrl, normalizeUrl } from './utils';

// Lazy-load Playwright only when needed (not at module initialization)
let playwrightChecked = false;
let playwrightAvailable = false;
let chromium: any = null;

function ensurePlaywright() {
  if (playwrightChecked) return;
  playwrightChecked = true;

  try {
    // Dynamic import to handle optional Playwright
    const playwright = require('playwright');
    chromium = playwright.chromium;
    playwrightAvailable = true;
    console.log('[Scraper] Playwright is available');
  } catch (error) {
    console.log('[Scraper] Playwright not available, will use Cheerio only');
  }
}

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
 * Main scraping function - automatically chooses best method
 */
export async function scrapeWebsite(
  url: string,
  options: ScraperOptions = {}
): Promise<ScrapedData> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const normalizedUrl = normalizeUrl(url);

  console.log(`[Scraper] Fetching: ${normalizedUrl}`);

  // Force Playwright if requested
  if (opts.forcePlaywright) {
    console.log('[Scraper] Using Playwright (forced)');
    ensurePlaywright(); // Lazy-load Playwright
    return scrapeWithPlaywright(normalizedUrl, opts);
  }

  // Try Cheerio first (fast, cheap)
  try {
    const data = await scrapeWithCheerio(normalizedUrl, opts);

    // Check if we got enough CSS
    if (data.css.length > 500) {
      console.log(`[Scraper] Success with Cheerio (${data.css.length} chars of CSS)`);
      return data;
    }

    console.log('[Scraper] Insufficient CSS from Cheerio, attempting Playwright fallback');

    // Only try Playwright if it's available
    ensurePlaywright(); // Lazy-load Playwright
    if (playwrightAvailable) {
      return scrapeWithPlaywright(normalizedUrl, opts);
    } else {
      console.log('[Scraper] Playwright not available, using Cheerio data anyway');
      return data; // Return what we got from Cheerio
    }
  } catch (error) {
    console.log('[Scraper] Cheerio failed:', error);

    // Try Playwright if available
    ensurePlaywright(); // Lazy-load Playwright
    if (playwrightAvailable) {
      console.log('[Scraper] Falling back to Playwright');
      return scrapeWithPlaywright(normalizedUrl, opts);
    } else {
      // No fallback available, re-throw the error
      throw new Error(`Scraping failed and Playwright is not available: ${error}`);
    }
  }
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
 * Scrape using Playwright (slower, works for JavaScript-heavy sites)
 */
async function scrapeWithPlaywright(
  url: string,
  options: Required<ScraperOptions>
): Promise<ScrapedData> {
  // Check if Playwright is available
  if (!playwrightAvailable || !chromium) {
    throw new Error('Playwright is not available. Install it with: npm install playwright && npx playwright install chromium');
  }

  let browser;

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      userAgent: options.userAgent,
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    // Set timeout
    page.setDefaultTimeout(options.timeout);

    // Navigate to URL
    await page.goto(url, {
      waitUntil: options.waitForNetwork ? 'networkidle' : 'domcontentloaded',
      timeout: options.timeout,
    });

    // Extract title
    const title = await page.title();

    // Extract HTML
    const html = await page.content();

    // Extract computed CSS
    const css = await extractComputedStyles(page);

    // Optional: Take screenshot
    if (options.screenshotPath) {
      await page.screenshot({ path: options.screenshotPath, fullPage: false });
    }

    return {
      html,
      css,
      url,
      title,
      method: 'playwright',
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extract computed styles from page (Playwright)
 */
async function extractComputedStyles(page: any): Promise<string> {
  // Get all stylesheets content
  const stylesheets = await page.evaluate(() => {
    const sheets: string[] = [];

    // Get all style tags
    document.querySelectorAll('style').forEach((style) => {
      if (style.textContent) {
        sheets.push(style.textContent);
      }
    });

    // Get linked stylesheets
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        if (sheet.cssRules) {
          const rules = Array.from(sheet.cssRules)
            .map((rule) => rule.cssText)
            .join('\n');
          sheets.push(rules);
        }
      } catch (e) {
        // CORS restrictions - skip
      }
    });

    return sheets;
  });

  return stylesheets.join('\n\n');
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
