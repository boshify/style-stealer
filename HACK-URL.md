# Hack URL - Instant Test Data

## Overview
A special test URL that returns instant dummy data without scraping, parsing, or AI generation. Useful for quick testing and API development.

## Usage

### Test URL
```
https://website.com/test
```

When this exact URL is submitted, the API immediately returns a pre-generated style guide with dummy data.

### Response Time
- **< 1 second** (instant)
- No scraping
- No parsing
- No AI API calls
- No cost

### Example Request
```javascript
fetch('http://localhost:3002/api/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://website.com/test'
  }),
})
```

### Example Response
```json
{
  "success": true,
  "markdown": "# Style Guide: Test Website\n\n## Overview\n\nThis is a dummy style guide...",
  "generationTime": 42,
  "pagesAnalyzed": 3
}
```

## Dummy Data Contents

The dummy style guide includes:
- **Overview**: Description of modern design system
- **Color Palette**: Primary and accent colors with hex codes
- **Typography**: Font families, type scale, line heights
- **Layout & Spacing**: Grid system, breakpoints, spacing scale
- **Visual Style**: Border radius, shadows, transitions
- **Imagery & Icons**: Image styles, types found, technical details
- **Component Patterns**: Buttons, cards, navigation examples

## Use Cases

### 1. Quick Testing
Test the frontend UI without waiting for real generation:
```bash
node test-hack-url.js
```

### 2. API Development
When building API integrations or client libraries, use this URL for fast iteration without consuming API credits.

### 3. Demo/Presentation
Show the application working without network delays or API dependencies.

### 4. CI/CD Tests
Use in automated tests to verify the complete pipeline without external dependencies:
```javascript
describe('Style Guide Generation', () => {
  it('should generate style guide', async () => {
    const response = await fetch('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://website.com/test' })
    });
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.markdown).toContain('Style Guide');
  });
});
```

### 5. Load Testing
Generate many requests quickly to test server capacity without rate limits or API costs.

## Implementation Details

### Location
[app/api/generate/route.ts](app/api/generate/route.ts) - Line 73-80

### Code
```typescript
// Hack URL: Return instant dummy data for testing
if (url === 'https://website.com/test') {
  console.log('[API] Test URL detected - returning dummy data');
  return NextResponse.json({
    success: true,
    markdown: getDummyStyleGuide(),
    generationTime: 42,
    pagesAnalyzed: 3,
  } as GenerateResponse);
}
```

### Dummy Data Generator
Function: `getDummyStyleGuide()` at bottom of [app/api/generate/route.ts](app/api/generate/route.ts)

Returns a complete, realistic-looking style guide with:
- 2941 characters of Markdown
- All standard sections (colors, typography, layout, etc.)
- Realistic color codes and measurements
- Professional formatting

## Notes

### Security
- This is a development/testing feature
- Consider removing or protecting in production
- Does not expose any sensitive data
- Does not consume resources

### Validation
- URL must match exactly: `https://website.com/test`
- Case sensitive
- Still validates URL format through Zod schema
- Still passes rate limiting checks

### Behavior
- Bypasses all normal processing steps
- Returns before any scraping/parsing/AI calls
- Uses minimal server resources
- Consistent response every time

## Testing

### Run the test script:
```bash
node test-hack-url.js
```

### Expected output:
```
Testing hack URL: https://website.com/test
Should return instantly with dummy data...

Request sent...
Response received in 0.641s
Response status: 200

=== RESPONSE ===
✓ Success!
Generation time: 42 ms
Pages analyzed: 3
Markdown length: 2941 chars
✓ Dummy data detected!
```

## Future Enhancements

### Possible Additions
1. Multiple test URLs for different scenarios:
   - `https://website.com/test-minimal` - Minimal design
   - `https://website.com/test-complex` - Complex multi-page design
   - `https://website.com/test-error` - Simulate error scenarios

2. Query parameters for customization:
   - `https://website.com/test?colors=5` - Control number of colors
   - `https://website.com/test?pages=5` - Simulate more pages

3. Environment-based toggle:
   - Only enable in development/staging
   - Disable in production via env var

4. Response headers to indicate test data:
   - `X-Test-Data: true`
   - `X-Generation-Type: dummy`
