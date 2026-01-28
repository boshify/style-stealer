/**
 * API Authentication and Authorization
 */

import { NextRequest } from 'next/server';

/**
 * Valid API key format: sk-xxxxxxxxxxxx (min 20 chars)
 */
export function isValidApiKey(apiKey: string | null): boolean {
  if (!apiKey) return false;

  // Must start with sk- and be at least 20 characters
  if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
    return false;
  }

  return true;
}

/**
 * Extract API key from request headers
 * Supports multiple header formats:
 * - Authorization: Bearer sk-xxx
 * - X-API-Key: sk-xxx
 */
export function extractApiKey(request: NextRequest): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1];
    }
  }

  // Check X-API-Key header
  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  return null;
}

/**
 * Verify API key against environment variable
 * Supports multiple API keys separated by commas
 */
export function verifyApiKey(providedKey: string): boolean {
  const validKeys = process.env.API_KEYS || '';

  // Split by comma and trim whitespace
  const keys = validKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);

  if (keys.length === 0) {
    console.warn('[Auth] No API keys configured in environment');
    return false;
  }

  // Check if provided key matches any valid key
  return keys.includes(providedKey);
}

/**
 * Complete authentication check
 * Returns true if authenticated, false otherwise
 */
export function authenticate(request: NextRequest): boolean {
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    console.log('[Auth] No API key provided');
    return false;
  }

  if (!isValidApiKey(apiKey)) {
    console.log('[Auth] Invalid API key format');
    return false;
  }

  if (!verifyApiKey(apiKey)) {
    console.log('[Auth] API key verification failed');
    return false;
  }

  console.log('[Auth] ✓ Authentication successful');
  return true;
}
