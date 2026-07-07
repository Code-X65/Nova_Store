import React from 'react';
import clsx from 'clsx';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/20/solid';

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: number; // e.g. 12.5 for +12.5%, -5.2 for -5.2%
  trendLabel?: string; // e.g. "vs last month"
  icon?: React.ReactNode;
  loading?: boolean;
}

export function StatCard({ title, value, trend, trendLabel, icon, loading }: StatCardProps) {
  return (
    <div className="glass-card p-6 rounded-xl border border-white/5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {icon && <div className="text-nova-500">{icon}</div>}
      </div>

      <div>
        {loading ? (
          <div className="h-8 w-24 bg-surface-2 animate-pulse rounded-md mt-1"></div>
        ) : (
          <div className="text-3xl font-bold text-white">{value}</div>
        )}
      </div>

      {(trend !== undefined && !loading) && (
        <div className="flex items-center gap-2 text-xs">
          <span
            className={clsx(
              "flex items-center font-medium",
              trend >= 0 ? "text-success" : "text-danger"
            )}
          >
            {trend >= 0 ? (
              <ArrowTrendingUpIcon className="w-3 h-3 mr-1" />
            ) : (
              <ArrowTrendingDownIcon className="w-3 h-3 mr-1" />
            )}
            {Math.abs(trend)}%
          </span>
          {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}
