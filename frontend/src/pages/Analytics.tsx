import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';
import { BarChart2, TrendingUp, Wallet, Zap } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { walletsApi, tradesApi } from '../services/api';
import { PnlBadge } from '../components/PnlBadge';
import { AddressDisplay } from '../components/AddressDisplay';

const COLORS = ['#14b8a6', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#22c55e'];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs">
      <div className="text-gray-400 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: COLORS[i % COLORS.length] }}>
          {p.name}: {typeof p.value === 'number' ? (p.value >= 1000 ? `$${(p.value / 1000).toFixed(1)}k` : `$${p.value.toFixed(0)}`) : p.value}
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { data: wallets } = useApi(() => walletsApi.list());
  const { data: stats }   = useApi(() => tradesApi.stats());
  const { data: trades }  = useApi(() => tradesApi.list({ limit: 200 }));

  const walletList = (wallets as Array<{
    address: string; label: string;
    total_pnl_usd: number; win_rate: number;
    trades_count: number; is_active: number;
  }> | null) ?? [];

  const tradeList = (trades as Array<{
    type: string; status: string; amount_sol: number; pnl_usd: number; executed_at: string;
  }> | null) ?? [];

  // Chart: PnL by wallet
  const walletPnlData = walletList
    .filter(w => w.total_pnl_usd !== 0)
    .map(w => ({
      name: w.label || w.address.slice(0, 6) + '...',
      pnl: w.total_pnl_usd,
      winRate: Math.round((w.win_rate ?? 0) * 100),
    }))
    .sort((a, b) => b.pnl - a.pnl);

  // Chart: trades over time (group by day)
  const tradesByDay = tradeList.reduce<Record<string, { day: string; buys: number; sells: number; failed: number }>>((acc, t) => {
    const day = t.executed_at?.slice(0, 10) ?? 'N/A';
    if (!acc[day]) acc[day] = { day, buys: 0, sells: 0, failed: 0 };
    if (t.status === 'SUCCESS') {
      if (t.type === 'BUY') acc[day].buys++;
      else acc[day].sells++;
    } else if (t.status === 'FAILED') {
      acc[day].failed++;
    }
    return acc;
  }, {});
  const timelineData = Object.values(tradesByDay).slice(-30);

  // Pie: trade status distribution
  const s = stats as { success?: number; failed?: number; skipped?: number } | null;
  const pieData = [
    { name: 'Succès', value: s?.success ?? 0 },
    { name: 'Échoués', value: s?.failed ?? 0 },
    { name: 'Ignorés', value: s?.skipped ?? 0 },
  ].filter(d => d.value > 0);

  const successRate = s && (s.success ?? 0) + (s.failed ?? 0) > 0
    ? ((s.success ?? 0) / ((s.success ?? 0) + (s.failed ?? 0)) * 100).toFixed(1)
    : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart2 size={20} className="text-brand-400" />
          Analytics
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Performances des wallets suivis et copy trades</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Wallets actifs', value: walletList.filter(w => w.is_active).length, icon: Wallet },
          { label: 'Taux de succès', value: `${successRate}%`, icon: TrendingUp },
          { label: 'Trades total', value: (s?.success ?? 0) + (s?.failed ?? 0) + (s?.skipped ?? 0), icon: Zap },
          { label: 'SOL investis', value: `${((stats as { total_sol_invested?: number } | null)?.total_sol_invested ?? 0).toFixed(2)} ◎`, icon: Zap },
        ].map(m => (
          <div key={m.label} className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <span className="stat-label">{m.label}</span>
              <m.icon size={16} className="text-gray-600" />
            </div>
            <div className="stat-value text-white">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PnL by wallet */}
        <div className="lg:col-span-2 card">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">PnL par Wallet ($)</h2>
          {walletPnlData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
              Pas encore de données
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={walletPnlData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pnl" fill="#14b8a6" radius={[4, 4, 0, 0]} name="PnL" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status pie */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Distribution des trades</h2>
          {pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
              Aucun trade
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}>
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={['#14b8a6', '#ef4444', '#f59e0b'][idx]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Timeline */}
      {timelineData.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Activité copy trades (30 derniers jours)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={timelineData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 9 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="buys"   stackId="a" fill="#14b8a6" name="Achats" />
              <Bar dataKey="sells"  stackId="a" fill="#0ea5e9" name="Ventes" />
              <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Échoués" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Wallet ranking */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Classement des wallets suivis</h2>
        {walletList.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">Aucun wallet</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head">#</th>
                <th className="table-head">Wallet</th>
                <th className="table-head text-right">PnL 30j</th>
                <th className="table-head text-right">Win Rate</th>
                <th className="table-head text-right">Trades</th>
                <th className="table-head text-right">Statut</th>
              </tr>
            </thead>
            <tbody>
              {walletList
                .sort((a, b) => (b.total_pnl_usd ?? 0) - (a.total_pnl_usd ?? 0))
                .map((w, i) => (
                  <tr key={w.address} className="table-row">
                    <td className="table-cell text-gray-500 mono">{i + 1}</td>
                    <td className="table-cell">
                      <div className="flex flex-col gap-0.5">
                        {w.label && <span className="text-xs text-gray-400">{w.label}</span>}
                        <AddressDisplay address={w.address} />
                      </div>
                    </td>
                    <td className="table-cell text-right">
                      <PnlBadge value={w.total_pnl_usd ?? 0} />
                    </td>
                    <td className="table-cell text-right">
                      <span className={`mono text-sm ${(w.win_rate ?? 0) >= 0.5 ? 'green' : 'red'}`}>
                        {((w.win_rate ?? 0) * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="table-cell text-right mono">{w.trades_count ?? 0}</td>
                    <td className="table-cell text-right">
                      <span className={w.is_active ? 'badge-green' : 'badge-gray'}>
                        {w.is_active ? 'Live' : 'Pausé'}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
