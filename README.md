# SOLSCRAPER — Solana Copy Trading Platform

Plateforme complète de suivi de portefeuille et copy trading sur la blockchain Solana.

## Fonctionnalités

- **Wallet Hunter** — Découvrir les wallets les plus profitables via Birdeye leaderboard + guide complet des sources alpha
- **Live Tracker** — Suivi temps réel des transactions via Helius WebSocket
- **Copy Trade Engine** — Exécution automatique des trades via Jupiter Aggregator
- **Analytics Dashboard** — PnL, win rate, historique complet

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Backend | Node.js + TypeScript + Express |
| Frontend | React + Vite + TailwindCSS |
| Blockchain | @solana/web3.js |
| Swaps | Jupiter Aggregator v6 |
| Prix & Analytics | Birdeye API |
| Transactions | Helius Enhanced API |
| Base de données | SQLite (better-sqlite3) |

## Installation rapide

```bash
# 1. Clone & configure
cp .env.example .env
# → Édite .env avec tes clés API

# 2. Installe les dépendances
npm run install:all

# 3. Lance le projet
npm run dev
```

L'application sera disponible sur :
- Frontend: http://localhost:3000
- API: http://localhost:3001/api

## Clés API nécessaires

### Helius (REQUIS)
→ https://helius.dev — Inscription gratuite, 100 RPS  
Utilisé pour : RPC Solana, transactions enrichies, WebSocket temps réel

### Birdeye (REQUIS)
→ https://birdeye.so/developers — Tier gratuit disponible  
Utilisé pour : Prix des tokens, portfolio wallets, leaderboard top traders

### Jupiter (AUCUNE CLÉ)
→ Gratuit, sans clé API nécessaire  
Utilisé pour : Quotes de swap, exécution des trades

## Où trouver les meilleurs wallets à copier

| Source | URL | Description |
|--------|-----|-------------|
| Birdeye Leaderboard | birdeye.so/leaderboard | Top traders par PnL réalisé |
| Cielo Finance | cielo.finance | Analytics avancés wallet |
| Dexscreener | dexscreener.com | Early buyers de tokens qui ont pumped |
| Gmgn.ai | gmgn.ai | Classement wallets par 10x+ |
| Photon Sol | photon-sol.tinyastro.io | Real-time DEX avec top traders |

## Critères de sélection d'un wallet

- ✓ Win rate > 60% sur 30+ trades
- ✓ PnL réalisé > $50k/30j
- ✓ Positions 0.5–5 SOL (ni trop petit, ni trop gros)
- ✓ Actif depuis > 2 mois
- ✓ Trade des tokens < $10M market cap

## Configuration Copy Trade

Dans l'interface → **Copy Trade** → sélectionner un wallet → configurer :

```
Mode: FIXED ou PERCENT
Montant: 0.05–0.5 SOL (commence petit!)
Auto-Buy: ON
Auto-Sell: OFF (gérer manuellement au début)
Slippage: 300–500 bps
Liquidité min: $10,000
Stop Loss: 50%
Take Profit: 200%
```

## Stratégie $100 → $10,000

| Phase | Capital | Taille position | Wallets |
|-------|---------|-----------------|---------|
| 1 | $100–$500 | 0.05–0.1 SOL | 2–3 |
| 2 | $500–$2k | 0.2–0.5 SOL | 3–5 |
| 3 | $2k–$10k | 0.5–2 SOL | 5–10 |

**Règle d'or** : Ne risque jamais plus de 5% du capital par trade.

## Sécurité

⚠️ **Ne jamais partager ta clé privée**  
⚠️ **Commence avec un wallet de test avec peu de SOL**  
⚠️ **Le trading de crypto est risqué — tu peux perdre tout ton capital**

## Architecture

```
SOLSCRAPER/
├── backend/src/
│   ├── services/
│   │   ├── helius.ts      # RPC + parsing transactions
│   │   ├── birdeye.ts     # Prix + analytics + discovery
│   │   ├── jupiter.ts     # Swap execution
│   │   ├── walletTracker.ts  # WebSocket tracker
│   │   └── copyTrade.ts   # Copy trade engine
│   ├── routes/
│   │   ├── wallets.ts     # API wallets
│   │   └── trades.ts      # API trades
│   └── index.ts           # Express + WS server
└── frontend/src/
    ├── pages/
    │   ├── Dashboard.tsx
    │   ├── WalletHunter.tsx
    │   ├── Tracker.tsx
    │   ├── CopyTrade.tsx
    │   └── Analytics.tsx
    └── App.tsx
```
