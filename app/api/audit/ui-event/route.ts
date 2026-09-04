import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { writeAuditLog, extractIp } from "@/lib/audit-logger";

export const dynamic = "force-dynamic";

// Receives UI-side action events (button clicks, form submits) from the client
// and enriches them server-side with real IP geo/ISP before persisting.
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const body = await req.json();

    const ip = extractIp(req);
    const ua = req.headers.get("user-agent") || "";

    writeAuditLog({
      userId:    session?.userId,
      userName:  session?.name,
      userRole:  session?.role,
      employeeId: session?.employeeId || undefined,
      action:    body.action   || "UI_ACTION",
      resource:  body.resource || "unknown",
      method:    "UI",
      ip,
      userAgent: ua,
      statusCode: body.statusCode,
      durationMs: body.durationMs,
      extra:     body.extra,
    });

    return NextResponse.json({ success: true });
  } catch {
    // Always return 200 — audit failures must never break client UX
    return NextResponse.json({ success: true });
  }
}
