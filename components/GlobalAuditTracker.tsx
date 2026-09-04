'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface BufferedEvent {
  eventType: 'API_CALL' | 'BUTTON_CLICK' | 'FORM_SUBMIT' | 'PAGE_NAVIGATION';
  action: string;
  resource?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  targetElement?: {
    tag?: string;
    text?: string;
    id?: string;
    classes?: string;
    coordinates?: { x: number; y: number };
  };
  metadata?: Record<string, any>;
  timestamp: string;
}

export function GlobalAuditTracker() {
  const pathname = usePathname();
  const bufferRef = useRef<BufferedEvent[]>([]);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Client device hardware & display telemetry
  const getClientTelemetry = () => {
    if (typeof window === 'undefined') return {};
    return {
      screenResolution: `${window.screen?.width || 0}x${window.screen?.height || 0} (${window.screen?.colorDepth || 24}-bit)`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      platform: navigator?.platform || 'Unknown',
      clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      language: navigator?.language || 'en',
    };
  };

  // Dispatch buffered audit events to server
  const flushEvents = (immediateEvents?: BufferedEvent[]) => {
    const toSend = immediateEvents || [...bufferRef.current];
    if (!immediateEvents) {
      bufferRef.current = [];
    }

    if (toSend.length === 0) return;

    const payload = {
      events: toSend,
      clientDevice: getClientTelemetry(),
    };

    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });

    // Use sendBeacon if available during unload, else fetch with keepalive
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const sent = navigator.sendBeacon('/api/audit/track', blob);
      if (sent) return;
    }

    fetch('/api/audit/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  };

  const scheduleFlush = () => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushEvents();
    }, 1500); // 1.5 second debounced batching
  };

  const pushEvent = (event: BufferedEvent, isImmediate = false) => {
    if (isImmediate) {
      flushEvents([event]);
    } else {
      bufferRef.current.push(event);
      if (bufferRef.current.length >= 10) {
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
        flushEvents();
      } else {
        scheduleFlush();
      }
    }
  };

  // 1. Track Page Navigations
  useEffect(() => {
    if (!pathname) return;
    pushEvent({
      eventType: 'PAGE_NAVIGATION',
      action: `Navigated to ${pathname}`,
      resource: pathname,
      method: 'ROUTE_CHANGE',
      timestamp: new Date().toISOString(),
    });
  }, [pathname]);

  // 2. Track all Button & Form Submissions globally
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleClick = (e: MouseEvent) => {
      try {
        const target = e.target as HTMLElement | null;
        if (!target) return;

        // Find closest interactive button, link, or tab element
        const btn = target.closest('button, a[href], input[type="submit"], input[type="button"], [role="button"], [data-action]');
        if (!btn) return;

        const tagName = btn.tagName.toUpperCase();
        const rawText = (btn.textContent || (btn as HTMLInputElement).value || '').replace(/\s+/g, ' ').trim();
        const ariaLabel = btn.getAttribute('aria-label') || btn.getAttribute('title') || '';
        const id = btn.id || btn.getAttribute('name') || '';
        const href = btn.getAttribute('href') || '';
        const actionAttr = btn.getAttribute('data-action') || '';

        // Ignore generic empty clicks
        const label = rawText || ariaLabel || actionAttr || id || href || tagName;
        if (!label || label.length < 2) return;

        // Filter out common mundane controls if needed
        const truncatedLabel = label.length > 80 ? label.substring(0, 77) + '...' : label;

        const isHighImpact =
          /approve|reject|delete|override|export|download|submit|save|update|lock|unlock|passkey|revoke/i.test(label);

        pushEvent(
          {
            eventType: 'BUTTON_CLICK',
            action: `Clicked [${tagName}] "${truncatedLabel}" on ${window.location.pathname}`,
            resource: href || window.location.pathname,
            method: 'UI_CLICK',
            targetElement: {
              tag: tagName,
              text: truncatedLabel,
              id: id || undefined,
              classes: (btn.className || '').toString().slice(0, 100),
              coordinates: { x: Math.round(e.clientX), y: Math.round(e.clientY) },
            },
            timestamp: new Date().toISOString(),
          },
          isHighImpact
        );
      } catch (_) {}
    };

    const handleFormSubmit = (e: SubmitEvent) => {
      try {
        const form = e.target as HTMLFormElement | null;
        if (!form) return;
        const formId = form.id || form.name || 'Unnamed Form';
        pushEvent(
          {
            eventType: 'FORM_SUBMIT',
            action: `Submitted form: ${formId} on ${window.location.pathname}`,
            resource: window.location.pathname,
            method: 'FORM_SUBMIT',
            metadata: { formId, action: form.action },
            timestamp: new Date().toISOString(),
          },
          true
        );
      } catch (_) {}
    };

    window.addEventListener('click', handleClick, true);
    window.addEventListener('submit', handleFormSubmit, true);

    const handleBeforeUnload = () => {
      flushEvents();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('click', handleClick, true);
      window.removeEventListener('submit', handleFormSubmit, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // 3. Global Interceptor for all fetch() API Calls
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      const startTime = performance.now();
      const rawUrl = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
      const options = (args[1] || (typeof args[0] === 'object' ? args[0] : {})) as RequestInit;
      const method = (options.method || 'GET').toUpperCase();

      // Skip logging the audit endpoints themselves to avoid recursive infinite loop
      const isAuditEndpoint = rawUrl.includes('/api/audit/');
      // Skip background telemetry polling
      const isMuted = rawUrl.includes('/api/auth/me') && method === 'GET';

      let response: Response;
      try {
        response = await originalFetch.apply(this, args);
        return response;
      } catch (err: any) {
        if (!isAuditEndpoint && !isMuted) {
          const duration = Math.round(performance.now() - startTime);
          pushEvent(
            {
              eventType: 'API_CALL',
              action: `FAILED API ${method} ${rawUrl} - ${err?.message || 'Network Error'}`,
              resource: rawUrl,
              method,
              statusCode: 0,
              durationMs: duration,
              metadata: { error: err?.message },
              timestamp: new Date().toISOString(),
            },
            true
          );
        }
        throw err;
      } finally {
        if (!isAuditEndpoint && !isMuted) {
          const duration = Math.round(performance.now() - startTime);
          // Wait briefly to see if status code is available
          const status = (response! && response!.status) || 200;
          const isMutating = method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH';

          pushEvent(
            {
              eventType: 'API_CALL',
              action: `API ${method} ${rawUrl} [Status ${status}] (${duration}ms)`,
              resource: rawUrl,
              method,
              statusCode: status,
              durationMs: duration,
              timestamp: new Date().toISOString(),
            },
            isMutating
          );
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
