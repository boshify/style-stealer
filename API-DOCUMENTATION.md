# Style Stealer API Documentation

## Overview
Production-ready API for generating comprehensive style guides from websites using AI-powered analysis.

## Base URL
```
Production: https://your-app.railway.app
Development: http://localhost:3002
```

## Authentication

### API Key Required
All requests must include a valid API key using one of these methods:

**Method 1: Bearer Token (Recommended)**
```http
Authorization: Bearer sk-your-api-key-here
```

**Method 2: API Key Header**
```http
X-API-Key: sk-your-api-key-here
```

### API Key Format
- Must start with `sk-`
- Minimum 20 characters
- Example: `sk-stylesstealer-prod-key-87654321`

### Getting an API Key
Contact the administrator to obtain an API key.

---

## Endpoints

### 1. Generate Style Guide

Generate a comprehensive style guide from a website URL.

**Endpoint:** `POST /api/generate`

**Headers:**
```http
Content-Type: application/json
Authorization: Bearer sk-your-api-key-here
```

**Request Body:**
```json
{
  "url": "https://example.com",
  "webhook_url": "https://your-webhook.com/endpoint" // optional
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| url | string | Yes | Website URL to analyze |
| webhook_url | string | No | Webhook URL to post results to |

**Response (Success):**
```json
{
  "success": true,
  "markdown": "# Style Guide: Example Website\n\n...",
  "generationTime": 90657,
  "pagesAnalyzed": 3
}
```

**Response Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

**Example Request (cURL):**
```bash
curl -X POST https://your-app.railway.app/api/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key-here" \
  -d '{
    "url": "https://stripe.com",
    "webhook_url": "https://webhook.site/your-unique-url"
  }'
```

**Example Request (JavaScript):**
```javascript
const response = await fetch('https://your-app.railway.app/api/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-your-api-key-here'
  },
  body: JSON.stringify({
    url: 'https://stripe.com',
    webhook_url: 'https://webhook.site/your-unique-url'
  })
});

const data = await response.json();
console.log(data.markdown);
```

**Example Request (n8n Workflow):**
```json
{
  "method": "POST",
  "url": "https://your-app.railway.app/api/generate",
  "headers": {
    "Authorization": "Bearer sk-your-api-key-here"
  },
  "body": {
    "url": "{{$json.website_url}}",
    "webhook_url": "{{$json.webhook_url}}"
  }
}
```

---

### 2. Health Check

Check if the service is running.

**Endpoint:** `GET /api/health`

**No authentication required**

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "style-stealer",
  "version": "1.0.0"
}
```

---

## Webhook Integration

### Webhook Payload

When a `webhook_url` is provided, the API will POST the results to that URL after generation completes.

**Webhook Request:**
```http
POST {webhook_url}
Content-Type: application/json
User-Agent: StyleStealer/1.0
```

**Webhook Payload:**
```json
{
  "url": "https://example.com",
  "markdown": "# Style Guide: Example Website\n\n...",
  "generationTime": 90657,
  "pagesAnalyzed": 3,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Webhook Response
Your webhook endpoint should return a 2xx status code to indicate success.

---

## Rate Limiting

### Limits

All requests require authentication. Rate limits apply per API key and globally.

| Type | Limit | Window |
|------|-------|--------|
| Per API Key | 100 requests | 1 hour |
| Global (DDoS protection) | 50 requests | 1 minute |

**Note:** No unauthenticated access is allowed. All requests must include a valid API key.

### Rate Limit Headers

Every response includes rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the limit resets

### Rate Limit Exceeded

**Response (429):**
```json
{
  "success": false,
  "error": "Rate limit exceeded for your API key. Please try again later."
}
```

**Headers:**
```http
Retry-After: 3600
```

---

## Error Responses

### Authentication Errors

**401 Unauthorized:**
```json
{
  "success": false,
  "error": "Unauthorized. Valid API key required."
}
```

**Cause:** Missing or invalid API key

---

### Validation Errors

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Invalid request: Invalid URL format"
}
```

**Causes:**
- Invalid URL format
- Invalid webhook URL format
- Missing required fields

---

### Service Errors

**503 Service Unavailable:**
```json
{
  "success": false,
  "error": "Service temporarily unavailable. Please try again later."
}
```

**Cause:** Global rate limit exceeded (DDoS protection)

**504 Gateway Timeout:**
```json
{
  "success": false,
  "error": "Request timeout - the website took too long to respond",
  "generationTime": 120000
}
```

**Cause:** Target website didn't respond in time

**404 Not Found:**
```json
{
  "success": false,
  "error": "Website not found or refused connection",
  "generationTime": 5000
}
```

**Cause:** Target website is unreachable

---

## Testing

### Test URL

Use the special test URL to get instant dummy data:

```json
{
  "url": "https://website.com/test"
}
```

**Response:** Instant dummy style guide (< 1 second, no cost)

---

## Performance

### Typical Response Times
- Single page: ~55 seconds
- Multi-page (3 pages): ~90 seconds
- Test URL: < 1 second

### What Happens During Generation?
1. **Page Discovery** (~2s): Finds 2 additional relevant pages
2. **Concurrent Scraping** (~5-10s): Scrapes 3 pages simultaneously
3. **CSS/HTML Parsing** (~2-3s per page): Extracts design tokens
4. **AI Image Analysis** (~15-20s per page): Analyzes 6 images per page
5. **Style Guide Generation** (~10-15s per page): Generates markdown
6. **Report Combination** (~10-15s): Synthesizes all reports

### Cost per Request
- Approximately $0.05 - $0.15 per generation
- Depends on number of images and pages analyzed

---

## n8n Integration Example

### 1. HTTP Request Node

**Method:** POST
**URL:** `https://your-app.railway.app/api/generate`

**Headers:**
```json
{
  "Authorization": "Bearer sk-your-api-key-here"
}
```

**Body:**
```json
{
  "url": "{{$json.website_url}}",
  "webhook_url": "{{$json.callback_url}}"
}
```

### 2. Webhook Response Node

Set up a webhook to receive the results:

**Webhook URL:** `https://your-n8n.com/webhook/style-guide-result`

The webhook will receive:
```json
{
  "url": "https://example.com",
  "markdown": "# Style Guide...",
  "generationTime": 90657,
  "pagesAnalyzed": 3,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 3. Complete Workflow

```
Trigger
  → Set website URL
  → HTTP Request (POST /api/generate)
  → [Optional] Wait for webhook
  → Process markdown result
  → Save to database/send email/etc.
```

---

## Security

### Authentication Required
- **No unauthenticated access allowed**
- All requests must include a valid API key
- Invalid or missing API keys return 401 Unauthorized
- Protects against unauthorized usage and abuse

### Input Validation & Length Limits
- **URL length**: Maximum 2048 characters
- **Webhook URL length**: Maximum 2048 characters
- **Request body size**: Maximum 10KB (prevents payload spam)
- URL format validation (Zod schema)
- Webhook URL format validation
- JSON parsing validation
- Sanitized error messages (no sensitive data exposed)

### Rate Limiting
- **API key-based**: 100 requests per hour per key
- **Global (DDoS protection)**: 50 requests per minute across all users
- Automatic 5-minute block after limit exceeded
- Rate limit headers in all responses
- Note: No IP-based limiting (authentication required instead)

### API Key Storage
- Environment variables only
- Never logged or exposed in responses
- Supports multiple keys for rotation
- Minimum 20 characters, must start with `sk-`

### HTTPS Required
- All production endpoints must use HTTPS
- API keys transmitted securely
- Webhook URLs must use HTTPS in production

---

## Deployment on Railway

### Prerequisites
1. Railway account
2. GitHub repository

### Steps

**1. Connect Repository:**
```bash
railway link
```

**2. Set Environment Variables:**
```bash
railway variables set ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
railway variables set API_KEYS=sk-your-api-key-1,sk-your-api-key-2
railway variables set RATE_LIMIT_PER_HOUR=10
railway variables set RATE_LIMIT_API_KEY=100
railway variables set RATE_LIMIT_GLOBAL=50
```

**3. Deploy:**
```bash
railway up
```

**4. Get URL:**
```bash
railway domain
```

### Environment Variables Required

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| ANTHROPIC_API_KEY | Yes | - | Anthropic API key for AI |
| API_KEYS | Yes | - | Comma-separated API keys |
| RATE_LIMIT_PER_HOUR | No | 10 | Requests/hour per IP |
| RATE_LIMIT_API_KEY | No | 100 | Requests/hour per API key |
| RATE_LIMIT_GLOBAL | No | 50 | Global requests/minute |

### Railway Configuration

See `railway.json` for build and deployment settings.

**Health Check:** `/api/health`

---

## Best Practices

### 1. Use Webhooks for Long Operations
Since generation takes 60-120 seconds, use webhooks for async processing:

```javascript
// Don't wait for response
fetch('/api/generate', {
  method: 'POST',
  body: JSON.stringify({
    url: 'https://example.com',
    webhook_url: 'https://your-webhook.com/callback'
  })
});

// Handle result in webhook endpoint
```

### 2. Handle Rate Limits Gracefully
```javascript
const response = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer sk-your-key' },
  body: JSON.stringify({ url: 'https://example.com' })
});

if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  console.log(`Rate limited. Retry after ${retryAfter} seconds`);
  // Implement exponential backoff
}
```

### 3. Monitor Rate Limit Headers
```javascript
const remaining = response.headers.get('X-RateLimit-Remaining');
if (remaining < 10) {
  console.warn('Approaching rate limit!');
}
```

### 4. Use Test URL for Development
```javascript
// Development/testing
const testUrl = 'https://website.com/test';

// Production
const realUrl = 'https://example.com';
```

---

## Support

### Common Issues

**"Unauthorized" error:**
- Check API key format (must start with `sk-`)
- Verify API key is in environment variables
- Check Authorization header format

**"Rate limit exceeded":**
- Wait for the time specified in `Retry-After` header
- Consider upgrading rate limits
- Use test URL for development

**"Request timeout":**
- Target website is slow or unresponsive
- Try again later
- Some complex sites may exceed timeout limits

**"Website not found":**
- Verify URL is correct and publicly accessible
- Check if website has anti-bot protection
- Ensure website uses HTTPS

---

## Changelog

### v1.0.0 (2024-01-15)
- Initial release
- Multi-page analysis
- AI-powered image descriptions
- Webhook support
- Railway deployment ready
- Comprehensive security and rate limiting
