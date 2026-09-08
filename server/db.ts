/**
 * server/db.ts
 *
 * Real persistence using the SQLite engine built into Node (`node:sqlite`).
 * No native compilation, no network, no in-memory fakery: rows written here
 * survive a restart and can be inspected with any SQLite client.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export interface VerifiedBlockRow {
  id: number;
  header: string;
  nonce: number;
  difficulty: number;
  hash: string;
  leading_zeros: number;
  node_id: string;
  attempts: number;
  elapsed_ms: number;
  hashrate: number;
  verified_at: string;
}

export interface ZkpRow {
  id: number;
  label: string;
  y: string;
  valid: number;
  reason: string | null;
  verified_at: string;
  elapsed_ms: number;
}

export interface PitchRow {
  id: string;
  target: string;
  pitch: string;
  model: string | null;
  created_at: string;
}

const DATA_DIR = process.env.GAIA_DATA_DIR || path.join(process.cwd(), 'data');
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.GAIA_DB_PATH || path.join(DATA_DIR, 'gaia.db');

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS verified_work (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    header        TEXT    NOT NULL,
    nonce         INTEGER NOT NULL,
    difficulty    INTEGER NOT NULL,
    hash          TEXT    NOT NULL,
    leading_zeros INTEGER NOT NULL,
    node_id       TEXT    NOT NULL,
    attempts      INTEGER NOT NULL DEFAULT 0,
    elapsed_ms    INTEGER NOT NULL DEFAULT 0,
    hashrate      INTEGER NOT NULL DEFAULT 0,
    verified_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (header, nonce)
  );

  CREATE INDEX IF NOT EXISTS idx_work_node ON verified_work(node_id);
  CREATE INDEX IF NOT EXISTS idx_work_time ON verified_work(verified_at);

  CREATE TABLE IF NOT EXISTS zkp_verifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    label       TEXT    NOT NULL,
    y           TEXT    NOT NULL,
    valid       INTEGER NOT NULL,
    reason      TEXT,
    elapsed_ms  INTEGER NOT NULL DEFAULT 0,
    verified_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS node_history (
    node_id      TEXT PRIMARY KEY,
    first_seen   TEXT NOT NULL,
    last_seen    TEXT NOT NULL,
    heartbeats   INTEGER NOT NULL DEFAULT 1,
    blocks       INTEGER NOT NULL DEFAULT 0,
    user_agent   TEXT
  );

  CREATE TABLE IF NOT EXISTS pitches (
    id         TEXT PRIMARY KEY,
    target     TEXT NOT NULL,
    pitch      TEXT NOT NULL,
    model      TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS request_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    method     TEXT NOT NULL,
    route      TEXT NOT NULL,
    status     INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL
  );
`);

export const queries = {
  insertVerifiedWork: db.prepare(`
    INSERT INTO verified_work (header, nonce, difficulty, hash, leading_zeros, node_id, attempts, elapsed_ms, hashrate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  ledgerStats: db.prepare(`
    SELECT COUNT(*) AS blocks,
           COALESCE(SUM(attempts), 0) AS attempts,
           COALESCE(MAX(difficulty), 0) AS max_difficulty,
           COUNT(DISTINCT node_id) AS contributors
    FROM verified_work
  `),
  recentWork: db.prepare(`
    SELECT * FROM verified_work ORDER BY id DESC LIMIT ?
  `),
  allWorkHashes: db.prepare(`SELECT hash FROM verified_work ORDER BY id ASC`),
  recordZkp: db.prepare(`
    INSERT INTO zkp_verifications (label, y, valid, reason, elapsed_ms) VALUES (?, ?, ?, ?, ?)
  `),
  zkpStats: db.prepare(`
    SELECT COUNT(*) AS total, COALESCE(SUM(valid), 0) AS valid FROM zkp_verifications
  `),
  recentZkp: db.prepare(`SELECT * FROM zkp_verifications ORDER BY id DESC LIMIT ?`),
  upsertNode: db.prepare(`
    INSERT INTO node_history (node_id, first_seen, last_seen, heartbeats, user_agent)
    VALUES (?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'), 1, ?)
    ON CONFLICT(node_id) DO UPDATE SET
      last_seen = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
      heartbeats = heartbeats + 1,
      user_agent = excluded.user_agent
  `),
  creditNodeBlock: db.prepare(`UPDATE node_history SET blocks = blocks + 1 WHERE node_id = ?`),
  nodeHistoryCount: db.prepare(`SELECT COUNT(*) AS total FROM node_history`),
  insertPitch: db.prepare(`INSERT INTO pitches (id, target, pitch, model) VALUES (?, ?, ?, ?)`),
  recentPitches: db.prepare(`SELECT * FROM pitches ORDER BY created_at DESC LIMIT ?`),
  logRequest: db.prepare(`INSERT INTO request_log (method, route, status, duration_ms) VALUES (?, ?, ?, ?)`),
  pruneRequestLog: db.prepare(`DELETE FROM request_log WHERE id NOT IN (SELECT id FROM request_log ORDER BY id DESC LIMIT 2000)`),
  requestStats: db.prepare(`SELECT COUNT(*) AS served FROM request_log`),
};

export const DB_INFO = { path: DB_PATH, engine: 'node:sqlite (SQLite 3, built into Node.js)' };
