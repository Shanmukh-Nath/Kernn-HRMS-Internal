'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Fingerprint,
  Activity,
  Cpu,
  ShieldCheck,
  Radio,
  Sparkles,
  Server,
  Layers,
} from 'lucide-react';

interface LoadingContextType {
  activeCount: number;
  isLoading: boolean;
  startTask: (name?: string) => string;
  endTask: (id: string) => void;
}

const LoadingContext = createContext<LoadingContextType>({
  activeCount: 0,
  isLoading: false,
  startTask: () => '',
  endTask: () => {},
});

export const useLoading = () => useContext(LoadingContext);

const HRMS_TELEMETRY_MESSAGES = [
  'Synchronizing Biometric Punches & Terminal Logs...',
  'Resolving Workforce Access Matrix & Security Keys...',
  'Evaluating Dynamic Accruals & Leave Polices...',
  'Compiling Date-wise Attendance Ledger...',
  'Validating Statutory Payroll & Shift Formulas...',
  'Verifying Hardware LAN Link & Cloud Data Stream...',
];

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [activeTasks, setActiveTasks] = useState<Map<string, string>>(new Map());
  const [messageIndex, setMessageIndex] = useState(0);

  // Cycle telemetry messages when loading
  useEffect(() => {
    if (activeTasks.size === 0) return;
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % HRMS_TELEMETRY_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [activeTasks.size]);

  // Global fetch interceptor to automatically capture every API call across the entire application
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
      // Exclude background clock/heartbeat polls if any
      const isMuted = url.includes('/api/auth/me') && !document.hidden;

      const taskId = 'req_' + Math.random().toString(36).substring(2, 9);
      if (!isMuted) {
        setActiveTasks((prev) => {
          const next = new Map(prev);
          next.set(taskId, url);
          return next;
        });
      }

      try {
        const response = await originalFetch.apply(this, args);
        return response;
      } finally {
        if (!isMuted) {
          setActiveTasks((prev) => {
            const next = new Map(prev);
            next.delete(taskId);
            return next;
          });
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const startTask = useCallback((name = 'Processing...') => {
    const id = 'task_' + Math.random().toString(36).substring(2, 9);
    setActiveTasks((prev) => {
      const next = new Map(prev);
      next.set(id, name);
      return next;
    });
    return id;
  }, []);

  const endTask = useCallback((id: string) => {
    setActiveTasks((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const activeCount = activeTasks.size;
  const isLoading = activeCount > 0;

  const value = useMemo(
    () => ({
      activeCount,
      isLoading,
      startTask,
      endTask,
    }),
    [activeCount, isLoading, startTask, endTask]
  );

  return (
    <LoadingContext.Provider value={value}>
      {/* 1. TOP LASER PROGRESS BAR */}
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 overflow-hidden pointer-events-none">
          <div className="w-full h-full animate-top-laser" />
        </div>
      )}

      {/* 2. BIOMETRIC OPTICAL SCANNER & TELEMETRY HUD (Floating Bottom Right) */}
      {isLoading && (
        <div className="fixed bottom-6 right-6 z-50 animate-scaleUp pointer-events-auto">
          <div className="bg-slate-950/95 backdrop-blur-md text-white border border-[#a92427]/40 p-4 rounded-3xl shadow-2xl shadow-[#a92427]/20 flex items-center gap-4 max-w-md ring-1 ring-white/10">
            {/* Holographic Biometric Scanner Box */}
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700/80 flex items-center justify-center shrink-0 overflow-hidden shadow-inner group">
              {/* Concentric Radar Ring */}
              <div className="absolute inset-0 rounded-2xl border border-[#a92427]/20 animate-ping opacity-30" />
              <div className="absolute inset-1 rounded-xl border border-dashed border-[#a92427]/40 animate-radar-spin" />

              {/* Biometric Fingerprint Icon */}
              <Fingerprint className="w-7 h-7 text-[#a92427] animate-pulse drop-shadow-[0_0_8px_rgba(169,36,39,0.8)] relative z-10" />

              {/* Laser Beam Sweeper */}
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#ff474b] to-transparent shadow-[0_0_8px_#ff474b] animate-laser-sweep z-20 pointer-events-none" />

              {/* Corner Digital Reticles */}
              <div className="absolute top-1 left-1 w-1.5 h-1.5 border-t border-l border-[#ff474b]" />
              <div className="absolute top-1 right-1 w-1.5 h-1.5 border-t border-r border-[#ff474b]" />
              <div className="absolute bottom-1 left-1 w-1.5 h-1.5 border-b border-l border-[#ff474b]" />
              <div className="absolute bottom-1 right-1 w-1.5 h-1.5 border-b border-r border-[#ff474b]" />
            </div>

            {/* Telemetry Process Information */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#a92427] animate-ping" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#ff7376] font-mono">
                    HRMS Engine Active
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#a92427]/30 text-[#ff8c8e] border border-[#a92427]/50 text-[10px] font-mono font-black">
                  {activeCount} {activeCount === 1 ? 'Process' : 'Processes'}
                </span>
              </div>

              <div className="text-xs font-bold text-slate-100 truncate tracking-tight">
                {HRMS_TELEMETRY_MESSAGES[messageIndex]}
              </div>

              {/* Progress Micro Indicators */}
              <div className="flex items-center gap-3 mt-1.5 text-[9px] text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-emerald-400" />
                  <span>Syncing Threads</span>
                </span>
                <span className="flex items-center gap-1">
                  <Radio className="w-3 h-3 text-amber-400 animate-pulse" />
                  <span>Terminal Link</span>
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-blue-400" />
                  <span>Encrypted</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {children}
    </LoadingContext.Provider>
  );
}
