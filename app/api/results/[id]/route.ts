/**
 * API Route: /api/results/:id
 * GET: Fetch result status by request ID (for frontend polling)
 * POST: Store result from n8n webhook (with authentication)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getResult, updateResult } from '@/lib/storage';
import { extractApiKey, isValidApiKey, verifyApiKey } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET handler - Fetch result status
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;

  const result = getResult(id);

  if (!result) {
    return NextResponse.json(
      { error: 'Result not found or expired' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    requestId: result.requestId,
    status: result.status,
    markdown: result.markdown,
    error: result.error,
    generationTime: result.generationTime,
    pagesAnalyzed: result.pagesAnalyzed,
  });
}

/**
 * POST handler - Store result from n8n (requires authentication)
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  // Authenticate - require API key for posting results
  const apiKey = extractApiKey(request);
  if (!apiKey || !isValidApiKey(apiKey) || !verifyApiKey(apiKey)) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid API key required.' },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.status) {
      return NextResponse.json(
        { error: 'Missing required field: status' },
        { status: 400 }
      );
    }

    // Update result
    updateResult(id, {
      status: body.status,
      markdown: body.markdown,
      error: body.error,
      generationTime: body.generationTime,
      pagesAnalyzed: body.pagesAnalyzed,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API:Results] Error storing result:', error);
    return NextResponse.json(
      { error: 'Failed to store result' },
      { status: 500 }
    );
  }
}
