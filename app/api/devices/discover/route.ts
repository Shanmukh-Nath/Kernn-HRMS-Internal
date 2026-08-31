import { NextRequest, NextResponse } from 'next/server';
import { getLocalNetworkInterfaces, getArpTable, scanSubnet } from '@/server/secureye/scanner';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const interfaces = getLocalNetworkInterfaces();
    const primaryInterface = interfaces.find((i) => !i.name.toLowerCase().includes('virtual') && !i.name.toLowerCase().includes('vgate')) || interfaces[0];

    const subnetPrefix = primaryInterface ? primaryInterface.subnetPrefix : '192.168.1';
    const discovered = await scanSubnet(subnetPrefix, 1, 254);

    return NextResponse.json({
      success: true,
      data: {
        interfaces,
        scannedSubnet: `${subnetPrefix}.0/24`,
        devices: discovered,
        totalFound: discovered.length,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SCAN_ERROR', message: err instanceof Error ? err.message : 'Network scan failed' },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subnetPrefix, startHost = 1, endHost = 254, ports } = body;

    if (!subnetPrefix) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'subnetPrefix is required (e.g. "192.168.29")' } },
        { status: 400 }
      );
    }

    const parts = subnetPrefix.split('.');
    const cleanPrefix = parts.length >= 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : subnetPrefix.trim();
    const discovered = await scanSubnet(cleanPrefix, startHost, endHost, ports);

    return NextResponse.json({
      success: true,
      data: {
        scannedSubnet: `${cleanPrefix}.${startHost}-${endHost}`,
        devices: discovered,
        totalFound: discovered.length,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SCAN_ERROR', message: err instanceof Error ? err.message : 'Custom network scan failed' },
      },
      { status: 500 }
    );
  }
}
