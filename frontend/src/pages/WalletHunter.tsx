import React, { useState } from 'react';
import {
  Search, TrendingUp, Plus, RefreshCw, ExternalLink,
  Info, Flame, Sparkles, BarChart2, Clock, Activity, Filter
} from 'lucide-react';
import { AddressDisplay } from '../components/AddressDisplay';
import { PnlBadge } from '../components/PnlBadge';
import { useApi } from '../hooks/useApi';
import { discoverApi, walletsApi } from '../services/api';
import { clsx } from 'clsx';

const ALPHA_SOURCES = [
  { name: 'Birdeye Leaderboard', url: 'https://birdeye.so/leaderboard', desc: 'Top traders Solana par PnL réalisé. Filtre par 7j/30j.', tags: ['free', 'best'] },
  { name: 'Cielo Finance',       url: 'https://cielo.finance',           desc: 'Analytics avancés wallet, PnL par token, visualisation des trades.', tags: ['free', 'analytics'] },
  { name: 'Dexscreener',        url: 'https://dexscreener.com',         desc: 'Token qui a pumped → onglet Traders → copie les early buyers.', tags: ['free', 'onchain'] },
  { name: 'Gmgn.ai',            url: 'https://gmgn.ai',                 desc: 'Wallets avec 10x+ récents, classés par PnL réalisé.', tags: ['premium', 'alpha'] },
  { name: 'Photon Sol',         url: 'https://photon-sol.tinyastro.io', desc: 'Real-time DEX tracker, liste des top traders du moment.', tags: ['free', 'realtime'] },
  { name: 'Solscan',            url: 'https://solscan.io',              desc: 'Top holders d\'un token → voir qui a acheté tôt.', tags: ['free', 'research'] },
];

const STRATEGY_TIPS = [
  { title: 'Critères d\'un bon wallet', tips: ['Win rate > 60% sur 30+ trades', 'PnL réalisé > $50k/30j', 'Volume journalier > $10k', 'Actif dans les 24 dernières heures', 'Positions 0.5–5 SOL', 'Trade des tokens < $10M market cap'] },
  { title: 'Red flags à éviter', tips: ['Win rate gonflé par un seul trade', 'Volume élevé mais PnL faible', 'Inactif depuis > 24h', 'Achète principalement des rugs', 'Positions trop grosses (>10 SOL)', 'Score SOLSCRAPER < 50'] },
];

function TagBadge({ tag }: { tag: string }) {
  const map: Record<string, string> = { free: 'badge-green', premium: 'badge-yellow', best: 'badge-blue', analytics: 'badge-gray', onchain: 'badge-gray', research: 'badge-gray', realtime: 'badge-blue', alpha: 'badge-yellow' };
  return <span className={map[tag] ?? 'badge-gray'}>{tag}</span>;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 85 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : score >= 70 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
    : 'text-red-400 bg-red-500/10 border-red-500/20';
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border mono', color)}>
      {score}
    </span>
  );
}

function TierBadge({ tier }: { tier: 1 | 2 | 3 }) {
  const map: Record<number, { label: string; class: string }> = {
    1: { label: '5€', class: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    2: { label: '10€', class: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
    3: { label: '15€', class: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  };
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border', map[tier].class)}>
      P{tier} · {map[tier].label}
    </span>
  );
}

export default function WalletHunter() {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('7d');
  const [onlyPassing, setOnlyPassing] = useState(true);
  const [manualAddress, setManualAddress] = useState('');
  const [manualLabel, setManualLabel] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'discover' | 'sources' | 'strategy'>('discover');

  const { data: traders, loading, refetch } = useApi(
    () => discoverApi.topTraders({ timeframe, limit: '100', onlyPassingFilters: onlyPassing ? 'true' : 'false' } as Record<string, string>),
    [timeframe, onlyPassing]
  );

  type Trader = {
    address: string; pnlUsd: number; winRate: number; tradesCount: number;
    volumeUsd: number; lastActivityHours: number; score: number;
    tier: 1 | 2 | 3; tierLabel: string; isTracked: boolean; passesFilters: boolean;
  };
  const traderList = (traders as Trader[] | null) ?? [];

  async function handleAdd(address: string, label = '') {
    setAdding(address);
    try {
      await walletsApi.add(address, label, []);
      setAdded(s => new Set([...s, address]));
    } finally {
      setAdding(null);
    }
  }

  async function handleManualAdd() {
    if (!manualAddress || manualAddress.length < 32) return;
    await handleAdd(manualAddress, manualLabel);
    setManualAddress(''); setManualLabel('');
  }

  const passingCount  = traderList.filter(t => t.passesFilters).length;
  const totalCount    = traderList.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Search size={20} className="text-brand-400" />
          Wallet Hunter
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Trouve les wallets profitables — volume élevé, actifs &lt; 24h, score automatique</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {([
          { id: 'discover', label: 'Découvrir', icon: Flame },
          { id: 'sources',  label: 'Sources alpha', icon: Sparkles },
          { id: 'strategy', label: 'Stratégie', icon: BarChart2 },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === id ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white')}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ── Découvrir ─────────────────────────────────────────────────────────── */}
      {activeTab === 'discover' && (
        <div className="space-y-4">
          {/* Filters bar */}
          <div className="card flex flex-wrap gap-4 items-end">
            <div>
              <label className="label">Période</label>
              <div className="flex gap-1">
                {(['24h', '7d', '30d'] as const).map(tf => (
                  <button key={tf} onClick={() => setTimeframe(tf)}
                    className={clsx('px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                      timeframe === tf ? 'bg-brand-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white')}>
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={onlyPassing}
                onChange={e => setOnlyPassing(e.target.checked)}
                className="w-4 h-4 accent-teal-500" />
              <span className="text-sm text-gray-300">
                Filtrés uniquement <span className="text-gray-500">(volume &gt;$10k/j + actifs &lt;24h)</span>
              </span>
            </label>

            <button onClick={refetch} disabled={loading} className="btn-primary flex items-center gap-2 ml-auto">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Rafraîchir
            </button>

            {/* Manual add */}
            <div className="w-full flex gap-2 pt-2 border-t border-gray-800">
              <input value={manualAddress} onChange={e => setManualAddress(e.target.value)}
                placeholder="Adresse Solana manuelle..."
                className="input flex-1 font-mono text-xs" />
              <input value={manualLabel} onChange={e => setManualLabel(e.target.value)}
                placeholder="Label (ex: Whale #1)"
                className="input w-36" />
              <button onClick={handleManualAdd} disabled={!manualAddress || !!adding}
                className="btn-primary flex items-center gap-2 shrink-0">
                <Plus size={14} />Ajouter
              </button>
            </div>
          </div>

          {/* Summary */}
          {!loading && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500">{totalCount} wallets trouvés</span>
              {onlyPassing
                ? <span className="badge-green">{passingCount} passent les filtres</span>
                : <span className="text-gray-500">{passingCount} passent les filtres</span>}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="text-blue-400 font-bold">P1·5€</span> Score &lt;70</span>
            <span className="flex items-center gap-1"><span className="text-yellow-400 font-bold">P2·10€</span> Score 70–85</span>
            <span className="flex items-center gap-1"><span className="text-emerald-400 font-bold">P3·15€</span> Score &gt;85</span>
            <span className="text-gray-600">|</span>
            <span>Score = win rate + PnL + activité + volume</span>
          </div>

          {/* Table */}
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="table-head">#</th>
                  <th className="table-head">Wallet</th>
                  <th className="table-head text-right">PnL</th>
                  <th className="table-head text-right">Win%</th>
                  <th className="table-head text-right">Volume/j</th>
                  <th className="table-head text-center flex items-center gap-1 justify-center">
                    <Clock size={12} /> Activité
                  </th>
                  <th className="table-head text-center">Score</th>
                  <th className="table-head text-center">Palier</th>
                  <th className="table-head text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(8)].map((_, i) => (
                      <tr key={i} className="border-b border-gray-800">
                        {[...Array(9)].map((_, j) => (
                          <td key={j} className="table-cell"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  : traderList.length === 0
                  ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-500">
                        <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
                        <p>Aucun trader trouvé. Vérifie ta clé API Birdeye.</p>
                      </td></tr>
                    )
                  : traderList.map((t, idx) => {
                      const isAdded = added.has(t.address) || t.isTracked;
                      const isAdding = adding === t.address;
                      const actHours = t.lastActivityHours;
                      return (
                        <tr key={t.address} className={clsx('table-row', !t.passesFilters && 'opacity-40')}>
                          <td className="table-cell text-gray-600 mono text-xs">{idx + 1}</td>
                          <td className="table-cell">
                            <div className="flex items-center gap-2">
                              {t.passesFilters && <span className="pulse-dot bg-emerald-400 shrink-0" />}
                              <AddressDisplay address={t.address} />
                            </div>
                          </td>
                          <td className="table-cell text-right"><PnlBadge value={t.pnlUsd} /></td>
                          <td className="table-cell text-right">
                            <span className={clsx('mono text-sm font-medium', t.winRate >= 0.6 ? 'text-emerald-400' : t.winRate >= 0.4 ? 'text-yellow-400' : 'text-red-400')}>
                              {(t.winRate * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="table-cell text-right mono text-xs text-gray-400">
                            ${t.volumeUsd >= 1000 ? (t.volumeUsd / 1000).toFixed(0) + 'k' : t.volumeUsd?.toFixed(0)}
                          </td>
                          <td className="table-cell text-center">
                            <span className={clsx('text-xs font-mono', actHours <= 6 ? 'text-emerald-400' : actHours <= 24 ? 'text-yellow-400' : 'text-red-400')}>
                              {actHours === 999 ? '?' : actHours < 1 ? '<1h' : `${actHours}h`}
                            </span>
                          </td>
                          <td className="table-cell text-center"><ScoreBadge score={t.score} /></td>
                          <td className="table-cell text-center"><TierBadge tier={t.tier} /></td>
                          <td className="table-cell text-right">
                            {isAdded
                              ? <span className="badge-green">Suivi</span>
                              : (
                                <button onClick={() => handleAdd(t.address)} disabled={isAdding}
                                  className="flex items-center gap-1 px-3 py-1 text-xs bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 rounded-lg transition-colors disabled:opacity-50">
                                  <Plus size={12} />{isAdding ? '...' : 'Suivre'}
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

      {/* ── Sources alpha ──────────────────────────────────────────────────────── */}
      {activeTab === 'sources' && (
        <div className="space-y-4">
          <div className="card bg-blue-500/5 border-blue-500/20">
            <div className="flex items-start gap-3">
              <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-300">
                Copie une adresse depuis ces plateformes → colle dans l'onglet <strong>Découvrir → Adresse manuelle</strong>.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ALPHA_SOURCES.map(src => (
              <a key={src.name} href={src.url} target="_blank" rel="noopener noreferrer"
                className="card hover:border-gray-700 transition-all group cursor-pointer block">
                <div className="flex items-start justify-between mb-2">
                  <span className="font-semibold text-gray-200 group-hover:text-brand-400 transition-colors">{src.name}</span>
                  <ExternalLink size={14} className="text-gray-600 group-hover:text-brand-400 transition-colors shrink-0" />
                </div>
                <p className="text-sm text-gray-400 mb-3">{src.desc}</p>
                <div className="flex flex-wrap gap-1">{src.tags.map(tag => <TagBadge key={tag} tag={tag} />)}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Stratégie ──────────────────────────────────────────────────────────── */}
      {activeTab === 'strategy' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {STRATEGY_TIPS.map(section => (
            <div key={section.title} className="card">
              <h3 className="font-semibold text-gray-200 mb-4">{section.title}</h3>
              <ul className="space-y-2">
                {section.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={clsx('mt-0.5 shrink-0', section.title.includes('Red') ? 'text-red-400' : 'text-emerald-400')}>
                      {section.title.includes('Red') ? '✗' : '✓'}
                    </span>
                    <span className="text-gray-300">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="card md:col-span-2 border-brand-500/20 bg-brand-500/5">
            <h3 className="font-semibold text-brand-300 mb-3">Roadmap €100 → €10,000</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {[
                { phase: 'Phase 1', range: '€100–500', pos: '5€ (P1)', wallets: '2–3', color: 'text-blue-300' },
                { phase: 'Phase 2', range: '€500–2k', pos: '10€ (P2)', wallets: '3–5', color: 'text-yellow-300' },
                { phase: 'Phase 3', range: '€2k–10k+', pos: '15€ (P3)', wallets: '5–10', color: 'text-emerald-300' },
              ].map(p => (
                <div key={p.phase} className="bg-gray-800/50 rounded-lg p-3">
                  <div className={`font-bold mb-1 ${p.color}`}>{p.phase}</div>
                  <div className="text-gray-400 text-xs">{p.range}</div>
                  <div className="text-gray-300 text-xs mt-1">Position : {p.pos}</div>
                  <div className="text-gray-500 text-xs">{p.wallets} wallets</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
