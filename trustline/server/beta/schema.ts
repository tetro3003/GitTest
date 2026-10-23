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

    CREATE TABLE IF NOT EXISTS beta_identity (
      user_id TEXT PRIMARY KEY REFERENCES beta_users(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      report TEXT NOT NULL,
      verified_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS beta_shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
      lender_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS beta_decisions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
      lender_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
      officer TEXT NOT NULL,
      decision TEXT NOT NULL,
      amount_usd REAL,
      note TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      score INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS beta_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
      lender_id TEXT,
      at TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT
    );
    CREATE INDEX IF NOT EXISTS beta_audit_by_user ON beta_audit (user_id, id);

    CREATE TABLE IF NOT EXISTS beta_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES beta_users(id) ON DELETE CASCADE,
      at TEXT NOT NULL,
      score INTEGER,
      report TEXT NOT NULL
    );
  `);
  // Columns added after the first beta release.
  const addColumn = (table: string, column: string, type: string) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  };
  addColumn("beta_oauth_states", "verifier", "TEXT");
  addColumn("beta_work", "source", "TEXT NOT NULL DEFAULT 'figma'");
  addColumn("beta_payments", "source", "TEXT NOT NULL DEFAULT 'wallet'");
  addColumn("beta_users", "role", "TEXT NOT NULL DEFAULT 'freelancer'");
  addColumn("beta_users", "org", "TEXT");
}
