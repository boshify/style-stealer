/**
 * Web scraping service with Cheerio (Railway deployment - Cheerio only)
 * Note: Playwright has been removed to avoid build-time bundling issues
 * Enhanced with anti-blocking techniques using got for HTTP/2 support
 */

import * as cheerio from 'cheerio';
import got from 'got';
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
 * Fallback to Jina Reader API when all else fails
 */
async function fetchViaJinaReader(url: string): Promise<string> {
  console.log(`[Scraper] Emergency Jina Reader fallback for: ${url}`);
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await got(jinaUrl, {
      timeout: { request: 30000 },
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      http2: true,
    });

    console.log(`[Scraper] Jina Reader success (markdown fallback)`);
    return response.body;
  } catch (error: any) {
    throw new Error(`Jina Reader failed: ${error.message}`);
  }
}

/**
 * Fetch HTML with retry logic and exponential backoff using got-scraping
 */
async function fetchWithRetry(
  url: string,
  maxRetries: number = 3
): Promise<{ html: string; profile: BrowserProfile; usedJina: boolean }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Use a different browser profile for each retry
      const profile = getRandomBrowserProfile();
      const browserName = profile.userAgent.includes('Firefox') ? 'Firefox' :
                         profile.userAgent.includes('Safari') && !profile.userAgent.includes('Chrome') ? 'Safari' :
                         profile.userAgent.includes('Edg') ? 'Edge' : 'Chrome';

      console.log(`[Scraper] Attempt ${attempt + 1}/${maxRetries} using ${browserName} profile`);

      // Add exponential backoff with jitter (except first attempt)
      if (attempt > 0) {
        const baseDelay = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s...
        const jitter = Math.random() * 1000; // 0-1000ms
        const delay = baseDelay + jitter;
        console.log(`[Scraper] Waiting ${Math.round(delay)}ms before retry...`);
        await sleep(delay);
      }

      try {
        // Use got with HTTP/2 support for better compatibility
        const response = await got(url, {
          timeout: { request: 30000 },
          headers: {
            'User-Agent': profile.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': profile.acceptLanguage,
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
            ...(profile.secChUa && {
              'sec-ch-ua': profile.secChUa,
              'sec-ch-ua-mobile': '?0',
              'sec-ch-ua-platform': profile.secChUaPlatform,
            }),
          },
          http2: true, // Enable HTTP/2
          followRedirect: true,
        });

        const html = response.body;

        // Check if we got actual HTML content (not an error page)
        if (html.length < 500 && (html.includes('error') || html.includes('denied') || html.includes('forbidden'))) {
          throw new Error('Received error page instead of content');
        }

        console.log(`[Scraper] Successfully fetched ${html.length} bytes`);
        return { html, profile, usedJina: false };

      } catch (error: any) {
        throw error;
      }

    } catch (error: any) {
      lastError = error;
      console.log(`[Scraper] Attempt ${attempt + 1} failed: ${error.message}`);

      // If it's the last attempt, try Jina Reader as emergency fallback
      if (attempt === maxRetries - 1) {
        console.log(`[Scraper] All direct attempts failed, trying Jina Reader emergency fallback...`);
        try {
          const html = await fetchViaJinaReader(url);
          return { html, profile: BROWSER_PROFILES[0], usedJina: true };
        } catch (jinaError: any) {
          console.log(`[Scraper] Jina Reader fallback also failed: ${jinaError.message}`);
          throw lastError; // Throw the original error
        }
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Scrape using HTTP + Cheerio (fast, works for static sites)
 * Enhanced with anti-blocking measures using got-scraping
 */
async function scrapeWithCheerio(
  url: string,
  options: Required<ScraperOptions>
): Promise<ScrapedData> {
  // Fetch HTML with retry logic (with emergency Jina fallback)
  const { html, profile, usedJina } = await fetchWithRetry(url, 3);

  if (usedJina) {
    console.log(`[Scraper] WARNING: Using Jina Reader markdown - CSS/images may be limited`);
  }

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

    // Fetch external CSS files with proper headers (skip if using Jina)
    const externalCss = usedJina ? [] : await Promise.all(
      cssUrls.slice(0, 10).map(async (cssUrl) => {
        try {
          const cssProfile = getRandomBrowserProfile();
          const response = await got(cssUrl, {
            timeout: { request: 10000 },
            headers: {
              'User-Agent': cssProfile.userAgent,
              'Accept': 'text/css,*/*;q=0.1',
              'Accept-Language': cssProfile.acceptLanguage,
              'Referer': url,
            },
            http2: true,
          });
          return response.body;
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
    const profile = getRandomBrowserProfile();

    await got(normalized, {
      method: 'HEAD',
      timeout: { request: 10000 },
      headers: {
        'User-Agent': profile.userAgent,
        'Accept': '*/*',
      },
      http2: true,
    });

    return true;
  } catch {
    return false;
  }
}
