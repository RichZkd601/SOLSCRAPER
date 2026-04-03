import Database, { Database as BetterSqlite3Database } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

// Ensure data directory exists
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db: BetterSqlite3Database = new Database(config.dbPath);

// Performance tuning
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

export function initDb(): void {
  db.exec(`
    -- ── Tracked Wallets ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS tracked_wallets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      address     TEXT UNIQUE NOT NULL,
      label       TEXT NOT NULL DEFAULT '',
      tags        TEXT NOT NULL DEFAULT '[]',
      total_pnl_usd   REAL NOT NULL DEFAULT 0,
      win_rate    REAL NOT NULL DEFAULT 0,
      trades_count INTEGER NOT NULL DEFAULT 0,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Parsed Transactions ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS transactions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      signature     TEXT UNIQUE NOT NULL,
      wallet_address TEXT NOT NULL,
      type          TEXT NOT NULL CHECK(type IN ('BUY','SELL','TRANSFER','UNKNOWN')),
      token_mint    TEXT NOT NULL DEFAULT '',
      token_symbol  TEXT NOT NULL DEFAULT '',
      token_name    TEXT NOT NULL DEFAULT '',
      amount_token  REAL NOT NULL DEFAULT 0,
      amount_sol    REAL NOT NULL DEFAULT 0,
      amount_usd    REAL NOT NULL DEFAULT 0,
      price_usd     REAL NOT NULL DEFAULT 0,
      dex           TEXT NOT NULL DEFAULT '',
      block_time    INTEGER NOT NULL,
      fee           REAL NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_txs_wallet ON transactions(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_txs_token  ON transactions(token_mint);
    CREATE INDEX IF NOT EXISTS idx_txs_time   ON transactions(block_time DESC);

    -- ── Copy Trade Configs ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS copy_trade_configs (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address      TEXT UNIQUE NOT NULL,
      is_enabled          INTEGER NOT NULL DEFAULT 1,
      copy_mode           TEXT NOT NULL DEFAULT 'FIXED' CHECK(copy_mode IN ('FIXED','PERCENT')),
      fixed_amount_sol    REAL NOT NULL DEFAULT 0.1,
      percent_of_portfolio REAL NOT NULL DEFAULT 10,
      max_position_sol    REAL NOT NULL DEFAULT 1.0,
      min_liquidity_usd   REAL NOT NULL DEFAULT 10000,
      max_slippage_bps    INTEGER NOT NULL DEFAULT 300,
      auto_buy            INTEGER NOT NULL DEFAULT 0,
      auto_sell           INTEGER NOT NULL DEFAULT 0,
      stop_loss_percent   REAL NOT NULL DEFAULT 50,
      take_profit_percent REAL NOT NULL DEFAULT 200,
      skip_if_mcap_above  REAL NOT NULL DEFAULT 0,
      created_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Copy Trade History ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS copy_trades (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      config_id       INTEGER NOT NULL REFERENCES copy_trade_configs(id),
      tracked_wallet  TEXT NOT NULL,
      signature       TEXT NOT NULL,
      our_signature   TEXT,
      token_mint      TEXT NOT NULL,
      token_symbol    TEXT NOT NULL DEFAULT '',
      type            TEXT NOT NULL CHECK(type IN ('BUY','SELL','TRANSFER','UNKNOWN')),
      amount_sol      REAL NOT NULL DEFAULT 0,
      amount_token    REAL NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','EXECUTING','SUCCESS','FAILED','SKIPPED')),
      error_msg       TEXT,
      pnl_usd         REAL,
      executed_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ct_wallet ON copy_trades(tracked_wallet);
    CREATE INDEX IF NOT EXISTS idx_ct_status ON copy_trades(status);

    -- ── Alerts ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS alerts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT NOT NULL,
      token_mint    TEXT NOT NULL DEFAULT '',
      token_symbol  TEXT NOT NULL DEFAULT '',
      type          TEXT NOT NULL,
      amount_usd    REAL NOT NULL DEFAULT 0,
      message       TEXT NOT NULL,
      is_read       INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Token Cache ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS token_cache (
      mint          TEXT PRIMARY KEY,
      symbol        TEXT NOT NULL DEFAULT '',
      name          TEXT NOT NULL DEFAULT '',
      decimals      INTEGER NOT NULL DEFAULT 9,
      logo_uri      TEXT,
      price_usd     REAL,
      market_cap    REAL,
      volume_24h    REAL,
      price_change_24h REAL,
      liquidity     REAL,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  console.log('[DB] Database initialized');
}
