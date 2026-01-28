/**
 * Health check endpoint for Railway and monitoring
 */

import { NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'style-stealer',
    version: '1.0.0',
  });
}
