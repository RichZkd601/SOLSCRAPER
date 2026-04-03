import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { clsx } from 'clsx';

interface PnlBadgeProps {
  value: number;
  prefix?: '$' | '%' | '';
  size?: 'sm' | 'md' | 'lg';
}

export function PnlBadge({ value, prefix = '$', size = 'md' }: PnlBadgeProps) {
  const positive = value >= 0;
  const sizeClass = { sm: 'text-xs', md: 'text-sm', lg: 'text-base font-bold' }[size];
  const abs = Math.abs(value);

  const fmt =
    prefix === '$' ? `$${abs >= 1000 ? (abs / 1000).toFixed(1) + 'k' : abs.toFixed(2)}` :
    prefix === '%' ? `${abs.toFixed(1)}%` :
    abs.toFixed(2);

  return (
    <span className={clsx(
      'inline-flex items-center gap-0.5 font-mono',
      positive ? 'text-emerald-400' : 'text-red-400',
      sizeClass
    )}>
      {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {positive ? '+' : '-'}{fmt}
    </span>
  );
}
