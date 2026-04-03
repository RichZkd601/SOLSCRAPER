import React, { useState } from 'react';
import {
  Copy, Zap, Settings, ToggleLeft, ToggleRight, AlertTriangle,
  ExternalLink, RefreshCw, TrendingUp, DollarSign, ShieldAlert
} from 'lucide-react';
import { AddressDisplay } from '../components/AddressDisplay';
import { PnlBadge } from '../components/PnlBadge';
import { useApi } from '../hooks/useApi';
import { walletsApi, tradesApi } from '../services/api';
import { clsx } from 'clsx';

interface CopyConfig {
  is_enabled: number;
  copy_mode: 'FIXED' | 'PERCENT';
  fixed_amount_sol: number;
  percent_of_portfolio: number;
  max_position_sol: number;
  min_liquidity_usd: number;
  max_slippage_bps: number;
  auto_buy: number;
  auto_sell: number;
  stop_loss_percent: number;
  take_profit_percent: number;
  skip_if_mcap_above: number;
}

function WalletConfigPanel({ address, label }: { address: string; label: string }) {
  const { data: cfg, refetch } = useApi(() => walletsApi.copyConfig(address), [address]);
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState<CopyConfig | null>(null);

  const config = local ?? (cfg as CopyConfig | null) ?? {
    is_enabled: 0, copy_mode: 'FIXED', fixed_amount_sol: 0.1, percent_of_portfolio: 10,
    max_position_sol: 1.0, min_liquidity_usd: 10000, max_slippage_bps: 300,
    auto_buy: 0, auto_sell: 0, stop_loss_percent: 50, take_profit_percent: 200,
    skip_if_mcap_above: 0,
  };

  function update<K extends keyof CopyConfig>(key: K, value: CopyConfig[K]) {
    setLocal(prev => ({ ...(prev ?? config), [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await walletsApi.saveCopyConfig(address, {
        isEnabled: config.is_enabled,
        copyMode: config.copy_mode,
        fixedAmountSol: config.fixed_amount_sol,
        percentOfPortfolio: config.percent_of_portfolio,
        maxPositionSol: config.max_position_sol,
        minLiquidityUsd: config.min_liquidity_usd,
        maxSlippageBps: config.max_slippage_bps,
        autoBuy: !!config.auto_buy,
        autoSell: !!config.auto_sell,
        stopLossPercent: config.stop_loss_percent,
        takeProfitPercent: config.take_profit_percent,
        skipIfMcapAbove: config.skip_if_mcap_above,
      });
      await refetch();
      setLocal(null);
    } finally {
      setSaving(false);
    }
  }

  const isDirty = local !== null;

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-200">{label || 'Wallet'}</div>
          <AddressDisplay address={address} className="text-xs" />
        </div>
        <div className="flex items-center gap-3">
          <span className={config.is_enabled ? 'badge-green' : 'badge-gray'}>
            {config.is_enabled ? 'Actif' : 'Inactif'}
          </span>
          <button
            onClick={() => update('is_enabled', config.is_enabled ? 0 : 1)}
            className={clsx('transition-colors', config.is_enabled ? 'text-emerald-400' : 'text-gray-600')}
          >
            {config.is_enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
          </button>
        </div>
      </div>

      {/* Mode */}
      <div>
        <label className="label">Mode de copie</label>
        <div className="flex gap-2">
          {(['FIXED', 'PERCENT'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => update('copy_mode', mode)}
              className={clsx(
                'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                config.copy_mode === mode
                  ? 'bg-brand-500/20 border-brand-500/40 text-brand-400'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
              )}
            >
              {mode === 'FIXED' ? '🔒 Fixe (SOL)' : '📊 Pourcentage (%)'}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div className="grid grid-cols-2 gap-4">
        {config.copy_mode === 'FIXED' ? (
          <div>
            <label className="label">Montant fixe (SOL)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={config.fixed_amount_sol}
              onChange={e => update('fixed_amount_sol', parseFloat(e.target.value))}
              className="input"
            />
          </div>
        ) : (
          <div>
            <label className="label">% du portefeuille</label>
            <input
              type="number"
              step="1"
              min="1"
              max="100"
              value={config.percent_of_portfolio}
              onChange={e => update('percent_of_portfolio', parseFloat(e.target.value))}
              className="input"
            />
          </div>
        )}
        <div>
          <label className="label">Position max (SOL)</label>
          <input
            type="number"
            step="0.1"
            min="0.01"
            value={config.max_position_sol}
            onChange={e => update('max_position_sol', parseFloat(e.target.value))}
            className="input"
          />
        </div>
      </div>

      {/* Auto buy/sell toggles */}
      <div className="grid grid-cols-2 gap-4">
        {([
          { key: 'auto_buy' as const, label: '⬆️ Auto-Buy', desc: 'Copie les achats automatiquement' },
          { key: 'auto_sell' as const, label: '⬇️ Auto-Sell', desc: 'Copie les ventes automatiquement' },
        ]).map(({ key, label: lbl, desc }) => (
          <button
            key={key}
            onClick={() => update(key, config[key] ? 0 : 1)}
            className={clsx(
              'text-left p-3 rounded-lg border transition-all',
              config[key]
                ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600'
            )}
          >
            <div className="font-medium text-sm">{lbl}</div>
            <div className="text-xs opacity-70 mt-0.5">{desc}</div>
          </button>
        ))}
      </div>

      {/* Risk params */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className="label">Slippage (bps)</label>
          <input
            type="number"
            step="50"
            min="50"
            max="3000"
            value={config.max_slippage_bps}
            onChange={e => update('max_slippage_bps', parseInt(e.target.value))}
            className="input"
          />
          <p className="text-xs text-gray-600 mt-1">{(config.max_slippage_bps / 100).toFixed(1)}%</p>
        </div>
        <div>
          <label className="label">Liquidité min ($)</label>
          <input
            type="number"
            step="1000"
            value={config.min_liquidity_usd}
            onChange={e => update('min_liquidity_usd', parseFloat(e.target.value))}
            className="input"
          />
        </div>
        <div>
          <label className="label">Stop Loss (%)</label>
          <input
            type="number"
            step="5"
            min="10"
            max="100"
            value={config.stop_loss_percent}
            onChange={e => update('stop_loss_percent', parseFloat(e.target.value))}
            className="input text-red-400"
          />
        </div>
        <div>
          <label className="label">Take Profit (%)</label>
          <input
            type="number"
            step="10"
            min="10"
            value={config.take_profit_percent}
            onChange={e => update('take_profit_percent', parseFloat(e.target.value))}
            className="input text-emerald-400"
          />
        </div>
      </div>

      <div>
        <label className="label">Skip si Mcap supérieur à ($, 0 = désactivé)</label>
        <input
          type="number"
          step="100000"
          value={config.skip_if_mcap_above}
          onChange={e => update('skip_if_mcap_above', parseFloat(e.target.value))}
          className="input w-full sm:w-1/2"
          placeholder="0 = désactivé"
        />
      </div>

      {/* Save */}
      {isDirty && (
        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Settings size={14} />}
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function CopyTrade() {
  const { data: wallets } = useApi(() => walletsApi.list());
  const { data: tradeHistory, loading: histLoad } = useApi(() => tradesApi.list({ limit: 50 }));
  const { data: stats } = useApi(() => tradesApi.stats());
  const [manualBuy, setManualBuy] = useState({ mint: '', sol: '', slippage: '300' });
  const [buying, setBuying] = useState(false);
  const [buyResult, setBuyResult] = useState<string | null>(null);

  const walletList = (wallets as Array<{ address: string; label: string; is_active: number }> | null) ?? [];

  async function handleManualBuy() {
    if (!manualBuy.mint || !manualBuy.sol) return;
    setBuying(true);
    setBuyResult(null);
    try {
      const r = await tradesApi.manualBuy(manualBuy.mint, parseFloat(manualBuy.sol), parseInt(manualBuy.slippage));
      if (r.success) {
        setBuyResult(`✓ Succès! Signature: ${r.data?.signature?.slice(0, 20)}...`);
      } else {
        setBuyResult(`✗ Erreur: ${r.data?.error}`);
      }
    } catch (e) {
      setBuyResult(`✗ ${(e as Error).message}`);
    } finally {
      setBuying(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Copy size={20} className="text-brand-400" />
          Copy Trade
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure l'exécution automatique des trades copiés</p>
      </div>

      {/* Warning */}
      <div className="card border-yellow-500/20 bg-yellow-500/5">
        <div className="flex items-start gap-3">
          <ShieldAlert size={18} className="text-yellow-400 mt-0.5 shrink-0" />
          <div className="text-sm text-yellow-300">
            <strong>Wallet de trading requis.</strong> Configure <code className="bg-gray-800 px-1 rounded text-xs">TRADER_PRIVATE_KEY</code> et{' '}
            <code className="bg-gray-800 px-1 rounded text-xs">TRADER_WALLET_ADDRESS</code> dans le fichier <code className="bg-gray-800 px-1 rounded text-xs">.env</code>.
            Les trades réels sont exécutés avec SOL réel — commence petit!
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total trades', value: (stats as { total?: number }).total ?? 0, color: '' },
            { label: 'Succès', value: (stats as { success?: number }).success ?? 0, color: 'text-emerald-400' },
            { label: 'Échoués', value: (stats as { failed?: number }).failed ?? 0, color: 'text-red-400' },
            { label: 'SOL investis', value: `${((stats as { total_sol_invested?: number }).total_sol_invested ?? 0).toFixed(2)} ◎`, color: 'text-brand-400' },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <div className="text-xs text-gray-500 mb-1">{s.label}</div>
              <div className={`text-xl font-bold mono ${s.color || 'text-white'}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Wallet configs */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Settings size={16} className="text-gray-400" />
            Configuration par wallet
          </h2>
          {walletList.length === 0 ? (
            <div className="card text-center py-8 text-gray-500">
              <Copy size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun wallet suivi. Utilise le Wallet Hunter.</p>
            </div>
          ) : (
            walletList.map(w => (
              <WalletConfigPanel key={w.address} address={w.address} label={w.label} />
            ))
          )}
        </div>

        {/* Right: Manual trade + history */}
        <div className="space-y-4">
          {/* Manual buy */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <Zap size={16} className="text-yellow-400" />
              Trade Manuel
            </h2>
            <div className="space-y-3">
              <div>
                <label className="label">Token Mint Address</label>
                <input
                  value={manualBuy.mint}
                  onChange={e => setManualBuy(p => ({ ...p, mint: e.target.value }))}
                  placeholder="Ex: So111...112 (Adresse du token)"
                  className="input font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Montant (SOL)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={manualBuy.sol}
                    onChange={e => setManualBuy(p => ({ ...p, sol: e.target.value }))}
                    placeholder="0.1"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Slippage (bps)</label>
                  <input
                    type="number"
                    step="50"
                    value={manualBuy.slippage}
                    onChange={e => setManualBuy(p => ({ ...p, slippage: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>
              {buyResult && (
                <div className={clsx(
                  'p-3 rounded-lg text-xs font-mono',
                  buyResult.startsWith('✓') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                )}>
                  {buyResult}
                </div>
              )}
              <button
                onClick={handleManualBuy}
                disabled={buying || !manualBuy.mint || !manualBuy.sol}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {buying ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                {buying ? 'Exécution...' : 'Acheter via Jupiter'}
              </button>
            </div>
          </div>

          {/* Trade history */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <TrendingUp size={16} className="text-brand-400" />
              Historique Copy Trades
            </h2>
            <div className="overflow-auto max-h-96 space-y-1.5">
              {histLoad
                ? [...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-800 rounded animate-pulse" />
                  ))
                : ((tradeHistory as Array<{
                    id: number;
                    type: string;
                    token_symbol: string;
                    amount_sol: number;
                    status: string;
                    our_signature?: string;
                    tracked_wallet: string;
                    executed_at: string;
                  }>) ?? []).map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-2.5 bg-gray-800 rounded-lg text-sm">
                      <span className={t.type === 'BUY' ? 'badge-green' : 'badge-red'}>{t.type}</span>
                      <span className="font-semibold text-gray-200">{t.token_symbol}</span>
                      <span className="mono text-gray-400 text-xs">{t.amount_sol.toFixed(3)} ◎</span>
                      <div className="flex-1 text-right">
                        <span className={clsx(
                          'text-xs font-medium',
                          t.status === 'SUCCESS' ? 'text-emerald-400'
                          : t.status === 'FAILED' ? 'text-red-400'
                          : t.status === 'SKIPPED' ? 'text-yellow-400'
                          : 'text-gray-400'
                        )}>
                          {t.status}
                        </span>
                      </div>
                      {t.our_signature && (
                        <a href={`https://solscan.io/tx/${t.our_signature}`} target="_blank" rel="noopener noreferrer"
                          className="text-gray-600 hover:text-brand-400">
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  ))}
              {!histLoad && ((tradeHistory as unknown[]) ?? []).length === 0 && (
                <div className="text-center py-6 text-gray-500 text-sm">Aucun trade exécuté</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
