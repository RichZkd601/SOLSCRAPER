import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Zap, LayoutDashboard, Search, Crosshair, Copy, TrendingUp,
  Bell, Wifi, WifiOff, ChevronLeft, ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { useWebSocket } from '../hooks/useWebSocket';

const NAV = [
  { to: '/',            icon: Zap,             label: 'Démarrage rapide' },
  { to: '/dashboard',   icon: LayoutDashboard,  label: 'Dashboard' },
  { to: '/hunter',      icon: Search,           label: 'Wallet Hunter' },
  { to: '/tracker',     icon: Crosshair,        label: 'Live Tracker' },
  { to: '/copy-trade',  icon: Copy,             label: 'Copy Trade' },
  { to: '/analytics',   icon: TrendingUp,       label: 'Analytics' },
];

interface LayoutProps { children: React.ReactNode; onWsMessage?: (msg: { type: string; data: unknown; timestamp: number }) => void; }

export function Layout({ children, onWsMessage }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [alerts, setAlerts] = useState(0);
  const location = useLocation();

  const { connected } = useWebSocket({
    onMessage: (msg) => {
      if (msg.type === 'ALERT') setAlerts(a => a + 1);
      onWsMessage?.(msg as Parameters<typeof onWsMessage>[0]);
    },
  });

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <aside className={clsx('flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-200', collapsed ? 'w-16' : 'w-56')}>
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-white">S</span>
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-bold text-white">SOLSCRAPER</div>
              <div className="text-xs text-gray-500">Copy Trader v1.0</div>
            </div>
          )}
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium',
                isActive ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'text-gray-500 hover:text-gray-100 hover:bg-gray-800'
              )}>
              <Icon size={18} className="shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-800 space-y-2">
          <div className={clsx('flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs', connected ? 'text-emerald-400' : 'text-red-400')}>
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {!collapsed && (connected ? 'Live' : 'Offline')}
          </div>
          <button onClick={() => setCollapsed(c => !c)}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-gray-500 hover:text-gray-100 rounded-lg hover:bg-gray-800 transition-colors text-xs">
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            {!collapsed && 'Réduire'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm shrink-0">
          <div className="text-sm text-gray-500">
            {NAV.find(n => n.to === location.pathname)?.label ?? 'SOLSCRAPER'}
          </div>
          <div className="flex items-center gap-3">
            <div className={clsx('flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border',
              connected ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' : 'text-red-400 border-red-500/20 bg-red-500/10')}>
              <span className={clsx('pulse-dot', connected ? 'bg-emerald-400' : 'bg-red-400')} />
              {connected ? 'Solana connecté' : 'Reconnexion...'}
            </div>
            <button className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" onClick={() => setAlerts(0)}>
              <Bell size={18} />
              {alerts > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white">
                  {alerts > 9 ? '9+' : alerts}
                </span>
              )}
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
