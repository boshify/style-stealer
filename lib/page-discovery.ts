/**
 * Page Discovery - Intelligent browsing to find individual content pages
 * Uses AI to classify page types and autonomously navigate until suitable pages are found
 */

import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';
import { scrapeWebsite } from './scraper';

const MODEL = 'claude-3-5-haiku-20241022';

/**
 * Get Anthropic client (lazy initialization to ensure API key is loaded)
 */
function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

interface PageClassification {
  type: 'individual_content' | 'navigational' | 'homepage' | 'blog_archive';
  confidence: number; // 0-1
  reasoning: string;
  imageCount?: number; // Number of images found on the page
  hasFeaturedImages?: boolean; // Whether page has featured/thumbnail images
  suggestedLinks?: string[]; // If navigational, which links to try next
}

/**
 * Classify a page using AI to determine if it's suitable for style analysis
 */
async function classifyPage(url: string, html: string): Promise<PageClassification> {
  console.log(`[Discovery] Classifying page: ${url}`);

  const $ = cheerio.load(html);

  // Extract page title
  const title = $('title').text().trim();

  // Extract main content indicators
  const h1Count = $('h1').length;
  const articleCount = $('article').length;
  const listItemCount = $('li').length;

  // Count images on the page
  const imageCount = $('img').filter((_, img) => {
    const src = $(img).attr('src');
    // Filter out tiny icons and tracking pixels
    if (!src) return false;
    return !src.includes('1x1') && !src.includes('tracking') && !src.includes('pixel');
  }).length;

  // Detect featured/thumbnail images (common in blog loops)
  const hasFeaturedImages =
    $('img[class*="featured"], img[class*="thumbnail"], .post-thumbnail img, .entry-image img').length > 0 ||
    ($('article img, .post img, .entry img').length >= 2); // Multiple article images suggest blog loop

  // Extract navigation links (first 20)
  const links: string[] = [];
  $('a[href]').slice(0, 20).each((_, elem) => {
    const href = $(elem).attr('href');
    const text = $(elem).text().trim();
    if (href && text) {
      links.push(`${text}: ${href}`);
    }
  });

  // Extract text snippet from main content area
  const mainContent = $('main, article, .content, #content').first().text().slice(0, 500);

  const prompt = `Analyze this webpage and classify it into one of four categories:

1. **individual_content**: A specific content page like:
   - Blog post / article WITH IMAGES (preferred)
   - Product page with product images
   - Landing page with visual content
   - About page with team photos
   - Case study with screenshots/examples
   - Service detail page with illustrations

2. **blog_archive**: Blog listing/archive page - GOOD for featured image analysis:
   - Blog homepage with post previews
   - Blog category/tag pages
   - Blog archive pages
   - Must have multiple posts with featured/thumbnail images

3. **navigational**: Generic list/index pages - SKIP these:
   - Generic category lists without images
   - Site maps
   - Search results
   - Link directories

4. **homepage**: The main homepage/landing page - GOOD for overall style

**Page Information:**
URL: ${url}
Title: ${title}
H1 count: ${h1Count}
Article tags: ${articleCount}
List items: ${listItemCount}
Image count: ${imageCount}
Has featured/thumbnail images: ${hasFeaturedImages}

**First 20 Links:**
${links.slice(0, 20).join('\n')}

**Content Preview:**
${mainContent || 'No main content found'}

**CRITICAL Image Requirements:**
- We NEED pages with multiple images for style analysis
- Blog archives with featured images are EXCELLENT
- Individual content pages MUST have at least 3-4 images
- Pages with NO images should be avoided unless it's the homepage
- Prioritize pages with diverse image types (photos, illustrations, graphics)

**Important Rules:**
- Homepage is GOOD (overall style reference)
- Blog archives with featured images are EXCELLENT (featured image patterns)
- Individual content with 3+ images is EXCELLENT (detailed image analysis)
- Individual content with 0-2 images is OK but not ideal
- Generic navigational pages are BAD - browse deeper
- If navigational, suggest links to image-rich pages

Respond in JSON format:
{
  "type": "individual_content" | "blog_archive" | "navigational" | "homepage",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "imageCount": ${imageCount},
  "hasFeaturedImages": ${hasFeaturedImages},
  "suggestedLinks": ["url1", "url2"] // Only if navigational
}`;

  try {
    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    if (content.type === 'text') {
      // Extract JSON from response (Claude might wrap it in markdown)
      const text = content.text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const classification = JSON.parse(jsonMatch[0]) as PageClassification;
        console.log(`[Discovery] Classification: ${classification.type} (confidence: ${classification.confidence})`);
        console.log(`[Discovery] Reasoning: ${classification.reasoning}`);
        return classification;
      }
    }

    throw new Error('Failed to parse classification response');
  } catch (error) {
    console.error('[Discovery] Classification error:', error);
    // Fallback to simple heuristic
    return {
      type: 'individual_content',
      confidence: 0.5,
      reasoning: 'Classification failed, assuming individual content',
    };
  }
}

/**
 * Extract promising links from HTML that likely lead to individual content
 */
function extractCandidateLinks(baseUrl: string, html: string, maxLinks: number = 10): string[] {
  const $ = cheerio.load(html);
  const hostname = new URL(baseUrl).hostname;
  const links: Array<{ url: string; score: number }> = [];

  $('a[href]').each((_, elem) => {
    const href = $(elem).attr('href');
    const text = $(elem).text().trim().toLowerCase();

    if (!href) return;

    try {
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
        absoluteUrl === baseUrl
      ) {
        return;
      }

      let score = 0;

      // Boost individual content indicators
      if (absoluteUrl.match(/\/(post|article|blog)\/[^\/]+$/)) score += 10;
      if (text.match(/read more|view details|learn more/)) score += 8;

      // Boost specific content pages
      if (text.includes('about') || absoluteUrl.includes('/about')) score += 7;
      if (absoluteUrl.match(/\/product\/[^\/]+$/)) score += 7;

      // Prefer deeper URLs (likely specific content)
      const pathDepth = new URL(absoluteUrl).pathname.split('/').filter(Boolean).length;
      if (pathDepth >= 2) score += pathDepth * 2;

      // Boost if in main content area (not navigation)
      const inMain = $(elem).closest('main, article, .content').length > 0;
      if (inMain) score += 5;

      if (score > 0) {
        links.push({ url: absoluteUrl, score });
      }
    } catch {
      // Invalid URL, skip
    }
  });

  // Remove duplicates and sort by score
  const uniqueLinks = Array.from(
    new Map(links.map((link) => [link.url, link])).values()
  );
  uniqueLinks.sort((a, b) => b.score - a.score);

  return uniqueLinks.slice(0, maxLinks).map((link) => link.url);
}

/**
 * Intelligently discover 2 additional individual content pages by browsing autonomously
 * (3 pages total including the base URL)
 *
 * PRIORITY STRATEGY:
 * 1. Homepage - overall style reference
 * 2. Blog archive - featured image patterns (if available)
 * 3. Image-rich individual pages - detailed image analysis (prefer 3+ images)
 */
export async function discoverPages(baseUrl: string, initialHtml: string): Promise<string[]> {
  console.log('[Discovery] Starting intelligent page discovery with image focus...');

  const MAX_ATTEMPTS = 20; // Increased to find image-rich pages
  const TARGET_ADDITIONAL_PAGES = 2; // 2 additional pages + base URL = 3 total
  const MIN_IMAGES_PREFERRED = 3; // Prefer pages with 3+ images

  const goodPages: Array<{ url: string; type: string; imageCount: number }> = [];
  const visited = new Set<string>();
  const toVisit: string[] = [baseUrl];

  let attempts = 0;
  let hasBlogArchive = false;

  while (goodPages.length < TARGET_ADDITIONAL_PAGES + 1 && toVisit.length > 0 && attempts < MAX_ATTEMPTS) {
    attempts++;
    const currentUrl = toVisit.shift()!;

    // Skip if already visited
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    console.log(`[Discovery] Attempt ${attempts}/${MAX_ATTEMPTS}: Checking ${currentUrl}`);

    try {
      // Get HTML (use provided HTML for initial URL, scrape for others)
      let html: string;
      if (currentUrl === baseUrl) {
        html = initialHtml;
      } else {
        const scrapedData = await scrapeWebsite(currentUrl, { timeout: 15000 });
        html = scrapedData.html;
      }

      // Classify the page
      const classification = await classifyPage(currentUrl, html);
      const imageCount = classification.imageCount || 0;

      // Check if this is a good page
      const isGoodPage =
        classification.type === 'homepage' ||
        classification.type === 'blog_archive' ||
        classification.type === 'individual_content';

      if (isGoodPage && classification.confidence >= 0.6) {
        // Special handling for blog archives (great for featured images)
        if (classification.type === 'blog_archive') {
          console.log(`[Discovery] ✓ Found blog archive: ${currentUrl} (${imageCount} images, featured: ${classification.hasFeaturedImages})`);
          goodPages.push({ url: currentUrl, type: 'blog_archive', imageCount });
          hasBlogArchive = true;
        }
        // Homepage always good
        else if (classification.type === 'homepage') {
          console.log(`[Discovery] ✓ Found homepage: ${currentUrl} (${imageCount} images)`);
          goodPages.push({ url: currentUrl, type: 'homepage', imageCount });
        }
        // Individual content - prefer pages with images
        else if (classification.type === 'individual_content') {
          if (imageCount >= MIN_IMAGES_PREFERRED) {
            console.log(`[Discovery] ✓ Found image-rich page: ${currentUrl} (${imageCount} images)`);
            goodPages.push({ url: currentUrl, type: 'individual_content', imageCount });
          } else if (imageCount > 0) {
            console.log(`[Discovery] ~ Found page with some images: ${currentUrl} (${imageCount} images)`);
            goodPages.push({ url: currentUrl, type: 'individual_content', imageCount });
          } else {
            console.log(`[Discovery] ⚠ Skipping page with no images: ${currentUrl}`);
            // Don't add to goodPages, but extract links to find better pages
          }
        }

        // If we still need more pages, add candidates
        if (goodPages.length < TARGET_ADDITIONAL_PAGES + 1) {
          const candidates = extractCandidateLinks(currentUrl, html, 5);
          candidates.forEach(url => {
            if (!visited.has(url)) toVisit.push(url);
          });
        }
      } else if (classification.type === 'navigational') {
        console.log(`[Discovery] → Navigational page detected, browsing deeper...`);

        // Use AI-suggested links if available
        if (classification.suggestedLinks && classification.suggestedLinks.length > 0) {
          const absoluteSuggestions = classification.suggestedLinks.map(link => {
            try {
              return new URL(link, currentUrl).href;
            } catch {
              return null;
            }
          }).filter(Boolean) as string[];

          absoluteSuggestions.forEach(url => {
            if (!visited.has(url)) toVisit.push(url);
          });
        } else {
          // Fallback: extract promising links ourselves
          const candidates = extractCandidateLinks(currentUrl, html, 5);
          candidates.forEach(url => {
            if (!visited.has(url)) toVisit.push(url);
          });
        }
      }
    } catch (error) {
      console.log(`[Discovery] Failed to check ${currentUrl}:`, error);
      // Continue to next page
    }
  }

  console.log(`[Discovery] Complete! Found ${goodPages.length} suitable pages after ${attempts} attempts`);

  // Log page breakdown
  const homepage = goodPages.find(p => p.type === 'homepage');
  const blogArchive = goodPages.find(p => p.type === 'blog_archive');
  const individualPages = goodPages.filter(p => p.type === 'individual_content');

  console.log('[Discovery] Page breakdown:');
  if (homepage) console.log(`  - Homepage: ${homepage.url} (${homepage.imageCount} images)`);
  if (blogArchive) console.log(`  - Blog archive: ${blogArchive.url} (${blogArchive.imageCount} images)`);
  individualPages.forEach((page, i) => {
    console.log(`  - Individual page ${i + 1}: ${page.url} (${page.imageCount} images)`);
  });

  // Sort pages by priority: homepage first, then blog archive, then by image count
  const sortedPages = goodPages.sort((a, b) => {
    if (a.type === 'homepage') return -1;
    if (b.type === 'homepage') return 1;
    if (a.type === 'blog_archive') return -1;
    if (b.type === 'blog_archive') return 1;
    return b.imageCount - a.imageCount; // More images = higher priority
  });

  // Return up to 2 additional pages (excluding the base URL if it's in the list)
  // This gives us 3 total pages: base URL + 2 additional
  const additionalPages = sortedPages
    .filter(page => page.url !== baseUrl)
    .slice(0, TARGET_ADDITIONAL_PAGES)
    .map(page => page.url);

  console.log('[Discovery] Additional pages:', additionalPages);
  console.log(`[Discovery] Total pages for analysis: ${1 + additionalPages.length} (base + ${additionalPages.length} additional)`);
  const totalImages = sortedPages.slice(0, TARGET_ADDITIONAL_PAGES + 1).reduce((sum, p) => sum + p.imageCount, 0);
  console.log(`[Discovery] Total images across all pages: ~${totalImages}`);

  return additionalPages;
}
