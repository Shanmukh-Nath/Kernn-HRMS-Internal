import { auditLogsCol } from '@/lib/mongodb';
import { NextRequest } from 'next/server';

export interface GeoLocationInfo {
  ip: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  district?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  asName?: string;
  isVpnOrProxy?: boolean;
  isMobile?: boolean;
  source?: 'PUBLIC_IP_API' | 'LOCAL_CACHE' | 'FALLBACK';
}

export interface DeviceInfo {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET' | 'BOT' | 'UNKNOWN';
  rawUserAgent: string;
  screenResolution?: string;
  viewportSize?: string;
  platform?: string;
  clientTimezone?: string;
  language?: string;
}

export interface AuditEventPayload {
  id?: string;
  eventType: 'API_CALL' | 'BUTTON_CLICK' | 'FORM_SUBMIT' | 'PAGE_NAVIGATION' | 'DATA_EXPORT' | 'SECURITY_EVENT' | 'OVERRIDE';
  action: string;
  resource?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  user?: {
    userId?: string;
    employeeId?: string | null;
    name?: string;
    email?: string | null;
    mobileNumber?: string;
    role?: string;
    department?: string | null;
    designation?: string | null;
  } | null;
  ip?: string;
  geo?: GeoLocationInfo;
  device?: DeviceInfo;
  targetElement?: {
    tag?: string;
    text?: string;
    id?: string;
    classes?: string;
    path?: string;
    coordinates?: { x: number; y: number };
  };
  metadata?: Record<string, any>;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp?: Date;
}

// In-memory cache for IP Geolocation & ISP to prevent redundant external API queries
const geoCache = new Map<string, { data: GeoLocationInfo; expiresAt: number }>();
let cachedEgressIp: { ip: string; expiresAt: number } | null = null;

/**
 * Determine if an IP address is a private, loopback, or local link IP
 */
export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  const clean = ip.trim().replace(/^::ffff:/, '');
  if (clean === '::1' || clean === '127.0.0.1' || clean === 'localhost') return true;
  if (clean.startsWith('10.') || clean.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return true;
  if (clean.startsWith('fc00:') || clean.startsWith('fe80:')) return true;
  return false;
}

/**
 * Detect outbound public IP of this server/network (used in local/intranet environments)
 */
async function getOutboundPublicIp(): Promise<string | null> {
  const now = Date.now();
  if (cachedEgressIp && cachedEgressIp.expiresAt > now) {
    return cachedEgressIp.ip;
  }

  const providers = [
    'https://api.ipify.org?format=json',
    'https://api64.ipify.org?format=json',
    'https://ifconfig.me/all.json',
  ];

  for (const url of providers) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const ip = data.ip || data.ip_addr;
        if (ip && !isPrivateIp(ip)) {
          cachedEgressIp = { ip, expiresAt: now + 15 * 60 * 1000 }; // 15 mins cache
          return ip;
        }
      }
    } catch (_) {}
  }
  return null;
}

/**
 * Extract client IP from Next.js request headers
 */
export function extractClientIp(req?: NextRequest | Request | { headers: Headers | Record<string, string | null | undefined> }): string {
  if (!req) return '127.0.0.1';

  const getHeader = (name: string): string | null => {
    if ('headers' in req) {
      const h = req.headers;
      if (typeof (h as any).get === 'function') {
        return (h as Headers).get(name);
      }
      return (h as Record<string, string | null | undefined>)[name] || null;
    }
    return null;
  };

  const xForwardedFor = getHeader('x-forwarded-for');
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map((s) => s.trim());
    // Find first public IP if available
    const publicCandidate = ips.find((ip) => !isPrivateIp(ip));
    if (publicCandidate) return publicCandidate;
    return ips[0];
  }

  const cfConnectingIp = getHeader('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();

  const xRealIp = getHeader('x-real-ip');
  if (xRealIp) return xRealIp.trim();

  const xClientIp = getHeader('x-client-ip');
  if (xClientIp) return xClientIp.trim();

  return '127.0.0.1';
}

/**
 * Resolve IP Geolocation, ISP, and Autonomous System details accurately
 */
export async function resolveIpGeoAndIsp(clientIp: string): Promise<GeoLocationInfo> {
  let targetIp = clientIp.trim();

  // If local / loopback, resolve actual public egress IP so we still get accurate ISP & Location
  if (isPrivateIp(targetIp)) {
    const publicEgress = await getOutboundPublicIp();
    if (publicEgress) {
      targetIp = publicEgress;
    }
  }

  // Check cache
  const cached = geoCache.get(targetIp);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, ip: clientIp };
  }

  // Fallback default for fully offline or unresolvable private IPs
  if (isPrivateIp(targetIp)) {
    const defaultLocal: GeoLocationInfo = {
      ip: clientIp,
      country: 'Local Network / Corporate LAN',
      countryCode: 'LAN',
      regionName: 'Secureye Biometric Gateway',
      city: 'Headquarters Internal Subnet',
      isp: 'Secureye HRMS Dedicated Ethernet Gateway',
      org: 'Kernn Automations Corporate Network',
      timezone: 'Asia/Kolkata',
      isVpnOrProxy: false,
      isMobile: false,
      source: 'FALLBACK',
    };
    return defaultLocal;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    // ip-api.com returns comprehensive ISP, AS, org, location, and mobile/proxy flags
    const res = await fetch(
      `http://ip-api.com/json/${targetIp}?fields=status,message,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        const geoInfo: GeoLocationInfo = {
          ip: clientIp,
          country: data.country || 'Unknown',
          countryCode: data.countryCode || 'XX',
          region: data.region || '',
          regionName: data.regionName || '',
          city: data.city || '',
          district: data.district || '',
          zip: data.zip || '',
          lat: data.lat,
          lon: data.lon,
          timezone: data.timezone || 'UTC',
          isp: data.isp || 'Unknown ISP',
          org: data.org || data.isp || 'Unknown Org',
          as: data.as || '',
          asName: data.asname || '',
          isVpnOrProxy: Boolean(data.proxy || data.hosting),
          isMobile: Boolean(data.mobile),
          source: 'PUBLIC_IP_API',
        };

        // Cache for 2 hours
        geoCache.set(targetIp, {
          data: geoInfo,
          expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        });

        return geoInfo;
      }
    }
  } catch (err) {
    console.warn('[AuditLogger] Geolocation API lookup error:', err);
  }

  // Graceful fallback
  return {
    ip: clientIp,
    country: 'Global Internet',
    countryCode: 'NET',
    regionName: 'Public Routed IP',
    city: 'External Network',
    isp: 'Standard Internet Gateway',
    org: 'External ISP',
    timezone: 'Asia/Kolkata',
    source: 'FALLBACK',
  };
}

/**
 * Parse User-Agent string to extract Browser, OS, and Device Category
 */
export function parseUserAgent(uaString: string = ''): DeviceInfo {
  const ua = uaString.toLowerCase();

  let browser = 'Unknown Browser';
  let browserVersion = '';
  let os = 'Unknown OS';
  let osVersion = '';
  let deviceType: DeviceInfo['deviceType'] = 'DESKTOP';

  // Device type detection
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) {
    deviceType = 'MOBILE';
  } else if (/ipad|android(?!.*mobile)|tablet/i.test(ua)) {
    deviceType = 'TABLET';
  } else if (/bot|crawler|spider|curl|wget|postman/i.test(ua)) {
    deviceType = 'BOT';
  } else {
    deviceType = 'DESKTOP';
  }

  // OS Detection
  if (ua.includes('windows nt 10.0')) {
    os = 'Windows';
    osVersion = '10/11';
  } else if (ua.includes('windows nt 6.3')) {
    os = 'Windows';
    osVersion = '8.1';
  } else if (ua.includes('windows nt 6.1')) {
    os = 'Windows';
    osVersion = '7';
  } else if (ua.includes('macintosh') || ua.includes('mac os x')) {
    os = 'macOS';
    const macMatch = ua.match(/mac os x (\d+[._]\d+[._]?\d*)/);
    if (macMatch) osVersion = macMatch[1].replace(/_/g, '.');
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
    const iosMatch = ua.match(/os (\d+[._]\d+)/);
    if (iosMatch) osVersion = iosMatch[1].replace(/_/g, '.');
  } else if (ua.includes('android')) {
    os = 'Android';
    const androidMatch = ua.match(/android\s+([\d.]+)/);
    if (androidMatch) osVersion = androidMatch[1];
  } else if (ua.includes('linux')) {
    os = 'Linux';
  }

  // Browser Detection
  if (ua.includes('edg/')) {
    browser = 'Microsoft Edge';
    const m = ua.match(/edg\/([\d.]+)/);
    if (m) browserVersion = m[1];
  } else if (ua.includes('chrome/') && !ua.includes('chromium')) {
    browser = 'Google Chrome';
    const m = ua.match(/chrome\/([\d.]+)/);
    if (m) browserVersion = m[1];
  } else if (ua.includes('firefox/')) {
    browser = 'Mozilla Firefox';
    const m = ua.match(/firefox\/([\d.]+)/);
    if (m) browserVersion = m[1];
  } else if (ua.includes('safari/') && !ua.includes('chrome')) {
    browser = 'Apple Safari';
    const m = ua.match(/version\/([\d.]+)/);
    if (m) browserVersion = m[1];
  } else if (ua.includes('opr/') || ua.includes('opera/')) {
    browser = 'Opera';
    const m = ua.match(/(opr|opera)\/([\d.]+)/);
    if (m) browserVersion = m[2];
  }

  return {
    browser,
    browserVersion,
    os,
    osVersion,
    deviceType,
    rawUserAgent: uaString,
  };
}

/**
 * Determine risk level based on action and resource
 */
export function evaluateRiskLevel(action: string, resource?: string, statusCode?: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const text = `${action} ${resource || ''}`.toUpperCase();

  if (statusCode && statusCode >= 400 && (text.includes('AUTH') || text.includes('LOGIN') || text.includes('PASSWORD'))) {
    return 'HIGH';
  }

  if (
    text.includes('DELETE') ||
    text.includes('OVERRIDE') ||
    text.includes('PAYROLL_LOCK') ||
    text.includes('EXPORT_ALL') ||
    text.includes('WIPE') ||
    text.includes('PRIVILEGE') ||
    text.includes('LEAK')
  ) {
    return 'CRITICAL';
  }

  if (
    text.includes('APPROVE') ||
    text.includes('REJECT') ||
    text.includes('PAYROLL') ||
    text.includes('SALARY') ||
    text.includes('POLICY') ||
    text.includes('EXPORT') ||
    text.includes('DOWNLOAD')
  ) {
    return 'HIGH';
  }

  if (
    text.includes('SUBMIT') ||
    text.includes('UPDATE') ||
    text.includes('REGULARIZE') ||
    text.includes('ADJUST')
  ) {
    return 'MEDIUM';
  }

  return 'LOW';
}

/**
 * Asynchronously record an audit log event into MongoDB.
 * Non-blocking: will never crash or hang the parent request.
 */
export async function recordAuditLog(event: AuditEventPayload): Promise<void> {
  // Fire and forget
  (async () => {
    try {
      const now = event.timestamp || new Date();
      const ip = event.ip || '127.0.0.1';

      // 1. Resolve Location & ISP
      const geo = event.geo || (await resolveIpGeoAndIsp(ip));

      // 2. Parse Device if not already supplied
      const rawUa = event.device?.rawUserAgent || '';
      const device = event.device || parseUserAgent(rawUa);

      // 3. Compute Risk Level
      const riskLevel = event.riskLevel || evaluateRiskLevel(event.action, event.resource, event.statusCode);

      const logId = event.id || `AUDIT_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      const auditRecord = {
        id: logId,
        timestamp: now,
        eventType: event.eventType,
        action: event.action,
        resource: event.resource || null,
        method: event.method || 'UI',
        statusCode: event.statusCode || 200,
        durationMs: event.durationMs || 0,

        // User Identity
        user: {
          userId: event.user?.userId || 'ANONYMOUS',
          employeeId: event.user?.employeeId || null,
          name: event.user?.name || 'Anonymous User',
          email: event.user?.email || null,
          mobileNumber: event.user?.mobileNumber || null,
          role: event.user?.role || 'GUEST',
          department: event.user?.department || null,
          designation: event.user?.designation || null,
        },

        // Network & Geolocation Forensics
        ip: geo.ip,
        geo: {
          country: geo.country,
          countryCode: geo.countryCode,
          region: geo.region,
          regionName: geo.regionName,
          city: geo.city,
          district: geo.district,
          zip: geo.zip,
          lat: geo.lat,
          lon: geo.lon,
          timezone: geo.timezone,
        },
        isp: {
          name: geo.isp,
          org: geo.org,
          as: geo.as,
          asName: geo.asName,
          isVpnOrProxy: geo.isVpnOrProxy,
          isMobile: geo.isMobile,
        },

        // Device & Environment Forensics
        device: {
          browser: device.browser,
          browserVersion: device.browserVersion,
          os: device.os,
          osVersion: device.osVersion,
          deviceType: device.deviceType,
          rawUserAgent: device.rawUserAgent,
          screenResolution: device.screenResolution,
          viewportSize: device.viewportSize,
          platform: device.platform,
          clientTimezone: device.clientTimezone,
          language: device.language,
        },

        // Targeted DOM Element or UI Component
        targetElement: event.targetElement || null,

        // Arbitrary Event Metadata
        metadata: event.metadata || {},
        riskLevel,
        createdAt: now,
      };

      const auditCol = await auditLogsCol();
      await auditCol.insertOne(auditRecord);
    } catch (err) {
      console.error('[AuditLogger] Failed to write audit record:', err);
    }
  })().catch(() => {});
}

/**
 * Server-side convenience helper to audit any API request directly
 */
export async function auditLogFromRequest(
  req: NextRequest,
  session: any | null,
  action: string,
  extra: {
    eventType?: AuditEventPayload['eventType'];
    resource?: string;
    statusCode?: number;
    durationMs?: number;
    metadata?: Record<string, any>;
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  } = {}
): Promise<void> {
  const ip = extractClientIp(req);
  const ua = req.headers.get('user-agent') || '';
  const url = req.nextUrl?.pathname || req.url;

  await recordAuditLog({
    eventType: extra.eventType || 'API_CALL',
    action,
    resource: extra.resource || url,
    method: req.method,
    statusCode: extra.statusCode || 200,
    durationMs: extra.durationMs || 0,
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
      : null,
    ip,
    device: parseUserAgent(ua),
    metadata: extra.metadata || {},
    riskLevel: extra.riskLevel,
    timestamp: new Date(),
  });
}

// ── Compatibility Aliases for ui-event & with-audit-log ───────────────────
export const extractIp = extractClientIp;

export async function writeAuditLog(params: {
  userId?: string;
  userName?: string;
  userRole?: string;
  employeeId?: string;
  action: string;
  resource?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  statusCode?: number;
  durationMs?: number;
  extra?: any;
}): Promise<void> {
  const rawUa = params.userAgent || '';
  const action = params.action || 'UI_ACTION';
  const eventType: AuditEventPayload['eventType'] =
    action.includes('CLICK') ? 'BUTTON_CLICK' :
    action.includes('SUBMIT') ? 'FORM_SUBMIT' :
    action.includes('EXPORT') ? 'DATA_EXPORT' :
    action.includes('NAV') ? 'PAGE_NAVIGATION' :
    params.method === 'UI' ? 'BUTTON_CLICK' : 'API_CALL';

  return recordAuditLog({
    eventType,
    action,
    resource: params.resource,
    method: params.method || 'UI',
    statusCode: params.statusCode || 200,
    durationMs: params.durationMs || 0,
    user: (params.userId || params.userName) ? {
      userId: params.userId || 'ANONYMOUS',
      employeeId: params.employeeId || null,
      name: params.userName || 'Anonymous User',
      role: params.userRole || 'EMPLOYEE',
    } : null,
    ip: params.ip || '127.0.0.1',
    device: parseUserAgent(rawUa),
    metadata: params.extra || {},
    timestamp: new Date(),
  });
}
