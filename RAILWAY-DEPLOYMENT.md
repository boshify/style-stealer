# Railway Deployment Guide

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Your code must be in a GitHub repository
3. **Anthropic API Key**: Get from [console.anthropic.com](https://console.anthropic.com)

---

## Quick Deploy

### Option 1: Railway CLI (Recommended)

**1. Install Railway CLI:**
```bash
npm install -g @railway/cli
```

**2. Login:**
```bash
railway login
```

**3. Initialize:**
```bash
cd style-stealer
railway init
```

**4. Set Environment Variables:**
```bash
# Anthropic API Key
railway variables set ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# API Keys (comma-separated)
railway variables set API_KEYS=sk-stylesstealer-prod-key-12345678,sk-stylesstealer-backup-key-87654321

# Rate Limits (optional, these are defaults)
railway variables set RATE_LIMIT_PER_HOUR=10
railway variables set RATE_LIMIT_API_KEY=100
railway variables set RATE_LIMIT_GLOBAL=50
```

**5. Deploy:**
```bash
railway up
```

**6. Get Your URL:**
```bash
railway domain
```

### Option 2: Railway Dashboard

**1. Create New Project:**
- Go to [railway.app/new](https://railway.app/new)
- Click "Deploy from GitHub repo"
- Select your repository

**2. Configure Build:**
- Build Command: `npm run build` (auto-detected)
- Start Command: `npm start` (auto-detected)

**3. Add Environment Variables:**

Click "Variables" tab and add:

```
ANTHROPIC_API_KEY = sk-ant-api03-your-key-here
API_KEYS = sk-stylesstealer-prod-key-12345678,sk-stylesstealer-backup-key-87654321
RATE_LIMIT_PER_HOUR = 10
RATE_LIMIT_API_KEY = 100
RATE_LIMIT_GLOBAL = 50
```

**4. Deploy:**
- Click "Deploy" or push to your GitHub repo
- Railway will automatically build and deploy

**5. Get Your URL:**
- Click "Settings" → "Domains"
- Copy the Railway-provided URL
- Or add a custom domain

---

## Environment Variables Explained

### Required Variables

**ANTHROPIC_API_KEY**
- Your Anthropic API key for Claude
- Format: `sk-ant-api03-...`
- Get from: [console.anthropic.com](https://console.anthropic.com)

**API_KEYS**
- Comma-separated list of valid API keys for your API
- Format: `sk-xxxxxxxxxxxx` (min 20 chars each)
- Example: `sk-prod-key-abc123,sk-backup-key-xyz789`
- Users need one of these keys to use your API

### Optional Variables

**RATE_LIMIT_PER_HOUR** (default: 10)
- Requests per hour for unauthenticated/IP-based limit
- Lower = stricter rate limiting

**RATE_LIMIT_API_KEY** (default: 100)
- Requests per hour per authenticated API key
- Higher = more generous for valid API keys

**RATE_LIMIT_GLOBAL** (default: 50)
- Global requests per minute across all users
- DDoS protection layer

---

## Generating API Keys

API keys should be:
- Unique and random
- Start with `sk-`
- At least 20 characters
- Kept secure

**Generate with Node:**
```javascript
const crypto = require('crypto');
const apiKey = 'sk-' + crypto.randomBytes(16).toString('hex');
console.log(apiKey);
// Output: sk-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**Generate with OpenSSL:**
```bash
echo "sk-$(openssl rand -hex 16)"
```

**Generate Online:**
- Use [randomkeygen.com](https://randomkeygen.com)
- Add `sk-` prefix manually

---

## Post-Deployment

### 1. Test Health Check

```bash
curl https://your-app.railway.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "style-stealer",
  "version": "1.0.0"
}
```

### 2. Test API with Authentication

```bash
curl -X POST https://your-app.railway.app/api/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-api-key-here" \
  -d '{
    "url": "https://website.com/test"
  }'
```

Expected response:
```json
{
  "success": true,
  "markdown": "# Style Guide: Test Website\n\n...",
  "generationTime": 42,
  "pagesAnalyzed": 3
}
```

### 3. Verify Rate Limit Headers

Check response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1705318200
```

---

## Railway Configuration

The `railway.json` file configures:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

- **Builder**: NIXPACKS (auto-detects Next.js)
- **Health Check**: `/api/health` endpoint
- **Restart Policy**: Restarts on failure (max 10 retries)
- **Timeout**: 300 seconds (5 minutes)

---

## Custom Domain

### Add Custom Domain in Railway

**1. Go to Settings → Domains**

**2. Click "Add Domain"**

**3. Enter your domain:**
```
api.yourdomain.com
```

**4. Add DNS Records:**

Railway will show you DNS records to add:
```
CNAME    api    your-app.railway.app
```

**5. Wait for DNS Propagation:**
- Usually takes 5-30 minutes
- Check with: `dig api.yourdomain.com`

---

## Monitoring

### View Logs

**CLI:**
```bash
railway logs
```

**Dashboard:**
- Go to your project
- Click "Deployments"
- Click on a deployment
- View logs in real-time

### Common Log Patterns

**Successful Request:**
```
[API] ======= Starting multi-page analysis =======
[API] ✓ Primary page scraped
[API] ✓ Found 2 additional pages
[API] ✓ Successfully analyzed 3/3 pages
[API] ✓ Reports combined successfully
[API] ======= Complete! Generated in 90.98s =======
```

**Authentication Failure:**
```
[Auth] No API key provided
```

**Rate Limit Hit:**
```
[RateLimit] IP: 1.2.3.4 exceeded limit
```

---

## Troubleshooting

### Build Failures

**Error: "Module not found"**
```bash
# Make sure all dependencies are in package.json
npm install
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

**Error: "Build timeout"**
```bash
# Increase build timeout in Railway dashboard
# Settings → Timeout → 600 seconds
```

### Runtime Errors

**Error: "ANTHROPIC_API_KEY not set"**
- Check environment variables in Railway dashboard
- Verify the key is correctly set

**Error: "API_KEYS not configured"**
- Add API_KEYS environment variable
- Format: `sk-key1,sk-key2,sk-key3`

**Error: "Port already in use"**
- Railway auto-assigns ports
- Don't hardcode port 3000 in production
- Next.js will use Railway's $PORT automatically

### Performance Issues

**Slow Response Times:**
- Check Anthropic API status
- Verify network connectivity
- Check Railway metrics for CPU/memory usage

**High Memory Usage:**
- Playwright browsers use significant memory
- Consider increasing Railway plan
- Monitor memory usage in dashboard

---

## Scaling

### Horizontal Scaling

Railway supports autoscaling:

**1. Enable in Dashboard:**
- Settings → Autoscaling
- Set min/max replicas
- Configure scale metrics

**2. Considerations:**
- Rate limiting is in-memory (use Redis for distributed)
- Each replica has separate rate limit counters
- Consider upgrading to Redis for shared state

### Vertical Scaling

Upgrade Railway plan for:
- More CPU
- More RAM (needed for Playwright)
- Higher network limits

---

## Security Checklist

- [ ] ANTHROPIC_API_KEY is set and valid
- [ ] API_KEYS contains strong, random keys
- [ ] API_KEYS are kept secret (not in git)
- [ ] Rate limits are configured appropriately
- [ ] HTTPS is enabled (automatic on Railway)
- [ ] Custom domain has SSL certificate
- [ ] Logs don't expose sensitive data

---

## Cost Estimation

### Railway Costs
- **Starter Plan**: $5/month (500 hours)
- **Developer Plan**: $20/month (unlimited hours)
- Recommended: Developer Plan for production

### Anthropic API Costs
- Haiku (text): ~$0.25 per million input tokens
- Haiku (vision): ~$0.80 per million input tokens
- Estimated cost per request: $0.05 - $0.15

### Total Monthly Cost Example
- Railway: $20/month
- 1000 requests/month: $50-150
- **Total**: ~$70-170/month

---

## Backup & Disaster Recovery

### Environment Variables Backup

```bash
# Export to file
railway variables > railway-vars-backup.txt

# IMPORTANT: Keep this file secure!
# Add to .gitignore
```

### Deployment Rollback

```bash
# List deployments
railway status

# Rollback to previous
railway rollback
```

### Database (Future)

If you add a database:
- Railway has automatic backups
- Enable Point-in-Time Recovery
- Test restore procedure

---

## Production Checklist

Before going live:

- [ ] Environment variables are set correctly
- [ ] Health check returns 200 OK
- [ ] API authentication works
- [ ] Rate limiting is tested
- [ ] Webhook posting works
- [ ] Custom domain is configured
- [ ] SSL certificate is active
- [ ] Logs are being captured
- [ ] Monitoring is set up
- [ ] API keys are documented securely
- [ ] Team has access to Railway project
- [ ] Backup/rollback procedure is documented

---

## Support

### Railway Support
- Documentation: [docs.railway.app](https://docs.railway.app)
- Discord: [discord.gg/railway](https://discord.gg/railway)
- Email: team@railway.app

### Style Stealer Support
- GitHub Issues
- API Documentation: See `API-DOCUMENTATION.md`

---

## Next Steps

1. **Set up monitoring**: Use Railway metrics or external service
2. **Add logging**: Consider structured logging (Winston, Pino)
3. **Add analytics**: Track API usage, popular websites
4. **Add caching**: Cache style guides for repeated URLs
5. **Add webhooks**: Notify when rate limits are hit
6. **Add Redis**: Distributed rate limiting for multiple replicas

---

## Useful Commands

```bash
# View logs
railway logs

# View environment variables
railway variables

# Deploy current branch
railway up

# Rollback deployment
railway rollback

# Open in browser
railway open

# Link to project
railway link

# View service info
railway status
```
