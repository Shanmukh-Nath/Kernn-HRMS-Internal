import { NextRequest, NextResponse } from 'next/server';
import { handleIncomingDevicePacket } from '@/server/secureye/handlers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || '127.0.0.1';

  // Extract raw headers from incoming NextRequest
  const rawHeaders: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    rawHeaders[key] = value;
  });

  const arrayBuffer = await req.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuffer);

  try {
    const result = await handleIncomingDevicePacket(rawHeaders, rawBuffer, clientIp);

    // Format response according to FKWeb requirements
    const headers = new Headers();
    Object.entries(result.headers).forEach(([k, v]) => {
      headers.set(k, v);
    });

    const bodyBytes = new Uint8Array(result.body);

    return new NextResponse(bodyBytes, {
      status: result.statusCode,
      headers,
    });
  } catch (err: unknown) {
    console.error('Fatal error in device endpoint:', err);
    return new NextResponse(new Uint8Array(0), {
      status: 200,
      headers: {
        'response_code': 'OK',
        'Connection': 'close',
      },
    });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Secureye S-FB3K Biometric Ingestion Endpoint',
    protocol: 'FKWeb / Realand Dialect',
    status: 'ACTIVE',
    usage: 'Configure device Server IP to point here via POST.',
  });
}
