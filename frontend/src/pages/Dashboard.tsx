import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Zap, Activity, Bell } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { AddressDisplay } from '../components/AddressDisplay';
import { PnlBadge } from '../components/PnlBadge';
import { useApi } from '../hooks/useApi';
import { walletsApi, tradesApi } from '../services/api';

function fmtTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function fmtUsd(v: number) {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(2)}`;
}

export default function Dashboard() {
  const { data: wallets, loading: wLoad } = useApi(() => walletsApi.list());
  const { data: stats, loading: sLoad }   = useApi(() => tradesApi.stats());
  const { data: alerts }                  = useApi(() => tradesApi.alerts(true));

  // Live feed state
  const [liveFeed, setLiveFeed] = useState<Array<{
    id: string;
    type: string;
    wallet: string;
    token: string;
    amountUsd: number;
    time: number;
  }>>([]);

  // Build chart data from wallets PnL
  const topWallets = ((wallets as Array<{
    address: string;
    label: string;
    totalPnlUsd: number;
    total_pnl_usd: number;
    winRate: number;
    win_rate: number;
    tradesCount: number;
    trades_count: number;
    isActive: number;
    is_active: number;
  }> | null) ?? []).slice(0, 5);

  const totalPnl = topWallets.reduce((s, w) => s + (w.total_pnl_usd ?? 0), 0);
  const activeWallets = ((wallets as Array<{ is_active: number }> | null) ?? []).filter(w => w.is_active).length;
  const unreadAlerts = ((alerts as unknown[]) ?? []).length;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vue d'ensemble du portefeuille et des wallets suivis</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Wallets suivis"
          value={activeWallets}
          icon={Wallet}
          sub={`${((wallets as unknown[]) ?? []).length} total`}
          loading={wLoad}
        />
        <StatCard
          label="PnL total wallets"
          value={fmtUsd(totalPnl)}
          icon={TrendingUp}
          color={totalPnl >= 0 ? 'green' : 'red'}
          loading={wLoad}
        />
        <StatCard
          label="Copy trades OK"
          value={(stats as { success?: number } | null)?.success ?? 0}
          icon={Zap}
          sub={`${(stats as { total?: number } | null)?.total ?? 0} total`}
          loading={sLoad}
        />
        <StatCard
          label="Alertes actives"
          value={unreadAlerts}
          icon={Bell}
          color={unreadAlerts > 0 ? 'yellow' : 'default'}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top wallets table */}
        <div className="lg:col-span-2 card">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Activity size={16} className="text-brand-400" />
            Top wallets par PnL (30j)
          </h2>
          {wLoad ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-800 rounded animate-pulse" />
              ))}
            </div>
          ) : topWallets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Wallet size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun wallet suivi — allez dans <strong>Wallet Hunter</strong> pour en ajouter</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-head">Wallet</th>
                  <th className="table-head text-right">PnL 30j</th>
                  <th className="table-head text-right">Win rate</th>
                  <th className="table-head text-right">Trades</th>
                  <th className="table-head text-right">Statut</th>
                </tr>
              </thead>
              <tbody>
                {topWallets.map((w) => (
                  <tr key={w.address} className="table-row">
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
                      <span className={`mono text-sm ${(w.win_rate ?? 0) >= 50 ? 'green' : 'red'}`}>
                        {((w.win_rate ?? 0) * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="table-cell text-right mono">{w.trades_count ?? 0}</td>
                    <td className="table-cell text-right">
                      {w.is_active
                        ? <span className="badge-green">Live</span>
                        : <span className="badge-gray">Pausé</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent alerts */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Bell size={16} className="text-yellow-400" />
            Alertes récentes
          </h2>
          {unreadAlerts === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">Aucune alerte</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-auto">
              {((alerts as Array<{
                id: number;
                type: string;
                token_symbol: string;
                amount_usd: number;
                message: string;
                created_at: string;
              }>) ?? []).map((a) => (
                <div key={a.id} className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className={a.type === 'BUY' ? 'badge-green' : 'badge-red'}>
                      {a.type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(a.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300">{a.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Copy trade stats */}
      {stats && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Zap size={16} className="text-brand-400" />
            Performances Copy Trade
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total exécutés', value: (stats as { total?: number }).total ?? 0 },
              { label: 'Succès',   value: (stats as { success?: number }).success ?? 0, color: 'text-emerald-400' },
              { label: 'Échoués',  value: (stats as { failed?: number }).failed ?? 0,  color: 'text-red-400' },
              { label: 'Ignorés',  value: (stats as { skipped?: number }).skipped ?? 0, color: 'text-yellow-400' },
            ].map(s => (
              <div key={s.label} className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">{s.label}</div>
                <div className={`text-xl font-bold mono ${s.color ?? 'text-white'}`}>{s.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm text-gray-500">
            SOL investi total:{' '}
            <span className="text-white mono">
              {((stats as { total_sol_invested?: number }).total_sol_invested ?? 0).toFixed(3)} SOL
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
