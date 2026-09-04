import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { writeAuditLog, extractIp } from "@/lib/audit-logger";

// Muted routes: too noisy or self-referential to log
const MUTED_PATHS = [
  "/api/auth/me",
  "/api/audit/",
  "/api/notifications",
  "/api/stats",
];

function isMuted(pathname: string): boolean {
  return MUTED_PATHS.some((p) => pathname.startsWith(p));
}

function inferAction(method: string, pathname: string): string {
  const p = pathname.toLowerCase();
  if (p.includes("/login"))   return "LOGIN";
  if (p.includes("/logout"))  return "LOGOUT";
  if (p.includes("/approve")) return "APPROVE";
  if (p.includes("/reject"))  return "REJECT";
  if (p.includes("/action"))  return "DECISION_CHANGE";
  if (p.includes("/leaves"))  return method === "POST" ? "LEAVE_APPLY" : "LEAVE_READ";
  if (p.includes("/employees")) return method === "POST" ? "EMPLOYEE_CREATE" : method === "PUT" ? "EMPLOYEE_UPDATE" : method === "DELETE" ? "EMPLOYEE_DELETE" : "EMPLOYEE_READ";
  if (p.includes("/payroll")) return "PAYROLL_ACCESS";
  if (p.includes("/regularize")) return method === "POST" ? "REGULARIZE_APPLY" : "REGULARIZE_ACTION";
  if (p.includes("/settings")) return "SETTINGS_CHANGE";
  if (p.includes("/roles"))   return "ROLES_ACCESS";
  if (p.includes("/reports")) return "REPORT_ACCESS";
  if (p.includes("/passkeys")) return "PASSKEY_ACTION";
  if (p.includes("/devices")) return "DEVICE_ACTION";
  if (p.includes("/attendance")) return "ATTENDANCE_ACCESS";
  if (p.includes("/holidays")) return "HOLIDAY_ACCESS";
  if (p.includes("/announcements")) return "ANNOUNCEMENT_ACCESS";
  if (p.includes("/balances")) return method === "POST" ? "BALANCE_ADJUST" : "BALANCE_READ";
  return method + "_API_CALL";
}

type RouteHandler = (req: NextRequest, ctx?: any) => Promise<NextResponse>;

/**
 * withAuditLog — wraps a Next.js API route handler and automatically logs
 * every request to the audit_logs collection with full geo/ISP/device context.
 *
 * Usage:
 *   export const POST = withAuditLog(async (req) => { ... });
 */
export function withAuditLog(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx?: any): Promise<NextResponse> => {
    const pathname = req.nextUrl.pathname;
    const method   = req.method;
    const start    = Date.now();

    // Execute the original handler first
    const response = await handler(req, ctx);

    // Skip audit for muted paths
    if (isMuted(pathname)) return response;

    // Fire-and-forget audit log (non-blocking)
    getAuthSession(req).then((session) => {
      writeAuditLog({
        userId:     session?.userId,
        userName:   session?.name,
        userRole:   session?.role,
        employeeId: session?.employeeId || undefined,
        action:     inferAction(method, pathname),
        resource:   pathname,
        method,
        ip:         extractIp(req),
        userAgent:  req.headers.get("user-agent") || "",
        statusCode: response.status,
        durationMs: Date.now() - start,
      });
    }).catch(() => {});

    return response;
  };
}
