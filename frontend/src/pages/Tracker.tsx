import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, Trash2, RefreshCw, Eye, TrendingUp, TrendingDown, Zap, Clock, ExternalLink
} from 'lucide-react';
import { AddressDisplay } from '../components/AddressDisplay';
import { PnlBadge } from '../components/PnlBadge';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';
import { walletsApi } from '../services/api';
import { clsx } from 'clsx';

interface LiveTx {
  id: string;
  type: 'BUY' | 'SELL' | 'TRANSFER';
  walletAddress: string;
  tokenSymbol: string;
  tokenMint: string;
  amountSol: number;
  amountUsd: number;
  dex: string;
  blockTime: number;
  signature: string;
}

function timeSince(ts: number) {
  const s = Math.floor((Date.now() / 1000) - ts);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export default function Tracker() {
  const { data: wallets, loading: wLoad, refetch: refetchWallets } = useApi(() => walletsApi.list());
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const { data: txHistory, loading: txLoad, refetch: refetchTx } = useApi(
    () => selectedWallet ? walletsApi.transactions(selectedWallet, 50) : Promise.resolve([]),
    [selectedWallet]
  );
  const [liveFeed, setLiveFeed] = useState<LiveTx[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  const { connected } = useWebSocket({
    onMessage: (msg) => {
      if (msg.type === 'WALLET_TX') {
        const tx = msg.data as LiveTx;
        setLiveFeed(prev => [{ ...tx, id: tx.signature }, ...prev].slice(0, 100));
        // scroll to top
        if (feedRef.current) feedRef.current.scrollTop = 0;
      }
    },
  });

  async function handleRefresh(address: string) {
    await walletsApi.refresh(address);
    if (selectedWallet === address) refetchTx();
    refetchWallets();
  }

  async function handleRemove(address: string) {
    await walletsApi.remove(address);
    if (selectedWallet === address) setSelectedWallet(null);
    refetchWallets();
  }

  async function handleToggle(address: string, currentState: boolean) {
    await walletsApi.update(address, { isActive: !currentState });
    refetchWallets();
  }

  const walletList = (wallets as Array<{
    id: number;
    address: string;
    label: string;
    total_pnl_usd: number;
    win_rate: number;
    trades_count: number;
    is_active: number;
    tags: string;
  }> | null) ?? [];

  return (
    <div className="flex gap-6 h-full">
      {/* ── Left: Wallet list ────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Activity size={16} className="text-brand-400" />
            Wallets ({walletList.length})
          </h2>
          <button onClick={refetchWallets} className="btn-ghost p-1.5">
            <RefreshCw size={14} className={wLoad ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="space-y-2 overflow-auto flex-1">
          {wLoad
            ? [...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
              ))
            : walletList.length === 0
            ? (
                <div className="text-center py-12 text-gray-500 text-sm">
                  <Activity size={24} className="mx-auto mb-2 opacity-30" />
                  <p>Aucun wallet. Utilisez le Wallet Hunter.</p>
                </div>
              )
            : walletList.map(w => (
                <div
                  key={w.address}
                  onClick={() => setSelectedWallet(w.address)}
                  className={clsx(
                    'card cursor-pointer transition-all hover:border-gray-700 p-3',
                    selectedWallet === w.address && 'border-brand-500/50 bg-brand-500/5'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={clsx('pulse-dot', w.is_active ? 'bg-emerald-400' : 'bg-gray-600')} />
                      <span className="text-xs text-gray-300 font-medium">
                        {w.label || `${w.address.slice(0, 6)}...`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); handleToggle(w.address, !!w.is_active); }}
                        className={clsx(
                          'p-1 rounded transition-colors text-xs',
                          w.is_active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-600 hover:bg-gray-800'
                        )}
                        title={w.is_active ? 'Pause tracking' : 'Resume tracking'}
                      >
                        <Eye size={12} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleRefresh(w.address); }}
                        className="p-1 rounded text-gray-600 hover:text-brand-400 hover:bg-gray-800 transition-colors"
                      >
                        <RefreshCw size={12} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleRemove(w.address); }}
                        className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <AddressDisplay address={w.address} className="text-xs" />

                  <div className="flex items-center justify-between mt-2 text-xs">
                    <PnlBadge value={w.total_pnl_usd ?? 0} size="sm" />
                    <span className={clsx('mono', (w.win_rate ?? 0) >= 0.5 ? 'text-emerald-400' : 'text-red-400')}>
                      WR: {((w.win_rate ?? 0) * 100).toFixed(0)}%
                    </span>
                    <span className="text-gray-600">{w.trades_count ?? 0} trades</span>
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* ── Right: Live feed + tx history ───────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Live feed */}
        <div className="card flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Zap size={16} className="text-yellow-400" />
              Live Feed
              {connected && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <span className="pulse-dot bg-emerald-400" />
                  En direct
                </span>
              )}
            </h2>
            <button onClick={() => setLiveFeed([])} className="btn-ghost text-xs py-1">
              Effacer
            </button>
          </div>

          <div ref={feedRef} className="flex-1 overflow-auto space-y-1.5">
            {liveFeed.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                <div className="text-center">
                  <Activity size={24} className="mx-auto mb-2 opacity-30" />
                  <p>En attente de transactions...</p>
                  {!connected && <p className="text-xs mt-1 text-red-400">WebSocket déconnecté</p>}
                </div>
              </div>
            ) : (
              liveFeed.map(tx => (
                <div
                  key={tx.id}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-all',
                    tx.type === 'BUY'
                      ? 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/20'
                      : tx.type === 'SELL'
                      ? 'bg-red-500/5 border-red-500/10 hover:border-red-500/20'
                      : 'bg-gray-800/50 border-gray-800'
                  )}
                >
                  <span className={clsx(
                    'font-bold text-xs w-8 text-center',
                    tx.type === 'BUY' ? 'text-emerald-400' : tx.type === 'SELL' ? 'text-red-400' : 'text-gray-400'
                  )}>
                    {tx.type === 'BUY' ? '▲' : tx.type === 'SELL' ? '▼' : '→'}
                  </span>

                  <AddressDisplay address={tx.walletAddress} className="text-xs shrink-0" />

                  <span className="font-semibold text-gray-200 min-w-0 truncate">{tx.tokenSymbol}</span>

                  <div className="flex-1 flex items-center gap-3 justify-end text-right">
                    <span className="mono text-xs text-gray-400">{tx.amountSol.toFixed(3)} SOL</span>
                    {tx.amountUsd > 0 && (
                      <span className="mono text-xs text-gray-500">${tx.amountUsd.toFixed(0)}</span>
                    )}
                    <span className="text-xs text-gray-600 font-mono">{tx.dex}</span>
                    <span className="text-xs text-gray-600 w-8 shrink-0 text-right">{timeSince(tx.blockTime)}</span>
                    <a
                      href={`https://solscan.io/tx/${tx.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-brand-400"
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Transaction history for selected wallet */}
        {selectedWallet && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Clock size={16} className="text-gray-400" />
                Historique — <AddressDisplay address={selectedWallet} className="text-xs" />
              </h2>
              <button onClick={refetchTx} className="btn-ghost p-1.5">
                <RefreshCw size={12} className={txLoad ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="overflow-auto max-h-64">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="table-head">Type</th>
                    <th className="table-head">Token</th>
                    <th className="table-head text-right">SOL</th>
                    <th className="table-head text-right">USD</th>
                    <th className="table-head">DEX</th>
                    <th className="table-head text-right">Date</th>
                    <th className="table-head"></th>
                  </tr>
                </thead>
                <tbody>
                  {txLoad
                    ? [...Array(5)].map((_, i) => (
                        <tr key={i} className="border-b border-gray-800">
                          {[...Array(7)].map((_, j) => (
                            <td key={j} className="table-cell">
                              <div className="h-3 bg-gray-800 rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : ((txHistory as Array<{
                        signature: string;
                        type: string;
                        token_symbol: string;
                        amount_sol: number;
                        amount_usd: number;
                        dex: string;
                        block_time: number;
                      }>) ?? []).map(tx => (
                        <tr key={tx.signature} className="table-row">
                          <td className="table-cell">
                            <span className={tx.type === 'BUY' ? 'badge-green' : tx.type === 'SELL' ? 'badge-red' : 'badge-gray'}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="table-cell font-semibold text-gray-200">{tx.token_symbol}</td>
                          <td className="table-cell text-right mono">{tx.amount_sol.toFixed(3)}</td>
                          <td className="table-cell text-right mono text-gray-400">${tx.amount_usd.toFixed(0)}</td>
                          <td className="table-cell text-gray-500 text-xs">{tx.dex}</td>
                          <td className="table-cell text-right text-xs text-gray-500">
                            {new Date(tx.block_time * 1000).toLocaleDateString()}
                          </td>
                          <td className="table-cell">
                            <a href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noopener noreferrer"
                              className="text-gray-600 hover:text-brand-400">
                              <ExternalLink size={12} />
                            </a>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
