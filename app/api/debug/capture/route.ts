import { NextRequest, NextResponse } from 'next/server';
import { protocolCapture } from '@/server/secureye/protocol-capture';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get('format');
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);

  if (format === 'export') {
    const jsonStr = protocolCapture.exportSanitized();
    return new NextResponse(jsonStr, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="secureye_protocol_capture_${Date.now()}.json"`,
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      enabled: protocolCapture.isEnabled(),
      packets: protocolCapture.getRecent(limit),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { enabled, clear } = await req.json();
    if (enabled !== undefined) {
      protocolCapture.setEnabled(Boolean(enabled));
    }
    if (clear) {
      protocolCapture.clear();
    }
    return NextResponse.json({
      success: true,
      data: { enabled: protocolCapture.isEnabled() },
    });
  } catch {
    return NextResponse.json({ success: false, error: { code: 'INVALID_INPUT', message: 'Failed to update capture settings' } }, { status: 400 });
  }
}
