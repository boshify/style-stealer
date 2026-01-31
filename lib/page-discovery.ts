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
  type: 'individual_content' | 'navigational' | 'homepage';
  confidence: number; // 0-1
  reasoning: string;
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

  const prompt = `Analyze this webpage and classify it into one of three categories:

1. **individual_content**: A specific content page like:
   - Blog post / article
   - Product page
   - Landing page with specific focus
   - About page
   - Case study
   - Service detail page

2. **navigational**: A list/index/category page like:
   - Blog archive / category list
   - Product listing page
   - Search results
   - Tag/category pages
   - Site map

3. **homepage**: The main homepage/landing page

**Page Information:**
URL: ${url}
Title: ${title}
H1 count: ${h1Count}
Article tags: ${articleCount}
List items: ${listItemCount}

**First 20 Links:**
${links.slice(0, 20).join('\n')}

**Content Preview:**
${mainContent || 'No main content found'}

**Important Rules:**
- Homepage is GOOD for analysis (even if it has many links)
- Individual content pages are GOOD for analysis
- Navigational/list/category pages are BAD - we need to browse deeper
- If it's navigational, suggest 2-3 specific links that likely lead to individual content

Respond in JSON format:
{
  "type": "individual_content" | "navigational" | "homepage",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
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
 * Intelligently discover 2 individual content pages by browsing autonomously
 */
export async function discoverPages(baseUrl: string, initialHtml: string): Promise<string[]> {
  console.log('[Discovery] Starting intelligent page discovery...');

  const MAX_ATTEMPTS = 10; // Prevent infinite browsing
  const goodPages: string[] = [];
  const visited = new Set<string>();
  const toVisit: string[] = [baseUrl];

  let attempts = 0;

  while (goodPages.length < 2 && toVisit.length > 0 && attempts < MAX_ATTEMPTS) {
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

      // Check if this is a good page
      if (classification.type === 'individual_content' || classification.type === 'homepage') {
        if (classification.confidence >= 0.6) {
          console.log(`[Discovery] ✓ Found good page: ${currentUrl} (${classification.type})`);
          goodPages.push(currentUrl);

          // If we still need more pages, add some candidates
          if (goodPages.length < 2) {
            const candidates = extractCandidateLinks(currentUrl, html, 5);
            candidates.forEach(url => {
              if (!visited.has(url)) toVisit.push(url);
            });
          }
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

  // Return up to 2 additional pages (excluding the base URL if it's in the list)
  const additionalPages = goodPages.filter(url => url !== baseUrl).slice(0, 2);
  console.log('[Discovery] Additional pages:', additionalPages);

  return additionalPages;
}
