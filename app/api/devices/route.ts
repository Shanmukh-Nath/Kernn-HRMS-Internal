import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function isValidIp(ip: string): boolean {
  // Disallow cloud metadata IP addresses to prevent SSRF
  if (ip === '169.254.169.254' || ip === '::ffff:169.254.169.254') {
    return false;
  }
  const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.){3}(25[0-5]|(2[0-4]|1\d|[1-9]|)\d)$/;
  return ipv4Regex.test(ip) || ip === 'localhost' || ip === '127.0.0.1';
}

export async function GET() {
  try {
    const devices = await prisma.device.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            employees: true,
            attendance: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: devices,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Database query failed' },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, ipAddress, port = 80, deviceId, protocol = 'Secureye/FKWeb', pollingEnabled = true, pollingInterval = 3000 } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Device name is required.' } },
        { status: 400 }
      );
    }

    if (!ipAddress || !isValidIp(ipAddress)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_IP', message: 'A valid IP address is required. Link-local metadata IPs are blocked.' } },
        { status: 400 }
      );
    }

    const portNum = parseInt(String(port), 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PORT', message: 'Port must be an integer between 1 and 65535.' } },
        { status: 400 }
      );
    }

    const intervalNum = Math.max(1000, parseInt(String(pollingInterval || 3000), 10));
    const effectiveDeviceId = deviceId?.trim() || `SFB3K_${Date.now().toString(36)}`;

    const created = await prisma.device.create({
      data: {
        name: name.trim(),
        ipAddress: ipAddress.trim(),
        port: portNum,
        deviceId: effectiveDeviceId,
        protocol,
        pollingEnabled: Boolean(pollingEnabled),
        pollingInterval: intervalNum,
        status: 'OFFLINE',
      },
    });

    return NextResponse.json({
      success: true,
      data: created,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'CREATE_ERROR', message: err instanceof Error ? err.message : 'Failed to create device.' },
      },
      { status: 500 }
    );
  }
}
