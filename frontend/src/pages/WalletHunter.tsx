import React, { useState } from 'react';
import {
  Search, TrendingUp, Star, Plus, RefreshCw, ExternalLink,
  Filter, Info, ChevronDown, Flame, Sparkles, BarChart2
} from 'lucide-react';
import { AddressDisplay } from '../components/AddressDisplay';
import { PnlBadge } from '../components/PnlBadge';
import { useApi } from '../hooks/useApi';
import { discoverApi, walletsApi } from '../services/api';
import { clsx } from 'clsx';

const SOURCES = [
  {
    id: 'birdeye-gainers',
    label: 'Birdeye Top Gainers',
    icon: TrendingUp,
    desc: 'Meilleurs traders Solana par PnL sur 7 jours — source la plus fiable pour trouver les vrais performers',
    color: 'text-brand-400',
  },
  {
    id: 'manual',
    label: 'Adresse manuelle',
    icon: Search,
    desc: 'Colle directement une adresse wallet Solana à suivre',
    color: 'text-blue-400',
  },
];

// Where to find alpha wallets — education section
const ALPHA_SOURCES = [
  {
    name: 'Birdeye Leaderboard',
    url: 'https://birdeye.so/leaderboard',
    desc: 'Leaderboard officiel des top traders Solana par PnL réalisé. Filtre par 7j/30j.',
    tags: ['free', 'best'],
  },
  {
    name: 'Cielo Finance',
    url: 'https://cielo.finance',
    desc: 'Wallet tracking avancé avec PnL par token, visualisation des trades et alertes.',
    tags: ['free', 'analytics'],
  },
  {
    name: 'Dexscreener Wallets',
    url: 'https://dexscreener.com',
    desc: 'Voir qui a acheté tôt les tokens qui ont pumped. Cliquer sur un token → Traders.',
    tags: ['free', 'onchain'],
  },
  {
    name: 'Solscan Top Holders',
    url: 'https://solscan.io',
    desc: 'Checker les early holders d\'un token avant le pump. Holder list → voir quand ils ont acheté.',
    tags: ['free', 'research'],
  },
  {
    name: 'Gmgn.ai',
    url: 'https://gmgn.ai',
    desc: 'Copier les wallets qui ont fait 10x+ récemment. Classement par token et par PnL.',
    tags: ['premium', 'alpha'],
  },
  {
    name: 'Photon Sol',
    url: 'https://photon-sol.tinyastro.io',
    desc: 'Real-time DEX tracker avec liste des top traders. Identifier les snipers.',
    tags: ['free', 'realtime'],
  },
  {
    name: 'Bullx.io',
    url: 'https://bullx.io',
    desc: 'Terminal de trading avec copy trade intégré et analytics de wallets.',
    tags: ['premium', 'trading'],
  },
  {
    name: 'Arkham Intelligence',
    url: 'https://platform.arkhamintelligence.com',
    desc: 'Intelligence blockchain pour identifier les wallets de hedge funds et insiders.',
    tags: ['premium', 'intel'],
  },
];

const STRATEGY_TIPS = [
  {
    title: 'Critères d\'un bon wallet à copier',
    tips: [
      'Win rate > 60% sur 30+ trades',
      'PnL réalisé > $50k sur 30 jours',
      'Taille moyenne des positions : 0.5–5 SOL (ni trop petit, ni trop gros)',
      'Actif depuis > 2 mois (pas un wallet one-shot)',
      'Trade sur des tokens < $10M market cap (plus de potentiel)',
      'Entre dans les 1ères heures après le launch (sniper/early)',
    ],
  },
  {
    title: 'Red flags à éviter',
    tips: [
      'Win rate gonflé par un seul trade chanceux',
      'Volume très élevé mais PnL faible → overtrader',
      'Achète principalement des rugs ou honeypots',
      'Positions trop grosses → risque de front-run difficile',
      'Inactif depuis > 2 semaines',
      'Trades principalement sur des tokens connus → peu d\'alpha',
    ],
  },
];

function TagBadge({ tag }: { tag: string }) {
  const map: Record<string, string> = {
    free: 'badge-green', premium: 'badge-yellow', best: 'badge-blue',
    analytics: 'badge-gray', onchain: 'badge-gray', research: 'badge-gray',
    realtime: 'badge-blue', alpha: 'badge-yellow', intel: 'badge-yellow',
    trading: 'badge-blue',
  };
  return <span className={map[tag] ?? 'badge-gray'}>{tag}</span>;
}

export default function WalletHunter() {
  const [source, setSource] = useState('birdeye-gainers');
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('7d');
  const [minPnl, setMinPnl] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualLabel, setManualLabel] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'discover' | 'sources' | 'strategy'>('discover');

  const { data: traders, loading, refetch } = useApi(
    () => discoverApi.topTraders({ timeframe, limit: 100 }),
    [timeframe]
  );

  const filtered = ((traders as Array<{
    address: string;
    pnlUsd: number;
    winRate: number;
    tradesCount: number;
    volumeUsd: number;
    isTracked: boolean;
  }> | null) ?? []).filter(t => !minPnl || t.pnlUsd >= parseFloat(minPnl));

  async function handleAdd(address: string, label = '') {
    setAdding(address);
    try {
      await walletsApi.add(address, label, []);
      setAdded(s => new Set([...s, address]));
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(null);
    }
  }

  async function handleManualAdd() {
    if (!manualAddress || manualAddress.length < 32) return;
    await handleAdd(manualAddress, manualLabel);
    setManualAddress('');
    setManualLabel('');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Search size={20} className="text-brand-400" />
          Wallet Hunter
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Trouve les wallets les plus profitables sur Solana et ajoute-les au tracker
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {([
          { id: 'discover', label: 'Découvrir', icon: Flame },
          { id: 'sources',  label: 'Sources alpha', icon: Sparkles },
          { id: 'strategy', label: 'Stratégie', icon: BarChart2 },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === id
                ? 'bg-brand-500 text-white'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Découvrir ───────────────────────────────────────────────── */}
      {activeTab === 'discover' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="card flex flex-wrap gap-4 items-end">
            <div>
              <label className="label">Période</label>
              <div className="flex gap-1">
                {(['24h', '7d', '30d'] as const).map(tf => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={clsx(
                      'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                      timeframe === tf
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    )}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">PnL min ($)</label>
              <input
                type="number"
                value={minPnl}
                onChange={e => setMinPnl(e.target.value)}
                placeholder="ex: 5000"
                className="input w-36"
              />
            </div>
            <button onClick={refetch} disabled={loading} className="btn-primary flex items-center gap-2">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Rafraîchir
            </button>

            {/* Manual add */}
            <div className="flex-1 min-w-0 flex gap-2">
              <div className="flex-1">
                <label className="label">Adresse manuelle</label>
                <input
                  value={manualAddress}
                  onChange={e => setManualAddress(e.target.value)}
                  placeholder="Colle une adresse Solana..."
                  className="input font-mono text-xs"
                />
              </div>
              <div className="w-36">
                <label className="label">Label</label>
                <input
                  value={manualLabel}
                  onChange={e => setManualLabel(e.target.value)}
                  placeholder="ex: Whale #1"
                  className="input"
                />
              </div>
              <button
                onClick={handleManualAdd}
                disabled={!manualAddress || adding === manualAddress}
                className="btn-primary flex items-center gap-2 self-end"
              >
                <Plus size={14} />
                Ajouter
              </button>
            </div>
          </div>

          {/* Results count */}
          {!loading && (
            <div className="text-sm text-gray-500">
              {filtered.length} wallets trouvés
              {minPnl && ` (filtre PnL > $${parseFloat(minPnl).toLocaleString()})`}
            </div>
          )}

          {/* Traders table */}
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="table-head">#</th>
                  <th className="table-head">Wallet</th>
                  <th className="table-head text-right">PnL ({timeframe})</th>
                  <th className="table-head text-right">Win Rate</th>
                  <th className="table-head text-right">Trades</th>
                  <th className="table-head text-right">Volume</th>
                  <th className="table-head text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(10)].map((_, i) => (
                      <tr key={i} className="border-b border-gray-800">
                        {[...Array(7)].map((_, j) => (
                          <td key={j} className="table-cell">
                            <div className="h-4 bg-gray-800 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : filtered.length === 0
                  ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-gray-500">
                          <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
                          <p>Aucun trader trouvé. Configure ta clé API Birdeye dans .env</p>
                        </td>
                      </tr>
                    )
                  : filtered.map((t, idx) => {
                      const isAdded = added.has(t.address) || t.isTracked;
                      const isAdding = adding === t.address;
                      return (
                        <tr key={t.address} className="table-row">
                          <td className="table-cell text-gray-600 mono">{idx + 1}</td>
                          <td className="table-cell">
                            <AddressDisplay address={t.address} />
                          </td>
                          <td className="table-cell text-right">
                            <PnlBadge value={t.pnlUsd} />
                          </td>
                          <td className="table-cell text-right">
                            <span className={`mono text-sm font-medium ${(t.winRate ?? 0) >= 0.6 ? 'green' : (t.winRate ?? 0) >= 0.4 ? 'text-yellow-400' : 'red'}`}>
                              {((t.winRate ?? 0) * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="table-cell text-right mono text-gray-300">{t.tradesCount}</td>
                          <td className="table-cell text-right">
                            <span className="mono text-gray-400 text-xs">
                              ${t.volumeUsd >= 1000 ? (t.volumeUsd / 1000).toFixed(0) + 'k' : t.volumeUsd?.toFixed(0)}
                            </span>
                          </td>
                          <td className="table-cell text-right">
                            {isAdded ? (
                              <span className="badge-green">Suivi</span>
                            ) : (
                              <button
                                onClick={() => handleAdd(t.address)}
                                disabled={isAdding}
                                className="flex items-center gap-1 px-3 py-1 text-xs bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Plus size={12} />
                                {isAdding ? 'Ajout...' : 'Suivre'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Sources alpha ───────────────────────────────────────────── */}
      {activeTab === 'sources' && (
        <div className="space-y-4">
          <div className="card bg-blue-500/5 border-blue-500/20">
            <div className="flex items-start gap-3">
              <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-300">
                Ces plateformes te permettent de trouver manuellement les wallets les plus profitables.
                Copie l'adresse et colle-la dans l'onglet <strong>Découvrir</strong> → Adresse manuelle.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ALPHA_SOURCES.map(src => (
              <a
                key={src.name}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card hover:border-gray-700 transition-all group cursor-pointer block"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-semibold text-gray-200 group-hover:text-brand-400 transition-colors">
                    {src.name}
                  </span>
                  <ExternalLink size={14} className="text-gray-600 group-hover:text-brand-400 transition-colors shrink-0" />
                </div>
                <p className="text-sm text-gray-400 mb-3">{src.desc}</p>
                <div className="flex flex-wrap gap-1">
                  {src.tags.map(tag => <TagBadge key={tag} tag={tag} />)}
                </div>
              </a>
            ))}
          </div>

          {/* How to find wallets manually */}
          <div className="card border-brand-500/20 bg-brand-500/5">
            <h3 className="font-semibold text-brand-300 mb-3 flex items-center gap-2">
              <Sparkles size={16} />
              Comment trouver les meilleurs wallets manuellement
            </h3>
            <ol className="space-y-3 text-sm text-gray-300">
              {[
                'Va sur Dexscreener.com → filtre par "Solana" → tri par gainers du jour',
                'Clique sur un token qui a fait 10x+ → onglet "Traders"',
                'Identifie les wallets qui ont acheté dans les 30 premières minutes',
                'Vérifie leur historique sur Birdeye ou Cielo → PnL total et win rate',
                'Si win rate > 60% et PnL > $50k sur 30j → c\'est un wallet worth copying',
                'Colle son adresse dans SOLSCRAPER et active le copy trade !',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-400 text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* ── Tab: Stratégie ───────────────────────────────────────────────── */}
      {activeTab === 'strategy' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {STRATEGY_TIPS.map(section => (
            <div key={section.title} className="card">
              <h3 className="font-semibold text-gray-200 mb-4 flex items-center gap-2">
                <Star size={16} className={section.title.includes('Red') ? 'text-red-400' : 'text-emerald-400'} />
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.tips.map((tip, i) => (
                  <li key={i} className={`flex items-start gap-2 text-sm ${section.title.includes('Red') ? 'text-red-300' : 'text-emerald-300'}`}>
                    <span className="mt-1 shrink-0">{section.title.includes('Red') ? '✗' : '✓'}</span>
                    <span className="text-gray-300">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Risk management */}
          <div className="card md:col-span-2">
            <h3 className="font-semibold text-yellow-400 mb-4 flex items-center gap-2">
              <Info size={16} />
              Gestion du risque — De $100 à $10,000
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              {[
                {
                  phase: 'Phase 1 — $100–$500',
                  desc: 'Commence avec 0.05–0.1 SOL par trade. Suis 2–3 wallets max. Focus sur la survie du capital.',
                  color: 'border-blue-500/20 bg-blue-500/5',
                  textColor: 'text-blue-300',
                },
                {
                  phase: 'Phase 2 — $500–$2000',
                  desc: 'Monte à 0.2–0.5 SOL par trade. Ajoute 2–3 wallets supplémentaires. Re-investis 80% des profits.',
                  color: 'border-yellow-500/20 bg-yellow-500/5',
                  textColor: 'text-yellow-300',
                },
                {
                  phase: 'Phase 3 — $2000–$10k+',
                  desc: 'Positions de 0.5–2 SOL. Diversifie sur 5–10 wallets. Stop loss strict à 30–50%. Retire 20% des profits.',
                  color: 'border-emerald-500/20 bg-emerald-500/5',
                  textColor: 'text-emerald-300',
                },
              ].map(p => (
                <div key={p.phase} className={`rounded-lg p-4 border ${p.color}`}>
                  <div className={`font-semibold mb-2 ${p.textColor}`}>{p.phase}</div>
                  <p className="text-gray-400 text-xs leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
