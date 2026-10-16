import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Opens (and if needed creates) the SQLite database.
 * Location: TRUSTLINE_DB_PATH, else ./data/trustline.db (on Vercel: /tmp, which is temporary).
 */
export function defaultDbPath(): string {
  if (process.env.TRUSTLINE_DB_PATH) return process.env.TRUSTLINE_DB_PATH;
  if (process.env.VERCEL) return "/tmp/trustline.db";
  return join(process.cwd(), "data", "trustline.db");
}

export const SCHEMA_VERSION = 1;

export function openDatabase(path = defaultDbPath()): Database.Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

    CREATE TABLE IF NOT EXISTS borrowers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      work_type TEXT NOT NULL,
      kyc_status TEXT NOT NULL,
      application_status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS source_states (
      borrower_id TEXT NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
      source_id TEXT NOT NULL,
      status TEXT NOT NULL,
      connected_at TEXT,
      PRIMARY KEY (borrower_id, source_id)
    );

    CREATE TABLE IF NOT EXISTS custom_sources (
      id TEXT PRIMARY KEY,
      borrower_id TEXT NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS work_item_choices (
      borrower_id TEXT NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
      shared INTEGER NOT NULL,
      PRIMARY KEY (borrower_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS lesson_recordings (
      id TEXT PRIMARY KEY,
      borrower_id TEXT NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
      source_id TEXT NOT NULL,
      name TEXT NOT NULL,
      recorded_minutes REAL NOT NULL,
      speech_minutes REAL NOT NULL,
      shared INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evidence_feeds (
      borrower_id TEXT NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
      source_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      label TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (borrower_id, source_id)
    );

    CREATE TABLE IF NOT EXISTS work_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      borrower_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      at TEXT NOT NULL,
      minutes REAL NOT NULL,
      kind TEXT NOT NULL,
      units REAL,
      client TEXT,
      amount REAL,
      km REAL,
      item TEXT,
      FOREIGN KEY (borrower_id, source_id) REFERENCES evidence_feeds(borrower_id, source_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS work_events_by_source ON work_events (borrower_id, source_id, at);

    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      borrower_id TEXT NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
      lender_id TEXT NOT NULL,
      lender_name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      scope TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      key_hash TEXT PRIMARY KEY,
      lender_id TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ingest_keys (
      key TEXT PRIMARY KEY,
      borrower_id TEXT NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
      source_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (borrower_id, source_id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      borrower_id TEXT,
      detail TEXT
    );
    CREATE INDEX IF NOT EXISTS audit_by_borrower ON audit_log (borrower_id, id);
  `);
  db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', ?)").run(String(SCHEMA_VERSION));
  return db;
}
