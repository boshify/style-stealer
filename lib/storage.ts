/**
 * In-memory storage for async results
 * In production, use Redis or database
 */

interface StoredResult {
  requestId: string;
  status: 'processing' | 'completed' | 'error';
  markdown?: string;
  error?: string;
  generationTime?: number;
  pagesAnalyzed?: number;
  createdAt: number;
}

// In-memory storage (replace with Redis in production)
const results = new Map<string, StoredResult>();

// Clean up old results after 1 hour
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const MAX_AGE = 60 * 60 * 1000; // 1 hour

setInterval(() => {
  const now = Date.now();
  for (const [id, result] of results.entries()) {
    if (now - result.createdAt > MAX_AGE) {
      results.delete(id);
    }
  }
}, CLEANUP_INTERVAL);

export function storeResult(result: StoredResult) {
  results.set(result.requestId, result);
}

export function getResult(requestId: string): StoredResult | undefined {
  return results.get(requestId);
}

export function updateResult(requestId: string, updates: Partial<StoredResult>) {
  const existing = results.get(requestId);
  if (existing) {
    results.set(requestId, { ...existing, ...updates });
  }
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
