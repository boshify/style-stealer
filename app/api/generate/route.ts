/**
 * API Route: POST /api/generate
 * Generates a comprehensive style guide by analyzing multiple pages from a website
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Force dynamic rendering - don't try to prerender this API route during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { scrapeWebsite } from '@/lib/scraper';
import { parseStyles } from '@/lib/parser';
import { generateStyleGuide, analyzeImages, combineReports } from '@/lib/ai';
import { discoverPages } from '@/lib/page-discovery';
import { isValidUrl } from '@/lib/utils';
import { authenticate, extractApiKey } from '@/lib/auth';
import { rateLimitByApiKey, rateLimitGlobal } from '@/lib/rate-limiter';
import { postToWebhook, isValidWebhookUrl } from '@/lib/webhook';
import type { GenerateRequest, GenerateResponse } from '@/lib/types';
import { storeResult, generateRequestId } from '@/lib/storage';

// Request validation schema with strict length limits
const RequestSchema = z.object({
  url: z
    .string()
    .min(1, 'URL is required')
    .max(2048, 'URL too long (max 2048 characters)')
    .url('Invalid URL format'),
  webhook_url: z
    .string()
    .max(2048, 'Webhook URL too long (max 2048 characters)')
    .url('Invalid webhook URL')
    .optional(),
  projectId: z
    .string()
    .max(256, 'Project ID too long (max 256 characters)')
    .optional(), // Optional project ID to track requests
  async: z.boolean().optional(), // Enable async processing with polling
});

/**
 * POST handler - Generate comprehensive multi-page style guide
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Step 1: Authentication
    if (!authenticate(request)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Valid API key required.',
        } as GenerateResponse,
        { status: 401 }
      );
    }

    // Step 2: Global rate limiting (protect against DDoS)
    const globalLimit = rateLimitGlobal();
    if (!globalLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Service temporarily unavailable. Please try again later.',
        } as GenerateResponse,
        {
          status: 503,
          headers: {
            'Retry-After': Math.ceil((globalLimit.resetAt - Date.now()) / 1000).toString(),
          }
        }
      );
    }

    // Step 3: Parse and validate request body with size limit
    let body: GenerateRequest;
    try {
      const text = await request.text();

      // Limit request body size to 10KB to prevent abuse
      if (text.length > 10240) {
        return NextResponse.json(
          {
            success: false,
            error: 'Request body too large (max 10KB)',
          } as GenerateResponse,
          { status: 413 }
        );
      }

      body = JSON.parse(text);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        } as GenerateResponse,
        { status: 400 }
      );
    }

    const validation = RequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request: ' + validation.error.errors[0].message,
        } as GenerateResponse,
        { status: 400 }
      );
    }

    const { url, webhook_url, projectId, async: isAsync } = validation.data;

    // Validate webhook URL if provided
    if (webhook_url && !isValidWebhookUrl(webhook_url)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid webhook URL format',
        } as GenerateResponse,
        { status: 400 }
      );
    }

    // Additional URL validation
    if (!isValidUrl(url)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or inaccessible URL',
        } as GenerateResponse,
        { status: 400 }
      );
    }

    // Step 4: Rate limiting by API key only (authentication required)
    // Note: No unauthenticated usage allowed - API key is required above
    const apiKey = extractApiKey(request) || 'unknown';
    const keyLimit = rateLimitByApiKey(apiKey);

    if (!keyLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded for your API key. Please try again later.',
        } as GenerateResponse,
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': keyLimit.resetAt.toString(),
            'Retry-After': Math.ceil((keyLimit.resetAt - Date.now()) / 1000).toString(),
          }
        }
      );
    }

    // Hack URL: Return instant dummy data for testing
    if (url === 'https://website.com/test') {
      console.log('[API] Test URL detected - returning dummy data');
      const dummyResponse = {
        success: true,
        markdown: getDummyStyleGuide(),
        generationTime: 42,
        pagesAnalyzed: 3,
      } as GenerateResponse;

      // Post to webhook if provided
      if (webhook_url) {
        await postToWebhook(webhook_url, {
          url,
          markdown: getDummyStyleGuide(),
          generationTime: 42,
          pagesAnalyzed: 3,
          projectId,
          timestamp: new Date().toISOString(),
        });
      }

      return NextResponse.json(dummyResponse, {
        headers: {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': keyLimit.remaining.toString(),
          'X-RateLimit-Reset': keyLimit.resetAt.toString(),
        }
      });
    }

    // Check if async processing is requested
    if (isAsync) {
      const requestId = generateRequestId();

      // Store initial status
      storeResult({
        requestId,
        status: 'processing',
        createdAt: Date.now(),
      });

      // Start background processing
      processAsync(requestId, url, webhook_url, projectId, startTime).catch((error: unknown) => {
        console.error('[API:Async] Background processing error:', error);
        storeResult({
          requestId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          createdAt: Date.now(),
        });
      });

      // Return immediately with request ID
      return NextResponse.json({
        success: true,
        requestId,
        status: 'processing',
        message: 'Request accepted for processing. Poll /api/results/' + requestId + ' for status.',
      }, {
        headers: {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': keyLimit.remaining.toString(),
          'X-RateLimit-Reset': keyLimit.resetAt.toString(),
        }
      });
    }

    console.log(`\n[API] ======= Starting multi-page analysis for: ${url} =======`);

    // Step 1: Scrape the primary page to discover additional pages
    console.log('[API] Step 1: Scraping primary page for page discovery...');
    const primaryScrapedData = await scrapeWebsite(url, {
      timeout: 30000,
    });
    console.log('[API] ✓ Primary page scraped');

    // Step 2: Discover 2 additional pages
    console.log('[API] Step 2: Discovering additional pages...');
    const additionalPages = await discoverPages(url, primaryScrapedData.html);
    console.log(`[API] ✓ Found ${additionalPages.length} additional pages:`, additionalPages);

    // Step 3: Analyze all pages concurrently (primary + additional)
    const allPages = [url, ...additionalPages];
    console.log(`[API] Step 3: Analyzing ${allPages.length} pages concurrently...`);

    const pageReports = await Promise.all(
      allPages.map((pageUrl, index) =>
        analyzeSinglePage(pageUrl, index + 1, allPages.length)
      )
    );

    // Filter out any failed analyses
    const successfulReports = pageReports.filter((report) => report !== null) as Array<{
      url: string;
      markdown: string;
    }>;

    console.log(`[API] ✓ Successfully analyzed ${successfulReports.length}/${allPages.length} pages`);

    if (successfulReports.length === 0) {
      throw new Error('Failed to analyze any pages');
    }

    // Step 4: Combine all reports into one comprehensive style guide
    console.log('[API] Step 4: Combining reports...');
    const combinedMarkdown = await combineReports(successfulReports);
    console.log('[API] ✓ Reports combined successfully');

    const generationTime = Date.now() - startTime;
    console.log(`[API] ======= Complete! Generated in ${(generationTime / 1000).toFixed(2)}s =======\n`);

    // Post to webhook if provided
    if (webhook_url) {
      console.log('[API] Posting to webhook...');
      const webhookSuccess = await postToWebhook(webhook_url, {
        url,
        markdown: combinedMarkdown,
        generationTime,
        pagesAnalyzed: successfulReports.length,
        projectId,
        timestamp: new Date().toISOString(),
      });

      if (webhookSuccess) {
        console.log('[API] ✓ Webhook posted successfully');
      } else {
        console.log('[API] ⚠ Webhook post failed (continuing)');
      }
    }

    // Success response with rate limit headers
    return NextResponse.json({
      success: true,
      markdown: combinedMarkdown,
      generationTime,
      pagesAnalyzed: successfulReports.length,
    } as GenerateResponse, {
      headers: {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': keyLimit.remaining.toString(),
        'X-RateLimit-Reset': keyLimit.resetAt.toString(),
      }
    });
  } catch (error) {
    console.error('[API] Error:', error);

    const generationTime = Date.now() - startTime;

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('aborted')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Request timeout - the website took too long to respond',
            generationTime,
          } as GenerateResponse,
          { status: 504 }
        );
      }

      if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Website not found or refused connection',
            generationTime,
          } as GenerateResponse,
          { status: 404 }
        );
      }

      if (error.message.includes('API key')) {
        return NextResponse.json(
          {
            success: false,
            error: 'AI service configuration error',
            generationTime,
          } as GenerateResponse,
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          generationTime,
        } as GenerateResponse,
        { status: 500 }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
        generationTime,
      } as GenerateResponse,
      { status: 500 }
    );
  }
}

/**
 * Analyze a single page - runs the full pipeline (scrape → parse → image analysis → generate)
 * Returns null if analysis fails for this specific page
 */
async function analyzeSinglePage(
  url: string,
  pageNum: number,
  totalPages: number
): Promise<{ url: string; markdown: string } | null> {
  try {
    console.log(`\n[Page ${pageNum}/${totalPages}] Starting analysis: ${url}`);

    // Scrape
    console.log(`[Page ${pageNum}/${totalPages}] Scraping...`);
    const scrapedData = await scrapeWebsite(url, { timeout: 30000 });
    console.log(`[Page ${pageNum}/${totalPages}] ✓ Scraped (method: ${scrapedData.method})`);

    // Parse styles
    console.log(`[Page ${pageNum}/${totalPages}] Parsing styles...`);
    const tokens = parseStyles(scrapedData, {
      extractColors: true,
      extractTypography: true,
      extractLayout: true,
      extractSpacing: true,
      extractVisual: true,
      minColorFrequency: 2,
      groupSimilarColors: true,
      colorSimilarityThreshold: 20,
    });
    console.log(`[Page ${pageNum}/${totalPages}] ✓ Parsed (${tokens.colors.length} colors, ${tokens.imagery.imageUrls.length} images)`);

    // Analyze images
    if (tokens.imagery.imageUrls.length > 0) {
      console.log(`[Page ${pageNum}/${totalPages}] Analyzing images...`);
      try {
        const imageAnalysis = await analyzeImages(tokens.imagery.imageUrls, url);
        if (imageAnalysis) {
          tokens.imagery.analysis = imageAnalysis;
          console.log(`[Page ${pageNum}/${totalPages}] ✓ Image analysis complete`);
        }
      } catch (error) {
        console.log(`[Page ${pageNum}/${totalPages}] ⚠ Image analysis failed (continuing):`, error);
      }
    } else {
      console.log(`[Page ${pageNum}/${totalPages}] No images to analyze`);
    }

    // Generate style guide
    console.log(`[Page ${pageNum}/${totalPages}] Generating style guide...`);
    const markdown = await generateStyleGuide(tokens);
    console.log(`[Page ${pageNum}/${totalPages}] ✓ Style guide generated (${markdown.length} chars)`);

    return { url, markdown };
  } catch (error) {
    console.error(`[Page ${pageNum}/${totalPages}] ✗ Failed to analyze:`, error);
    return null;
  }
}

/**
 * GET handler - Not allowed
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST to generate a style guide.',
    },
    { status: 405 }
  );
}

/**
 * Generate dummy style guide for testing (https://website.com/test)
 */
function getDummyStyleGuide(): string {
  return `# Style Guide: Test Website

## Overview

This is a dummy style guide generated instantly for testing purposes. Based on analysis of multiple pages, this modern design system emphasizes clean typography, vibrant color choices, and a professional aesthetic suitable for contemporary web applications.

## Color Palette

### Primary Colors
- **Deep Navy** (\`#1a2b3c\`) - Primary brand color, headers, navigation
- **Bright Blue** (\`#4a90e2\`) - Interactive elements, links, primary buttons
- **White** (\`#ffffff\`) - Background, clean base

### Accent Colors
- **Vibrant Orange** (\`#ff6b35\`) - Call-to-action buttons, highlights
- **Soft Gray** (\`#f5f5f5\`) - Section backgrounds, subtle divisions
- **Dark Gray** (\`#333333\`) - Body text, secondary elements

## Typography

**Primary Font**: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif

**Type Scale:**
- H1: 48px / 600 weight - Page titles
- H2: 36px / 600 weight - Section headers
- H3: 24px / 500 weight - Subsection headers
- Body: 16px / 400 weight - Main content
- Small: 14px / 400 weight - Captions, metadata

**Line Height:** 1.6 for body text, 1.2 for headings

## Layout & Spacing

**Grid System:** 12-column responsive grid
**Max Content Width:** 1200px
**Breakpoints:**
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

**Spacing Scale:** 8px base unit
- XS: 8px
- S: 16px
- M: 24px
- L: 32px
- XL: 48px
- XXL: 64px

## Visual Style

**Border Radius:** 4px for buttons/cards, 8px for larger containers
**Shadows:**
- Small: 0 2px 4px rgba(0,0,0,0.1)
- Medium: 0 4px 12px rgba(0,0,0,0.15)
- Large: 0 8px 24px rgba(0,0,0,0.2)

**Transitions:** 200ms ease-in-out for interactive elements

## Imagery & Icons

### Image Style
- **Type:** Professional photography mixed with custom illustrations
- **Tone:** Modern, approachable, high-quality
- **Color Palette:** Aligned with brand colors (navy, blue, orange)
- **Subject:** Product showcases, team photos, abstract patterns

### Image Types Found
- **Hero Images**: Large, impactful photography with subtle overlays
- **Illustrations**: Flat vector graphics with clean lines and vibrant colors
- **Charts/Graphs**: Data visualizations using brand color palette
- **Icons**: Line-style SVG icons at 24px baseline

### Technical Details
- **Composition:** Rule of thirds, balanced, professional framing
- **Lighting:** Soft, even lighting with minimal harsh shadows
- **Rendering:** High-resolution images (2x retina), optimized for web

## Component Patterns

**Buttons:**
- Primary: Solid orange fill (\`#ff6b35\`), white text, 4px radius
- Secondary: Navy outline, navy text, 4px radius
- Padding: 12px 24px

**Cards:**
- White background, subtle shadow, 8px radius
- 24px padding, hover lift effect

**Navigation:**
- Sticky header, horizontal menu on desktop
- Hamburger menu on mobile
- Navy background with white text

---

*This is a test style guide generated for https://website.com/test*`;
}

/**
 * Process request asynchronously in background
 */
async function processAsync(
  requestId: string,
  url: string,
  webhook_url: string | undefined,
  projectId: string | undefined,
  startTime: number
): Promise<void> {
  try {
    console.log(`\n[API:Async:${requestId}] Starting background processing for: ${url}`);

    // Step 1: Scrape the primary page
    const primaryScrapedData = await scrapeWebsite(url, { timeout: 30000 });

    // Step 2: Discover additional pages
    const additionalPages = await discoverPages(url, primaryScrapedData.html);
    const allPages = [url, ...additionalPages];

    // Step 3: Analyze all pages concurrently
    const pageReports = await Promise.all(
      allPages.map((pageUrl, index) =>
        analyzeSinglePage(pageUrl, index + 1, allPages.length)
      )
    );

    const successfulReports = pageReports.filter((report) => report !== null) as Array<{
      url: string;
      markdown: string;
    }>;

    if (successfulReports.length === 0) {
      throw new Error('Failed to analyze any pages');
    }

    // Step 4: Combine reports
    const combinedMarkdown = await combineReports(successfulReports);
    const generationTime = Date.now() - startTime;

    console.log(`[API:Async:${requestId}] Complete! Generated in ${(generationTime / 1000).toFixed(2)}s`);

    // Update result storage
    storeResult({
      requestId,
      status: 'completed',
      markdown: combinedMarkdown,
      generationTime,
      pagesAnalyzed: successfulReports.length,
      createdAt: Date.now(),
    });

    // Post to webhook if provided (n8n)
    const n8nWebhook = process.env.N8N_WEBHOOK_URL;
    if (n8nWebhook) {
      console.log(`[API:Async:${requestId}] Posting to n8n webhook...`);
      await postToWebhook(n8nWebhook, {
        requestId,
        url,
        markdown: combinedMarkdown,
        generationTime,
        pagesAnalyzed: successfulReports.length,
        projectId,
        timestamp: new Date().toISOString(),
      });
    }

    // Post to user-provided webhook if specified
    if (webhook_url) {
      console.log(`[API:Async:${requestId}] Posting to user webhook...`);
      await postToWebhook(webhook_url, {
        requestId,
        url,
        markdown: combinedMarkdown,
        generationTime,
        pagesAnalyzed: successfulReports.length,
        projectId,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error(`[API:Async:${requestId}] Error:`, error);
    storeResult({
      requestId,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      createdAt: Date.now(),
    });
  }
}
