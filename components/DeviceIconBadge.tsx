'use client';

import React from 'react';
import { Laptop, Monitor, Smartphone, Tablet } from 'lucide-react';

interface DeviceIconBadgeProps {
  formFactor: 'laptop' | 'desktop' | 'mobile' | 'tablet';
  os: 'windows' | 'macos' | 'ios' | 'android' | 'linux' | 'other';
  size?: 'sm' | 'md' | 'lg';
}

export function DeviceIconBadge({ formFactor, os, size = 'md' }: DeviceIconBadgeProps) {
  const isLg = size === 'lg';
  const isSm = size === 'sm';

  const containerSizeClass = isLg ? 'w-16 h-16' : isSm ? 'w-9 h-9' : 'w-12 h-12';
  const mainIconSize = isLg ? 'w-8 h-8' : isSm ? 'w-4 h-4' : 'w-6 h-6';
  const badgeSizeClass = isLg ? 'w-6 h-6 -bottom-1 -right-1' : isSm ? 'w-4 h-4 -bottom-1 -right-1' : 'w-5 h-5 -bottom-1 -right-1';

  // Primary Form Factor Icon
  let PrimaryIcon = Laptop;
  if (formFactor === 'desktop') PrimaryIcon = Monitor;
  else if (formFactor === 'mobile') PrimaryIcon = Smartphone;
  else if (formFactor === 'tablet') PrimaryIcon = Tablet;

  // OS Badge Icon
  const renderOsBadge = () => {
    switch (os) {
      case 'windows':
        return (
          <svg className="w-2.5 h-2.5 fill-current text-sky-500" viewBox="0 0 88 88">
            <path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L.028 75.48.016 45.748zm4.326-39.027L87.914 0v41.527l-47.918.37zm47.918 43.704L39.996 88V46.544l47.918.312z" />
          </svg>
        );
      case 'macos':
      case 'ios':
        return (
          <svg className="w-2.5 h-2.5 fill-current text-slate-800" viewBox="0 0 170 170">
            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.7-7.91-12-14.61-5.99-9.35-10.74-20.08-14.26-32.18-3.52-12.11-5.28-23.77-5.28-34.99 0-14.79 3.73-26.69 11.19-35.71 7.46-9.02 16.91-13.63 28.37-13.84 4.8 0 10.15 1.25 16.06 3.76 5.91 2.5 9.77 3.86 11.58 4.07 1.45-.21 5.48-1.62 12.09-4.24 6.61-2.61 12.3-3.79 17.06-3.53 13.06.67 23.33 5.45 30.82 14.33-11.54 6.98-17.18 16.55-16.92 28.71.26 9.69 3.93 17.75 11.01 24.18 7.08 6.44 15.71 10.05 25.88 10.84-2.22 6.63-4.94 13.43-8.15 20.4zM119.22 31.84c0-7.39 2.66-14.41 7.98-21.06 5.32-6.65 11.89-10.78 19.72-12.39.22 1.31.33 2.5.33 3.59 0 7.39-2.77 14.52-8.31 21.39-5.54 6.87-12.18 10.99-19.92 12.36-.21-1.3-.32-2.5-.32-3.89z" />
          </svg>
        );
      case 'android':
        return (
          <svg className="w-2.5 h-2.5 fill-current text-emerald-500" viewBox="0 0 24 24">
            <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.411 13.856 8.1 12 8.1s-3.5902.311-5.1367.8497L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.152 5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
          </svg>
        );
      default:
        return (
          <div className="w-2 h-2 rounded-full bg-slate-500" />
        );
    }
  };

  return (
    <div className="relative inline-block">
      {/* Primary Device Box */}
      <div
        className={`${containerSizeClass} rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700`}
      >
        <PrimaryIcon className={mainIconSize} />
      </div>

      {/* Small Floating OS Badge */}
      <div
        className={`absolute ${badgeSizeClass} rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center p-0.5`}
        title={os}
      >
        {renderOsBadge()}
      </div>
    </div>
  );
}
