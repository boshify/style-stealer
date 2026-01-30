/**
 * Web scraping service with Cheerio (Railway deployment - Cheerio only)
 * Note: Playwright has been removed to avoid build-time bundling issues
 * Enhanced with anti-blocking techniques inspired by page_scraper
 */

import * as cheerio from 'cheerio';
import type { ScrapedData, ScraperOptions } from './types';
import { toAbsoluteUrl, normalizeUrl } from './utils';

// Browser profiles with realistic headers for rotation
interface BrowserProfile {
  userAgent: string;
  secChUa: string;
  secChUaPlatform: string;
  acceptLanguage: string;
}

const BROWSER_PROFILES: BrowserProfile[] = [
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    secChUa: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    secChUaPlatform: '"Windows"',
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    secChUa: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    secChUaPlatform: '"macOS"',
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    secChUa: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    secChUaPlatform: '"Linux"',
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    secChUa: '', // Firefox doesn't send sec-ch-ua
    secChUaPlatform: '',
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
    secChUa: '', // Safari doesn't send sec-ch-ua
    secChUaPlatform: '',
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    secChUa: '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    secChUaPlatform: '"Windows"',
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    secChUa: '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    secChUaPlatform: '"macOS"',
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
    secChUa: '',
    secChUaPlatform: '',
    acceptLanguage: 'en-GB,en;q=0.9',
  },
];

// Get a random browser profile
function getRandomBrowserProfile(): BrowserProfile {
  return BROWSER_PROFILES[Math.floor(Math.random() * BROWSER_PROFILES.length)];
}

const DEFAULT_USER_AGENT = BROWSER_PROFILES[0].userAgent;

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
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Build enhanced headers that closely mimic a real browser
 */
function buildBrowserHeaders(profile: BrowserProfile, url: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': profile.userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': profile.acceptLanguage,
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
    'DNT': '1',
    'Connection': 'keep-alive',
  };

  // Add sec-ch-ua headers for Chromium-based browsers
  if (profile.secChUa) {
    headers['sec-ch-ua'] = profile.secChUa;
    headers['sec-ch-ua-mobile'] = '?0';
    headers['sec-ch-ua-platform'] = profile.secChUaPlatform;
    headers['sec-ch-ua-full-version-list'] = profile.secChUa;
  }

  return headers;
}

/**
 * Fetch HTML with retry logic and exponential backoff
 */
async function fetchWithRetry(
  url: string,
  maxRetries: number = 3
): Promise<{ html: string; profile: BrowserProfile }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Use a different browser profile for each retry
      const profile = getRandomBrowserProfile();
      const headers = buildBrowserHeaders(profile, url);

      console.log(`[Scraper] Attempt ${attempt + 1}/${maxRetries} using ${profile.userAgent.includes('Firefox') ? 'Firefox' : profile.userAgent.includes('Safari') && !profile.userAgent.includes('Chrome') ? 'Safari' : profile.userAgent.includes('Edg') ? 'Edge' : 'Chrome'} profile`);

      // Add a small random delay to appear more human-like (except first attempt)
      if (attempt > 0) {
        const delay = Math.random() * 1000 + 500; // 500-1500ms
        console.log(`[Scraper] Waiting ${Math.round(delay)}ms before retry...`);
        await sleep(delay);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(url, {
          headers,
          signal: controller.signal,
          redirect: 'follow',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();

        // Check if we got actual HTML content (not an error page)
        if (html.length < 500 && (html.includes('error') || html.includes('denied') || html.includes('forbidden'))) {
          throw new Error('Received error page instead of content');
        }

        console.log(`[Scraper] Successfully fetched ${html.length} bytes`);
        return { html, profile };

      } finally {
        clearTimeout(timeoutId);
      }

    } catch (error: any) {
      lastError = error;
      console.log(`[Scraper] Attempt ${attempt + 1} failed: ${error.message}`);

      // Don't retry on timeout errors
      if (error.name === 'AbortError') {
        throw error;
      }

      // If it's the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw error;
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Scrape using HTTP + Cheerio (fast, works for static sites)
 * Enhanced with anti-blocking measures
 */
async function scrapeWithCheerio(
  url: string,
  options: Required<ScraperOptions>
): Promise<ScrapedData> {
  // Fetch HTML with retry logic
  const { html, profile } = await fetchWithRetry(url, 3);

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

    // Fetch external CSS files with proper headers
    const externalCss = await Promise.all(
      cssUrls.slice(0, 10).map(async (cssUrl) => {
        try {
          const cssProfile = getRandomBrowserProfile();
          const cssHeaders = buildBrowserHeaders(cssProfile, cssUrl);
          const cssResponse = await fetch(cssUrl, {
            headers: {
              ...cssHeaders,
              'Accept': 'text/css,*/*;q=0.1',
              'Referer': url,
            },
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
}

/**
 * Test if a URL is accessible
 */
export async function testUrl(url: string): Promise<boolean> {
  try {
    const normalized = normalizeUrl(url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const profile = getRandomBrowserProfile();
    const response = await fetch(normalized, {
      method: 'HEAD',
      headers: {
        'User-Agent': profile.userAgent,
        'Accept': '*/*',
        'Referer': 'https://www.google.com/',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
