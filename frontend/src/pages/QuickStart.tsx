import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Circle, Zap, Wallet, Copy, ArrowRight, RefreshCw, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { healthApi, walletsApi, discoverApi } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

interface Step {
  id: number;
  title: string;
  desc: string;
  done: boolean;
  action?: () => void;
  actionLabel?: string;
  link?: string;
  linkLabel?: string;
}

interface AppConfig {
  budgetEur: number;
  basePositionEur: number;
  solEurRate: number;
  tiers: Array<{ tier: number; eur: number; sol: number; label: string }>;
  filters: { minDailyVolumeUsd: number; maxLastActivityHours: number; minLiquidityUsd: number };
  slippage: { highLiquidity: number; medLiquidity: number; lowLiquidity: number; highLiqThreshold: number; medLiqThreshold: number };
  hasTraderWallet: boolean;
  hasBirdeye: boolean;
  hasHelius: boolean;
}

export default function QuickStart() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoAdding, setAutoAdding] = useState(false);
  const [autoAdded, setAutoAdded] = useState(0);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [h, cfg] = await Promise.all([
        healthApi.check(),
        fetch('/api/wallets/app/config').then(r => r.json()).then(r => r.data).catch(() => null),
      ]);
      setHealth(h);
      if (cfg) setAppConfig(cfg);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStatus(); }, []);

  const { connected } = useWebSocket();
  // Backend is confirmed up if WS is connected OR health says so
  const backendUp  = connected || health !== null;
  const heliusOk   = backendUp && (health ? !!health.helius : connected);
  const birdeyeOk  = backendUp && (health ? !!health.birdeye : connected);
  const walletOk   = !!(health as Record<string, unknown> | null)?.traderWallet;

  // Auto-add top 5 wallets that pass all filters
  async function handleAutoAdd() {
    setAutoAdding(true);
    try {
      const traders = await discoverApi.topTraders({ timeframe: '7d', limit: '100' } as Record<string, string>);
      const eligible = (traders as Array<{ address: string; passesFilters: boolean; isTracked: boolean; score: number }>)
        .filter(t => t.passesFilters && !t.isTracked)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      let count = 0;
      for (const t of eligible) {
        await walletsApi.add(t.address, `Auto #${count + 1}`, ['auto', 'top-trader']);
        count++;
      }
      setAutoAdded(count);
    } catch (e) {
      console.error(e);
    } finally {
      setAutoAdding(false);
    }
  }

  const steps: Step[] = [
    {
      id: 1,
      title: 'Helius connecté',
      desc: 'API de tracking temps réel — transactions Solana en direct.',
      done: heliusOk,
      link: 'https://helius.dev',
      linkLabel: 'helius.dev',
    },
    {
      id: 2,
      title: 'Birdeye connecté',
      desc: 'Prix des tokens, analytics wallets, leaderboard top traders.',
      done: birdeyeOk,
      link: 'https://birdeye.so',
      linkLabel: 'birdeye.so',
    },
    {
      id: 3,
      title: 'Wallet de trading configuré',
      desc: 'Clé privée Phantom pour exécuter les copy trades automatiquement.',
      done: walletOk,
      action: () => {},
      actionLabel: 'Ajouter dans .env → TRADER_PRIVATE_KEY',
    },
    {
      id: 4,
      title: 'Wallets alpha ajoutés',
      desc: 'Importer automatiquement les meilleurs traders avec volume > $10k/j et actifs < 24h.',
      done: autoAdded > 0,
      action: handleAutoAdd,
      actionLabel: autoAdding ? 'Import en cours...' : `Auto-importer les 5 meilleurs wallets`,
    },
    {
      id: 5,
      title: 'Copy trade activé',
      desc: 'Activer l\'auto-buy sur les wallets importés.',
      done: false,
      action: () => navigate('/copy-trade'),
      actionLabel: 'Configurer le copy trade →',
    },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap size={20} className="text-brand-400" />
            Démarrage rapide
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Suis ces étapes pour être opérationnel en moins de 5 minutes
          </p>
        </div>
        <button onClick={fetchStatus} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Vérifier
        </button>
      </div>

      {/* Progress bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-300">{completedCount}/{steps.length} étapes complétées</span>
          <span className="text-sm font-bold text-brand-400">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.id} className={clsx(
            'card transition-all',
            step.done
              ? 'border-emerald-500/20 bg-emerald-500/5'
              : 'border-gray-800 hover:border-gray-700'
          )}>
            <div className="flex items-start gap-4">
              <div className="shrink-0 mt-0.5">
                {step.done
                  ? <CheckCircle size={22} className="text-emerald-400" />
                  : <Circle size={22} className="text-gray-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={clsx('font-semibold text-sm', step.done ? 'text-emerald-300 line-through opacity-70' : 'text-white')}>
                    Étape {step.id} — {step.title}
                  </h3>
                  {!step.done && step.link && (
                    <a href={step.link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 shrink-0">
                      {step.linkLabel} <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
                {!step.done && step.action && (
                  <button
                    onClick={step.action}
                    disabled={autoAdding}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 text-brand-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {autoAdding && step.id === 4
                      ? <RefreshCw size={12} className="animate-spin" />
                      : <ArrowRight size={12} />}
                    {step.actionLabel}
                  </button>
                )}
                {step.id === 4 && autoAdded > 0 && (
                  <p className="mt-2 text-xs text-emerald-400">
                    ✓ {autoAdded} wallets importés avec succès
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Budget & Tiers */}
      {appConfig && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Wallet size={16} className="text-brand-400" />
            Budget & Paliers de position (€100 départ)
          </h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {appConfig.tiers.map((tier) => (
              <div key={tier.tier} className={clsx(
                'rounded-lg p-3 border text-center',
                tier.tier === 1 ? 'border-blue-500/20 bg-blue-500/5' :
                tier.tier === 2 ? 'border-yellow-500/20 bg-yellow-500/5' :
                                  'border-emerald-500/20 bg-emerald-500/5'
              )}>
                <div className={clsx(
                  'text-lg font-bold mono',
                  tier.tier === 1 ? 'text-blue-400' :
                  tier.tier === 2 ? 'text-yellow-400' : 'text-emerald-400'
                )}>
                  {tier.eur}€
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  ≈ {tier.sol.toFixed(3)} SOL
                </div>
                <div className="text-xs text-gray-400 mt-1 font-medium">
                  {tier.tier === 1 ? 'Score < 70' : tier.tier === 2 ? 'Score 70–85' : 'Score > 85'}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {tier.tier === 1 ? 'Conservateur' : tier.tier === 2 ? 'Modéré' : 'Agressif'}
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 border-t border-gray-800 pt-3 space-y-1">
            <p>💡 Avec 100€ tu peux avoir <strong className="text-gray-300">jusqu'à 20 positions simultanées</strong> de 5€</p>
            <p>📊 Volume min requis : <strong className="text-gray-300">${appConfig.filters.minDailyVolumeUsd.toLocaleString()}/j</strong></p>
            <p>⏱ Dernière activité max : <strong className="text-gray-300">{appConfig.filters.maxLastActivityHours}h</strong></p>
            <p>💧 Liquidité min : <strong className="text-gray-300">${appConfig.filters.minLiquidityUsd.toLocaleString()}</strong></p>
          </div>
        </div>
      )}

      {/* Slippage info */}
      {appConfig && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Zap size={16} className="text-yellow-400" />
            Optimisation des frais & slippage
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            {[
              { label: 'Haute liquidité', threshold: '>$500k', bps: appConfig.slippage.highLiquidity, color: 'text-emerald-400' },
              { label: 'Liquidité moyenne', threshold: '$50k–500k', bps: appConfig.slippage.medLiquidity, color: 'text-yellow-400' },
              { label: 'Faible liquidité', threshold: '<$50k', bps: appConfig.slippage.lowLiquidity, color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-gray-800 rounded-lg p-3">
                <div className={`text-lg font-bold mono ${s.color}`}>{(s.bps / 100).toFixed(1)}%</div>
                <div className="text-gray-400 mt-0.5">{s.label}</div>
                <div className="text-gray-600 mt-0.5">{s.threshold}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Le slippage est calculé dynamiquement selon la liquidité du pool. Priority fee adapté automatiquement au niveau de congestion du réseau.
          </p>
        </div>
      )}

      {/* CTA */}
      {completedCount >= 4 && (
        <div className="card border-brand-500/30 bg-brand-500/5 text-center">
          <div className="text-2xl mb-2">🚀</div>
          <h3 className="font-bold text-brand-300 mb-1">Tu es prêt à trader !</h3>
          <p className="text-sm text-gray-400 mb-4">Tout est configuré. Active le copy trade et regarde les positions s'ouvrir automatiquement.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/copy-trade')} className="btn-primary flex items-center gap-2">
              <Copy size={14} />
              Activer le copy trade
            </button>
            <button onClick={() => navigate('/tracker')} className="btn-ghost flex items-center gap-2">
              <Zap size={14} />
              Voir le live tracker
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
