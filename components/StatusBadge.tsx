import React from 'react';

interface StatusBadgeProps {
  status: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'ERROR' | 'ACTIVE' | 'DISABLED' | string;
  lastSeen?: Date | string | null;
}

export function StatusBadge({ status, lastSeen }: StatusBadgeProps) {
  const normalized = (status || 'OFFLINE').toUpperCase();

  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';
  let isPulsing = false;

  switch (normalized) {
    case 'ONLINE':
    case 'ACTIVE':
      badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      dotColor = 'bg-emerald-500';
      isPulsing = true;
      break;
    case 'SYNCING':
      badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
      dotColor = 'bg-blue-500';
      isPulsing = true;
      break;
    case 'OFFLINE':
      badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
      dotColor = 'bg-rose-500';
      break;
    case 'ERROR':
      badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
      dotColor = 'bg-amber-500';
      break;
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isPulsing ? 'animate-pulse' : ''}`}></span>
        {normalized}
      </span>
    </div>
  );
}
