import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Circle, Zap, Wallet, Copy, ArrowRight, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { walletsApi, discoverApi } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

export default function QuickStart() {
  const navigate = useNavigate();
  const { connected } = useWebSocket();
  const [autoAdding, setAutoAdding] = useState(false);
  const [autoAdded, setAutoAdded] = useState(0);
  const [autoError, setAutoError] = useState('');

  async function handleAutoAdd() {
    setAutoAdding(true);
    setAutoError('');
    try {
      const traders = await discoverApi.topTraders({ limit: '100' });
      const eligible = (traders as Array<{ address: string; passesFilters: boolean; isTracked: boolean; score: number }>)
        .filter(t => !t.isTracked)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 5);

      if (eligible.length === 0) {
        setAutoError('Aucun wallet disponible — clique sur Wallet Hunter pour en ajouter manuellement');
        return;
      }
      let count = 0;
      for (const t of eligible) {
        await walletsApi.add(t.address, `Top Trader #${count + 1}`, ['auto']);
        count++;
      }
      setAutoAdded(count);
    } catch (e) {
      setAutoError('Erreur lors de l\'import — vérifie que le backend tourne');
    } finally {
      setAutoAdding(false);
    }
  }

  // Les 5 étapes — les 2 premières sont OK si WebSocket connecté
  const steps = [
    {
      id: 1,
      title: 'Helius API connecté',
      desc: 'Tracking temps réel des transactions Solana.',
      done: connected,
      tag: connected ? '✓ Clé configurée' : 'Vérification...',
    },
    {
      id: 2,
      title: 'Birdeye API connecté',
      desc: 'Prix des tokens et leaderboard des top traders.',
      done: connected,
      tag: connected ? '✓ Clé configurée' : 'Vérification...',
    },
    {
      id: 3,
      title: 'Wallet Phantom (optionnel)',
      desc: 'Nécessaire uniquement pour le copy trade automatique. Tu peux tracker et tester sans.',
      done: false,
      optional: true,
    },
    {
      id: 4,
      title: 'Importer les wallets à copier',
      desc: 'Trouve les 5 meilleurs traders actifs dans les dernières 24h.',
      done: autoAdded > 0,
    },
    {
      id: 5,
      title: 'Activer le copy trade',
      desc: 'Configure l\'auto-buy sur les wallets importés.',
      done: false,
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Zap size={20} className="text-brand-400" />
          Démarrage rapide
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Opérationnel en 5 minutes</p>
      </div>

      {/* Statut connexion */}
      <div className={clsx(
        'flex items-center gap-3 p-3 rounded-lg border text-sm',
        connected
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
          : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'
      )}>
        <span className={clsx('w-2 h-2 rounded-full', connected ? 'bg-emerald-400' : 'bg-yellow-400')} />
        {connected
          ? 'Backend connecté — Helius et Birdeye actifs'
          : 'Connexion en cours... (attends 3 secondes)'}
      </div>

      {/* Barre de progression */}
      <div className="card">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">{doneCount}/{steps.length} étapes</span>
          <span className="text-brand-400 font-bold">{pct}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Étapes */}
      <div className="space-y-3">

        {/* Étape 1 */}
        <div className={clsx('card', steps[0].done ? 'border-emerald-500/20' : '')}>
          <div className="flex items-start gap-3">
            {steps[0].done
              ? <CheckCircle size={20} className="text-emerald-400 mt-0.5 shrink-0" />
              : <Circle size={20} className="text-gray-600 mt-0.5 shrink-0" />}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className={clsx('font-semibold text-sm', steps[0].done ? 'text-emerald-300' : 'text-white')}>
                  Étape 1 — {steps[0].title}
                </span>
                {steps[0].done && <span className="badge-green text-xs">OK</span>}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{steps[0].desc}</p>
            </div>
          </div>
        </div>

        {/* Étape 2 */}
        <div className={clsx('card', steps[1].done ? 'border-emerald-500/20' : '')}>
          <div className="flex items-start gap-3">
            {steps[1].done
              ? <CheckCircle size={20} className="text-emerald-400 mt-0.5 shrink-0" />
              : <Circle size={20} className="text-gray-600 mt-0.5 shrink-0" />}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className={clsx('font-semibold text-sm', steps[1].done ? 'text-emerald-300' : 'text-white')}>
                  Étape 2 — {steps[1].title}
                </span>
                {steps[1].done && <span className="badge-green text-xs">OK</span>}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{steps[1].desc}</p>
            </div>
          </div>
        </div>

        {/* Étape 3 — Wallet (optionnel) */}
        <div className="card border-gray-800">
          <div className="flex items-start gap-3">
            <Circle size={20} className="text-gray-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-white">Étape 3 — {steps[2].title}</span>
                <span className="badge-yellow text-xs">Optionnel</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{steps[2].desc}</p>
              <div className="mt-2 text-xs text-gray-500 bg-gray-800 rounded-lg p-2 font-mono">
                Phantom → Settings → Export Private Key → copie dans .env → TRADER_PRIVATE_KEY=...
              </div>
            </div>
          </div>
        </div>

        {/* Étape 4 — Import wallets */}
        <div className={clsx('card', steps[3].done ? 'border-emerald-500/20' : 'border-brand-500/20')}>
          <div className="flex items-start gap-3">
            {steps[3].done
              ? <CheckCircle size={20} className="text-emerald-400 mt-0.5 shrink-0" />
              : <Zap size={20} className="text-brand-400 mt-0.5 shrink-0" />}
            <div className="flex-1">
              <span className="font-semibold text-sm text-white">Étape 4 — {steps[3].title}</span>
              <p className="text-xs text-gray-400 mt-0.5">{steps[3].desc}</p>
              {!steps[3].done && (
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    onClick={handleAutoAdd}
                    disabled={autoAdding}
                    className="btn-primary flex items-center gap-2 w-fit"
                  >
                    {autoAdding
                      ? <><RefreshCw size={14} className="animate-spin" /> Import en cours...</>
                      : <><Zap size={14} /> Auto-importer les 5 meilleurs wallets</>}
                  </button>
                  <button
                    onClick={() => navigate('/hunter')}
                    className="btn-ghost flex items-center gap-2 w-fit text-sm"
                  >
                    <ArrowRight size={14} /> Ou choisir manuellement dans Wallet Hunter
                  </button>
                  {autoError && (
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                      <AlertCircle size={12} />
                      {autoError}
                    </div>
                  )}
                </div>
              )}
              {steps[3].done && (
                <p className="text-xs text-emerald-400 mt-2">✓ {autoAdded} wallets importés et trackés</p>
              )}
            </div>
          </div>
        </div>

        {/* Étape 5 — Copy trade */}
        <div className="card border-brand-500/20">
          <div className="flex items-start gap-3">
            <Copy size={20} className="text-brand-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold text-sm text-white">Étape 5 — {steps[4].title}</span>
              <p className="text-xs text-gray-400 mt-0.5">{steps[4].desc}</p>
              <button
                onClick={() => navigate('/copy-trade')}
                className="mt-3 btn-primary flex items-center gap-2 w-fit"
              >
                <Copy size={14} /> Configurer le copy trade
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Budget info */}
      <div className="card bg-brand-500/5 border-brand-500/20">
        <h3 className="text-sm font-semibold text-brand-300 mb-3 flex items-center gap-2">
          <Wallet size={15} />
          Budget €100 — Paliers automatiques
        </h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { tier: 'P1', eur: '5€', score: 'Score < 70', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
            { tier: 'P2', eur: '10€', score: 'Score 70–85', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
            { tier: 'P3', eur: '15€', score: 'Score > 85', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          ].map(t => (
            <div key={t.tier} className={clsx('rounded-lg p-3 border', t.bg)}>
              <div className={clsx('text-lg font-bold', t.color)}>{t.eur}</div>
              <div className="text-xs text-gray-500 mt-1">{t.score}</div>
              <div className="text-xs font-bold text-gray-400 mt-1">{t.tier}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Slippage optimisé : 0.5% (haute liquidité) → 1% → 3% (faible liquidité) · Priority fee auto
        </p>
      </div>

    </div>
  );
}
