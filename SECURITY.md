# Security Features

## Overview

Style Stealer API implements multiple layers of security to prevent abuse and protect against malicious actors.

---

## Authentication

### Required for All Requests

**No unauthenticated access is allowed.**

Every request to `/api/generate` must include a valid API key using one of these methods:

```http
Authorization: Bearer sk-your-api-key-here
```

OR

```http
X-API-Key: sk-your-api-key-here
```

### API Key Requirements

- Must start with `sk-`
- Minimum 20 characters
- Stored securely in environment variables
- Multiple keys supported (comma-separated in `API_KEYS`)

### Unauthorized Requests

Requests without valid API keys receive:

```json
{
  "success": false,
  "error": "Unauthorized. Valid API key required."
}
```

**HTTP Status:** 401 Unauthorized

---

## Input Validation & Length Limits

### URL Length Limit

**Maximum: 2048 characters**

Prevents spam attacks with extremely long URLs.

```json
{
  "success": false,
  "error": "URL too long (max 2048 characters)"
}
```

**HTTP Status:** 400 Bad Request

### Webhook URL Length Limit

**Maximum: 2048 characters**

Prevents spam attacks with extremely long webhook URLs.

```json
{
  "success": false,
  "error": "Webhook URL too long (max 2048 characters)"
}
```

**HTTP Status:** 400 Bad Request

### Request Body Size Limit

**Maximum: 10KB**

Prevents payload spam and DoS attacks.

```json
{
  "success": false,
  "error": "Request body too large (max 10KB)"
}
```

**HTTP Status:** 413 Payload Too Large

### JSON Validation

All requests must be valid JSON.

```json
{
  "success": false,
  "error": "Invalid JSON in request body"
}
```

**HTTP Status:** 400 Bad Request

### URL Format Validation

URLs must be properly formatted and valid.

```json
{
  "success": false,
  "error": "Invalid request: Invalid URL format"
}
```

**HTTP Status:** 400 Bad Request

---

## Rate Limiting

### Per API Key

**Limit:** 100 requests per hour

Each API key can make up to 100 requests per hour.

**Response when exceeded:**

```json
{
  "success": false,
  "error": "Rate limit exceeded for your API key. Please try again later."
}
```

**HTTP Status:** 429 Too Many Requests

**Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705318200
Retry-After: 3600
```

### Global (DDoS Protection)

**Limit:** 50 requests per minute (across all users)

Protects the service from distributed denial-of-service attacks.

**Response when exceeded:**

```json
{
  "success": false,
  "error": "Service temporarily unavailable. Please try again later."
}
```

**HTTP Status:** 503 Service Unavailable

**Headers:**
```http
Retry-After: 60
```

### Auto-Blocking

When a rate limit is exceeded, the offending API key or IP is automatically blocked for **5 minutes**.

---

## Error Handling

### Sanitized Error Messages

Error messages never expose:
- Internal system details
- API keys or sensitive data
- File paths or system information
- Stack traces in production

### Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

---

## HTTPS Enforcement

### Production

All production endpoints **must** use HTTPS.

- API keys transmitted securely
- Prevents man-in-the-middle attacks
- Webhook URLs should also use HTTPS

### Development

HTTP is allowed for `localhost` development only.

---

## API Key Management

### Storage

- **Environment variables only** (`API_KEYS`)
- Never committed to git
- Never logged or exposed in responses
- Rotatable without code changes

### Multiple Keys

Support for multiple API keys:

```bash
API_KEYS=sk-prod-key-abc123,sk-backup-key-xyz789,sk-client-key-def456
```

Benefits:
- Key rotation without downtime
- Different keys for different clients
- Easy revocation of specific keys

### Key Rotation

To rotate keys:

1. Generate new key
2. Add to `API_KEYS` environment variable
3. Update clients with new key
4. Remove old key from environment variable

No code deployment required.

---

## Testing Security

### Run Security Tests

```bash
node test-security.js
```

This tests:
- ✓ Authentication requirement (no unauthenticated access)
- ✓ URL length validation (max 2048 chars)
- ✓ Webhook URL length validation (max 2048 chars)
- ✓ Request body size validation (max 10KB)
- ✓ JSON parsing validation
- ✓ URL format validation
- ✓ Valid authenticated requests work correctly

### Expected Results

All tests should PASS:
- Unauthenticated requests → 401 Unauthorized
- Long URLs → 400 Bad Request
- Large payloads → 413 Payload Too Large
- Invalid JSON → 400 Bad Request
- Invalid URLs → 400 Bad Request
- Valid authenticated requests → 200 OK

---

## Attack Vectors Prevented

### 1. Unauthorized Usage

**Attack:** Random users trying to use the API without permission

**Prevention:** Authentication required for all requests

**Response:** 401 Unauthorized

### 2. Payload Spam / DoS

**Attack:** Sending massive payloads (e.g., 5MB URL strings)

**Prevention:**
- URL length limit: 2048 characters
- Request body limit: 10KB

**Response:** 400 Bad Request or 413 Payload Too Large

### 3. Brute Force / Enumeration

**Attack:** Trying thousands of requests to discover valid data

**Prevention:**
- Rate limiting: 100 requests/hour per API key
- Auto-blocking after limit exceeded

**Response:** 429 Too Many Requests

### 4. Distributed DoS (DDoS)

**Attack:** Many users/IPs attacking simultaneously

**Prevention:**
- Global rate limit: 50 requests/minute
- Auto-blocking for 5 minutes

**Response:** 503 Service Unavailable

### 5. Malformed Requests

**Attack:** Sending invalid JSON, malformed URLs, etc.

**Prevention:**
- Strict JSON parsing
- Zod schema validation
- URL format validation

**Response:** 400 Bad Request

### 6. API Key Leakage

**Attack:** Exposing API keys in error messages or logs

**Prevention:**
- Never log API keys
- Sanitized error messages
- Environment variable storage only

**Response:** Keys remain secure

---

## Security Headers

All responses include appropriate security headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705318200
```

When rate limited:

```http
Retry-After: 3600
```

---

## Best Practices

### For API Administrators

1. **Strong API Keys**: Use cryptographically random keys
2. **Key Rotation**: Rotate keys periodically
3. **Monitor Usage**: Track rate limit hits and failures
4. **HTTPS Only**: Never use HTTP in production
5. **Environment Variables**: Never commit keys to git

### For API Users

1. **Secure Storage**: Store API keys securely (env vars, secrets manager)
2. **Rate Limit Headers**: Monitor remaining requests
3. **Error Handling**: Implement retry logic with exponential backoff
4. **HTTPS**: Always use HTTPS endpoints
5. **Validate Input**: Validate URLs before sending

---

## Security Checklist

Before deploying to production:

- [ ] `API_KEYS` environment variable is set
- [ ] API keys are strong and random (min 20 chars)
- [ ] API keys are not in git repository
- [ ] HTTPS is enforced
- [ ] Rate limits are configured appropriately
- [ ] Error messages don't expose sensitive data
- [ ] Logging doesn't include API keys
- [ ] Security tests pass (`node test-security.js`)
- [ ] Health check endpoint is accessible
- [ ] Webhook URLs are validated

---

## Incident Response

### Suspected Compromise

If an API key is compromised:

1. **Immediately** remove the key from `API_KEYS`
2. Generate a new key
3. Update affected clients
4. Review logs for suspicious activity
5. Monitor for abuse

### DDoS Attack

If under attack:

1. Check global rate limit logs
2. Verify legitimate traffic is working
3. Consider temporarily lowering `RATE_LIMIT_GLOBAL`
4. Railway will auto-scale if needed
5. Contact Railway support if sustained

### Abuse Detection

Monitor for:
- Repeated 429 responses (rate limit abuse)
- Repeated 401 responses (unauthorized attempts)
- Unusual traffic patterns
- Unexpected cost increases

---

## Compliance

### Data Privacy

- No personal data is collected
- URLs are logged (consider privacy implications)
- Webhook URLs are logged (may contain sensitive paths)

### Recommendations

- Inform users that URLs are processed
- Implement data retention policies
- Consider GDPR compliance if needed
- Document data handling in privacy policy

---

## Updates & Maintenance

### Security Updates

This document reflects security measures as of v1.0.0.

For updates:
- Check git commits for security-related changes
- Review `CHANGELOG.md` for security fixes
- Subscribe to dependency vulnerability alerts

### Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** create a public GitHub issue
2. Email: [your-security-email]
3. Include: detailed description, steps to reproduce
4. Allow reasonable time for fix before disclosure

---

## Additional Resources

- [API Documentation](API-DOCUMENTATION.md)
- [Railway Deployment Guide](RAILWAY-DEPLOYMENT.md)
- [Rate Limiter Implementation](lib/rate-limiter.ts)
- [Authentication Implementation](lib/auth.ts)
