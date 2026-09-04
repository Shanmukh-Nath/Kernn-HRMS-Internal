import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import {
  recordAuditLog,
  extractClientIp,
  resolveIpGeoAndIsp,
  parseUserAgent,
  AuditEventPayload,
} from '@/lib/audit-logger';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const body = await req.json();

    const clientIp = extractClientIp(req);
    const userAgentStr = req.headers.get('user-agent') || '';

    // If client supplied telemetry (screen resolution, viewport, client timezone)
    const clientDevice = body.clientDevice || {};
    const parsedDevice = parseUserAgent(userAgentStr);

    const device = {
      ...parsedDevice,
      screenResolution: clientDevice.screenResolution,
      viewportSize: clientDevice.viewportSize,
      platform: clientDevice.platform,
      clientTimezone: clientDevice.clientTimezone,
      language: clientDevice.language,
    };

    // Pre-resolve Geo & ISP for accuracy
    const geo = await resolveIpGeoAndIsp(clientIp);

    // If events array is provided (batched events)
    const events: any[] = Array.isArray(body.events) ? body.events : [body];

    for (const evt of events) {
      if (!evt || !evt.action) continue;

      const payload: AuditEventPayload = {
        eventType: evt.eventType || 'BUTTON_CLICK',
        action: evt.action,
        resource: evt.resource || evt.path || undefined,
        method: evt.method || 'UI',
        statusCode: evt.statusCode || 200,
        durationMs: evt.durationMs || 0,
        user: session
          ? {
              userId: session.userId,
              employeeId: session.employeeId,
              name: session.name,
              email: session.email,
              mobileNumber: session.mobileNumber,
              role: session.role,
              department: session.department,
              designation: session.designation,
            }
          : {
              userId: 'ANONYMOUS',
              name: 'Unauthenticated User',
              role: 'GUEST',
            },
        ip: clientIp,
        geo,
        device,
        targetElement: evt.targetElement || null,
        metadata: evt.metadata || {},
        riskLevel: evt.riskLevel || undefined,
        timestamp: evt.timestamp ? new Date(evt.timestamp) : new Date(),
      };

      await recordAuditLog(payload);
    }

    return NextResponse.json({ success: true, count: events.length });
  } catch (err: any) {
    console.error('[API /api/audit/track] Error recording audit event:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
