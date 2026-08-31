// Data Freshness Indicator Component
import React from 'react';

interface DataFreshnessIndicatorProps {
  lastUpdated: string;
  isStale?: boolean;
  className?: string;
}

export function DataFreshnessIndicator({ lastUpdated, isStale = false, className = '' }: DataFreshnessIndicatorProps) {
  const date = new Date(lastUpdated);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let timeText = '';
  if (diffSeconds < 60) {
    timeText = `${diffSeconds}s ago`;
  } else if (diffSeconds < 3600) {
    timeText = `${Math.floor(diffSeconds / 60)}m ago`;
  } else if (diffSeconds < 86400) {
    timeText = `${Math.floor(diffSeconds / 3600)}h ago`;
  } else {
    timeText = date.toLocaleString();
  }

  return (
    <div className={`flex items-center gap-2 text-xs ${isStale ? 'text-yellow-400' : 'text-slate-400'} ${className}`}>
      <span className={`h-2 w-2 rounded-full ${isStale ? 'bg-yellow-500' : 'bg-green-500'}`} />
      Updated {timeText}
    </div>
  );
}
