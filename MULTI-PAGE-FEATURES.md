# Multi-Page Analysis Features

## Overview
The Style Stealer now supports intelligent multi-page analysis for comprehensive style guide generation.

## New Features

### 1. Automatic Page Discovery
- **File**: `lib/page-discovery.ts`
- **Function**: `discoverPages(baseUrl, html)`
- Automatically discovers 2 additional relevant pages from the same website
- Prioritizes: About, Services, Products, Portfolio, Blog, Contact pages
- Scores pages based on:
  - Page type importance (about = 10, services = 9, etc.)
  - Navigation prominence (nav/header links get +5 bonus)
  - URL depth (shorter URLs are more important)
- Filters out: admin, login, cart, checkout, feed pages

### 2. Concurrent Multi-Page Analysis
- **File**: `app/api/generate/route.ts`
- Analyzes 3 pages simultaneously using `Promise.all()`
- Each page goes through complete pipeline:
  1. Scraping (Cheerio + Playwright fallback)
  2. CSS/HTML parsing
  3. AI-powered image analysis
  4. Style guide generation
- Graceful failure handling: continues with successful pages if some fail
- Detailed logging for each page: `[Page 1/3]`, `[Page 2/3]`, etc.

### 3. Enhanced Image Analysis
- **File**: `lib/ai.ts`
- Increased from 4 to 6 representative images per page
- Increased token limit from 1024 to 2048 for detailed descriptions
- **New analysis fields**:
  - `imageTypes`: Array of `{type, count, description}` for each image type
    - Featured Images, Photos, Illustrations, Screenshots, Charts, Tables, Icons, Diagrams
  - `technicalDetails`: Object with `{compositionStyle, lightingStyle, renderingStyle}`
- **Vivid descriptions** suitable for AI image generation:
  - Composition (layout, framing, rule of thirds)
  - Color palette with specific names (e.g., "Deep Navy Blue")
  - Lighting (direction, quality, mood, shadows)
  - Texture and detail level
  - Typography in images
  - Background treatment
  - Visual effects
  - Aspect ratio and dimensions

### 4. Report Combination
- **File**: `lib/ai.ts`
- **Function**: `combineReports(reports)`
- Uses Claude API to synthesize multiple reports into one
- **Combination strategy**:
  1. Identifies common patterns across all pages
  2. Preserves unique details from each page
  3. Removes redundancy
  4. Synthesizes conflicts (notes variations by page type)
  5. Mentions multi-page analysis in Overview section
- Outputs clean, unescaped Markdown (no manual JSON escaping needed)

### 5. Updated Types
- **File**: `lib/types.ts`
- Enhanced `ImageAnalysis` interface with:
  - `imageTypes?`: Detailed breakdown by image type
  - `technicalDetails?`: Composition, lighting, rendering styles

## API Response Changes

### New Fields
```json
{
  "success": true,
  "markdown": "...",
  "generationTime": 90978,
  "pagesAnalyzed": 2  // NEW: Number of pages successfully analyzed
}
```

## Performance

### Timing
- Single page: ~55 seconds
- Multi-page (3 pages): ~90 seconds
- Pages analyzed concurrently (not sequentially)
- Combination adds ~10-15 seconds

### Cost
- Approximately $0.05-$0.15 per generation (depending on number of images and pages)
- Uses Haiku model for text generation (cost-efficient)
- Uses Sonnet model for image analysis (falls back to Haiku if not available)

## Logging

### Enhanced Console Output
```
[API] ======= Starting multi-page analysis for: <url> =======
[API] Step 1: Scraping primary page for page discovery...
[API] ✓ Primary page scraped
[API] Step 2: Discovering additional pages...
[Discovery] Finding additional pages to analyze...
[Discovery] Selected pages: [url1, url2]
[API] ✓ Found 2 additional pages
[API] Step 3: Analyzing 3 pages concurrently...

[Page 1/3] Starting analysis: <url>
[Page 1/3] Scraping...
[Page 1/3] ✓ Scraped (method: cheerio)
[Page 1/3] Parsing styles...
[Page 1/3] ✓ Parsed (17 colors, 10 images)
[Page 1/3] Analyzing images...
[AI:Images] Analyzing 10 images...
[AI:Images] Selected 6 images for analysis
[AI:Images] ✓ Image analysis complete
[Page 1/3] Generating style guide...
[Page 1/3] ✓ Style guide generated (2834 chars)

[API] ✓ Successfully analyzed 2/3 pages
[API] Step 4: Combining reports...
[AI:Combine] Combining 2 style guide reports...
[AI:Combine] Successfully combined reports
[API] ✓ Reports combined successfully
[API] ======= Complete! Generated in 90.98s =======
```

## Error Handling

### Graceful Degradation
- If a page fails to scrape: continues with other pages
- If image analysis fails: continues without image details
- If page discovery fails: proceeds with just the primary page
- If combination fails: returns error (since this is critical)
- Always logs which pages succeeded/failed

### Playwright Fallback
- If Playwright browsers not installed: page may fail
- Error message guides user to run `npx playwright install`
- Other pages continue processing

## Testing

### Test Scripts
- `test-multipage.js`: Tests the complete multi-page workflow
- Run with: `node test-multipage.js`
- Expected time: 60-120 seconds

### Manual Testing
```bash
# Start dev server
npm run dev

# In another terminal, run test
node test-multipage.js

# Check output for:
# - "Pages analyzed: 2" or "Pages analyzed: 3"
# - "✓ Multi-page analysis detected in output!"
# - "✓ Detailed image type descriptions found!"
```

## Future Enhancements

### Potential Improvements
1. Configurable page count (currently fixed at 2 additional pages)
2. Page type filtering (e.g., only analyze blog posts, skip about pages)
3. Caching of discovered pages to avoid re-analysis
4. Parallel Playwright instances for better fallback performance
5. Image analysis caching across pages (avoid re-analyzing identical images)
6. Support for sitemap.xml parsing for page discovery
7. Adaptive discovery based on site structure (WordPress vs static site)

## Notes

### JSON Safety
- API responses are automatically JSON-safe via `NextResponse.json()`
- No manual escaping needed
- Removed buggy `escapeForJSON` utility functions

### Browser Support
- Cheerio (fast): Works for 90%+ of websites
- Playwright (slow): Fallback for JavaScript-heavy sites
- Requires `npx playwright install` for full functionality

### Rate Limiting
- Still applies: 10 requests/hour per IP
- Multi-page analysis counts as 1 request
- Consider increasing limit for production use
