import { NextResponse } from 'next/server';
import { selectableProviders } from '@/lib/eainesy/model-routing';

/**
 * Public metadata only: allowlisted, configured provider IDs.
 * No API keys, model names, endpoints or health-check requests.
 */
export async function GET() {
  return NextResponse.json({
    providers: selectableProviders(),
    roles: ['parser','generator'],
    switching: 'new-session-only',
    runtimeVerified: false,
  }, {headers:{'Cache-Control':'no-store'}});
}
