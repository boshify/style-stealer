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
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    secChUaPlatform: '"Windows"',
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    secChUaPlatform: '"macOS"',
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    secChUaPlatform: '"Linux"',
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    secChUa: '', // Firefox doesn't send sec-ch-ua
    secChUaPlatform: '',
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    secChUa: '', // Safari doesn't send sec-ch-ua
    secChUaPlatform: '',
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
    secChUaPlatform: '"Windows"',
    acceptLanguage: 'en-US,en;q=0.9',
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
 * Check if HTML content indicates a soft block (Cloudflare, CAPTCHA, etc.)
 */
function detectSoftBlock(html: string): boolean {
  const lowerHtml = html.toLowerCase();
  const blockMarkers = [
    'checking your browser',
    'enable javascript',
    'captcha',
    'cloudflare',
    'please verify you are a human',
    'access denied',
    'are you a robot',
  ];

  return blockMarkers.some(marker => lowerHtml.includes(marker));
}

/**
 * Fallback to Jina Reader API when direct access fails
 */
async function fetchViaJinaReader(url: string, timeout: number): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log(`[Scraper] Attempting Jina Reader fallback for: ${url}`);
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Jina Reader failed: ${response.status}`);
    }

    const html = await response.text();
    console.log(`[Scraper] Jina Reader success`);
    return html;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Scrape using HTTP + Cheerio (fast, works for static sites)
 * Enhanced with anti-blocking measures
 */
async function scrapeWithCheerio(
  url: string,
  options: Required<ScraperOptions>
): Promise<ScrapedData> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout);

  try {
    // Use random browser profile for rotation
    const profile = getRandomBrowserProfile();

    // Build comprehensive headers mimicking real browsers
    const headers: Record<string, string> = {
      'User-Agent': profile.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': profile.acceptLanguage,
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.google.com/',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
    };

    // Add sec-ch-ua headers for Chromium-based browsers
    if (profile.secChUa) {
      headers['sec-ch-ua'] = profile.secChUa;
      headers['sec-ch-ua-mobile'] = '?0';
      headers['sec-ch-ua-platform'] = profile.secChUaPlatform;
    }

    console.log(`[Scraper] Using ${profile.userAgent.includes('Firefox') ? 'Firefox' : profile.userAgent.includes('Safari') && !profile.userAgent.includes('Chrome') ? 'Safari' : profile.userAgent.includes('Edg') ? 'Edge' : 'Chrome'} profile`);

    // Attempt direct fetch
    let html: string;
    let usedFallback = false;

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        // Try Jina Reader fallback for access errors
        if ([403, 401, 429, 451, 503].includes(response.status)) {
          console.log(`[Scraper] HTTP ${response.status}, attempting Jina Reader fallback`);
          html = await fetchViaJinaReader(url, options.timeout);
          usedFallback = true;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } else {
        html = await response.text();

        // Check for soft blocks (Cloudflare, CAPTCHA)
        if (detectSoftBlock(html)) {
          console.log(`[Scraper] Soft block detected, attempting Jina Reader fallback`);
          try {
            html = await fetchViaJinaReader(url, options.timeout);
            usedFallback = true;
          } catch (fallbackError) {
            console.log(`[Scraper] Jina Reader fallback failed, using original (possibly blocked) content`);
            // Continue with potentially blocked content rather than failing completely
          }
        }
      }
    } catch (fetchError: any) {
      // If network error, try Jina Reader as last resort
      if (fetchError.name === 'AbortError') {
        throw fetchError; // Don't retry on timeout
      }
      console.log(`[Scraper] Fetch failed (${fetchError.message}), attempting Jina Reader fallback`);
      html = await fetchViaJinaReader(url, options.timeout);
      usedFallback = true;
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

    // Fetch external CSS files with proper headers
    const externalCss = await Promise.all(
      cssUrls.slice(0, 10).map(async (cssUrl) => {
        try {
          const cssProfile = getRandomBrowserProfile();
          const cssResponse = await fetch(cssUrl, {
            headers: {
              'User-Agent': cssProfile.userAgent,
              'Accept': 'text/css,*/*;q=0.1',
              'Accept-Language': cssProfile.acceptLanguage,
              'Referer': url,
            },
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

    if (usedFallback) {
      console.log(`[Scraper] Success via Jina Reader fallback (${css.length} chars of CSS)`);
    }

    return {
      html,
      css,
      url,
      title,
      method: usedFallback ? 'cheerio-jina-fallback' : 'cheerio',
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
