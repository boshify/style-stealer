/**
 * Page Discovery - Find related pages on a website for broader style analysis
 */

import * as cheerio from 'cheerio';

/**
 * Discover 2 additional pages from the same website for style analysis
 * Prioritizes: About, Blog/Articles, Contact, Services pages
 */
export async function discoverPages(baseUrl: string, html: string): Promise<string[]> {
  console.log('[Discovery] Finding additional pages to analyze...');

  try {
    const $ = cheerio.load(html);
    const hostname = new URL(baseUrl).hostname;

    // Collect all internal links
    const links: Array<{ url: string; text: string; score: number }> = [];

    $('a[href]').each((_, elem) => {
      const href = $(elem).attr('href');
      const text = $(elem).text().trim().toLowerCase();

      if (!href) return;

      try {
        // Convert relative URLs to absolute
        const absoluteUrl = new URL(href, baseUrl).href;
        const linkHostname = new URL(absoluteUrl).hostname;

        // Only keep same-domain links
        if (linkHostname !== hostname) return;

        // Skip common non-content pages
        if (
          absoluteUrl.includes('#') ||
          absoluteUrl.includes('?') ||
          absoluteUrl.includes('/feed') ||
          absoluteUrl.includes('/wp-') ||
          absoluteUrl.includes('/admin') ||
          absoluteUrl.includes('/login') ||
          absoluteUrl.includes('/cart') ||
          absoluteUrl.includes('/checkout') ||
          absoluteUrl === baseUrl // Skip the same page
        ) {
          return;
        }

        // Score based on page type (higher = better for style analysis)
        let score = 0;

        // High priority pages
        if (text.includes('about') || absoluteUrl.includes('/about')) score += 10;
        if (text.includes('services') || absoluteUrl.includes('/services')) score += 9;
        if (text.includes('products') || absoluteUrl.includes('/products')) score += 9;
        if (text.includes('portfolio') || absoluteUrl.includes('/portfolio')) score += 8;
        if (text.includes('blog') || absoluteUrl.includes('/blog')) score += 7;
        if (text.includes('contact') || absoluteUrl.includes('/contact')) score += 7;
        if (text.includes('team') || absoluteUrl.includes('/team')) score += 6;
        if (text.includes('work') || absoluteUrl.includes('/work')) score += 6;

        // Medium priority
        if (absoluteUrl.match(/\/(page|post|article)\//)) score += 5;

        // Prefer shorter URLs (usually more important pages)
        const pathLength = new URL(absoluteUrl).pathname.split('/').filter(Boolean).length;
        if (pathLength === 1) score += 4;
        else if (pathLength === 2) score += 2;

        // Boost if in main navigation (header/nav)
        const parent = $(elem).closest('nav, header').length;
        if (parent > 0) score += 5;

        links.push({ url: absoluteUrl, text, score });
      } catch {
        // Invalid URL, skip
      }
    });

    // Remove duplicates
    const uniqueLinks = Array.from(
      new Map(links.map((link) => [link.url, link])).values()
    );

    // Sort by score (highest first)
    uniqueLinks.sort((a, b) => b.score - a.score);

    // Take top 2
    const selectedPages = uniqueLinks.slice(0, 2).map((link) => link.url);

    console.log('[Discovery] Selected pages:', selectedPages);
    return selectedPages;
  } catch (error) {
    console.error('[Discovery] Error discovering pages:', error);
    return [];
  }
}
