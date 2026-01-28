/**
 * Health check endpoint for Railway and monitoring
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'style-stealer',
    version: '1.0.0',
  });
}
