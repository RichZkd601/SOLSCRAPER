import React from 'react';
import { clsx } from 'clsx';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  trend?: number; // positive = green, negative = red
  color?: 'default' | 'green' | 'red' | 'yellow' | 'blue';
  loading?: boolean;
}

export function StatCard({ label, value, sub, icon: Icon, trend, color = 'default', loading }: StatCardProps) {
  const colorMap = {
    default: 'text-gray-100',
    green:   'text-emerald-400',
    red:     'text-red-400',
    yellow:  'text-yellow-400',
    blue:    'text-blue-400',
  };

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-2">
        <span className="stat-label">{label}</span>
        {Icon && <Icon size={16} className="text-gray-600" />}
      </div>
      {loading ? (
        <div className="h-8 bg-gray-800 rounded animate-pulse" />
      ) : (
        <div className={clsx('stat-value', colorMap[color])}>{value}</div>
      )}
      {(sub || trend !== undefined) && !loading && (
        <div className="flex items-center gap-2 mt-1">
          {trend !== undefined && (
            <span className={clsx('text-xs font-mono', trend >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {trend >= 0 ? '+' : ''}{trend.toFixed(2)}%
            </span>
          )}
          {sub && <span className="text-xs text-gray-500">{sub}</span>}
        </div>
      )}
    </div>
  );
}
