import type Database from "better-sqlite3";

/** Tables for the designer beta. Lives in the same SQLite file as the demo, prefixed beta_. */
export function migrateBeta(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS beta_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS beta_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS beta_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL,
      secret TEXT,
      settings TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      last_sync_at TEXT,
      last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS beta_oauth_states (
      state TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS beta_wallet_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
      family TEXT NOT NULL,
      address TEXT NOT NULL,
      message TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS beta_work (
      user_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
      connection_id TEXT NOT NULL REFERENCES beta_connections(id) ON DELETE CASCADE,
      ext_id TEXT NOT NULL,
      at TEXT NOT NULL,
      kind TEXT NOT NULL,
      item TEXT NOT NULL,
      person TEXT,
      PRIMARY KEY (connection_id, ext_id)
    );

    CREATE TABLE IF NOT EXISTS beta_payments (
      user_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
      connection_id TEXT NOT NULL REFERENCES beta_connections(id) ON DELETE CASCADE,
      ext_id TEXT NOT NULL,
      at TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      asset TEXT NOT NULL,
      chain TEXT NOT NULL,
      payer TEXT NOT NULL,
      payer_label TEXT,
      status TEXT NOT NULL,
      note TEXT,
      proof TEXT NOT NULL,
      PRIMARY KEY (connection_id, ext_id)
    );

    CREATE TABLE IF NOT EXISTS beta_timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
      at TEXT NOT NULL,
      run_id TEXT NOT NULL,
      connection_id TEXT,
      actor TEXT NOT NULL,
      level TEXT NOT NULL,
      text TEXT NOT NULL,
      tech TEXT
    );
    CREATE INDEX IF NOT EXISTS beta_timeline_by_user ON beta_timeline (user_id, id);

    CREATE TABLE IF NOT EXISTS beta_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
      at TEXT NOT NULL,
      score INTEGER,
      report TEXT NOT NULL
    );
  `);
}
