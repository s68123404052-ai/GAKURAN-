const Database = require('better-sqlite3');
const path = require('node:path');
const fs = require('node:fs');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'gakuran.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS seasons (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 season_number INTEGER NOT NULL UNIQUE,
 name TEXT NOT NULL,
 start_at INTEGER NOT NULL,
 end_at INTEGER,
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','CLOSED','LOCKED')),
 created_at INTEGER NOT NULL,
 closed_at INTEGER
);
CREATE TABLE IF NOT EXISTS players (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 player_id TEXT NOT NULL UNIQUE,
 discord_id TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL,
 score INTEGER NOT NULL DEFAULT 100 CHECK(score >= 50),
 wins INTEGER NOT NULL DEFAULT 0,
 losses INTEGER NOT NULL DEFAULT 0,
 draws INTEGER NOT NULL DEFAULT 0,
 scored_matches INTEGER NOT NULL DEFAULT 0,
 first_scored_match_at INTEGER,
 win_streak INTEGER NOT NULL DEFAULT 0,
 losing_streak INTEGER NOT NULL DEFAULT 0,
 comeback_pending INTEGER NOT NULL DEFAULT 0,
 comeback_loss_ids TEXT NOT NULL DEFAULT '[]',
 revenge_opponent_id TEXT,
 revenge_expires_at INTEGER,
 last_chance_progress INTEGER NOT NULL DEFAULT 0,
 last_chance_used INTEGER NOT NULL DEFAULT 0,
 fail_until INTEGER NOT NULL DEFAULT 0,
 rest_until INTEGER NOT NULL DEFAULT 0,
 suspension_until INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_code TEXT NOT NULL UNIQUE,
  season_id INTEGER NOT NULL,
  challenger_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','DECLINED','EXPIRED','CANCELLED')),
  decline_reason TEXT,
  reason TEXT,
  tier_id INTEGER,
  match_id INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  resolved_at INTEGER,
  FOREIGN KEY(season_id) REFERENCES seasons(id),
  FOREIGN KEY(challenger_id) REFERENCES players(player_id),
  FOREIGN KEY(target_id) REFERENCES players(player_id),
  FOREIGN KEY(match_id) REFERENCES matches(id)
);
CREATE INDEX IF NOT EXISTS idx_challenges_pending ON challenges(status, expires_at);
CREATE TABLE IF NOT EXISTS matches (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 match_code TEXT NOT NULL UNIQUE,
 season_id INTEGER NOT NULL,
 player_a_id TEXT NOT NULL,
 player_b_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('APPROVED','ACTIVE','SUBMITTED','UNDER_REVIEW','VERIFIED','NO_SCORE','CANCELLED')),
 match_type TEXT NOT NULL DEFAULT 'RANKED',
 score_a_before INTEGER,
 score_b_before INTEGER,
 score_a_after INTEGER,
 score_b_after INTEGER,
 class_a_before TEXT,
 class_b_before TEXT,
 winner_id TEXT,
 loser_id TEXT,
 result TEXT CHECK(result IN ('WIN','DRAW') OR result IS NULL),
 score_difference INTEGER,
 average_score INTEGER,
 base_winner INTEGER DEFAULT 0,
 base_loser INTEGER DEFAULT 0,
 winner_change INTEGER DEFAULT 0,
 loser_change INTEGER DEFAULT 0,
 modifier_type TEXT,
 no_score_reason TEXT,
 started_at INTEGER,
 ended_at INTEGER,
 verified_at INTEGER,
 verified_by TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 FOREIGN KEY(season_id) REFERENCES seasons(id)
);
CREATE INDEX IF NOT EXISTS idx_matches_players ON matches(player_a_id, player_b_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE TABLE IF NOT EXISTS match_evidence (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 match_id INTEGER NOT NULL,
 submitted_by TEXT NOT NULL,
 attachment_url TEXT NOT NULL,
 submitted_at INTEGER NOT NULL,
 FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_evidence_match ON match_evidence(match_id);
CREATE TABLE IF NOT EXISTS score_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 player_id TEXT NOT NULL,
 match_id INTEGER,
 before_score INTEGER NOT NULL,
 change INTEGER NOT NULL,
 after_score INTEGER NOT NULL CHECK(after_score >= 50),
 reason TEXT NOT NULL,
 source TEXT NOT NULL,
 admin_id TEXT,
 transaction_id TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 UNIQUE(transaction_id, player_id)
);
CREATE TABLE IF NOT EXISTS bonus_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 match_id INTEGER,
 player_id TEXT NOT NULL,
 bonus_type TEXT NOT NULL,
 amount INTEGER NOT NULL,
 priority INTEGER NOT NULL,
 selected INTEGER NOT NULL DEFAULT 0,
 reason TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS event_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(event_id, player_id, reward_type)
);

CREATE TABLE IF NOT EXISTS daily_stats (
 day_key TEXT NOT NULL,
 player_id TEXT NOT NULL,
 ranked_started INTEGER NOT NULL DEFAULT 0,
 scored_matches INTEGER NOT NULL DEFAULT 0,
 bounty_count INTEGER NOT NULL DEFAULT 0,
 bounty_points INTEGER NOT NULL DEFAULT 0,
 hot_bonus_claimed INTEGER NOT NULL DEFAULT 0,
 defender_bonus_claimed INTEGER NOT NULL DEFAULT 0,
 perfect_day_claimed INTEGER NOT NULL DEFAULT 0,
 daily_claimed INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day_key, player_id)
);
CREATE TABLE IF NOT EXISTS rival_series (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 season_id INTEGER NOT NULL,
 pair_key TEXT NOT NULL,
 player_a_id TEXT NOT NULL,
 player_b_id TEXT NOT NULL,
 wins_a INTEGER NOT NULL DEFAULT 0,
 wins_b INTEGER NOT NULL DEFAULT 0,
 days_played TEXT NOT NULL DEFAULT '[]',
 outside_opponents TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL DEFAULT 'ACTIVE',
 reward_paid INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 UNIQUE(season_id,pair_key)
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 actor_id TEXT,
 action TEXT NOT NULL,
 target_type TEXT NOT NULL,
 target_id TEXT NOT NULL,
 before_json TEXT,
 after_json TEXT,
 reason TEXT,
 transaction_id TEXT,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_confirmations (
 action_key TEXT PRIMARY KEY,
 actor_id TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 confirmed INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reward_codes (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 code TEXT NOT NULL UNIQUE,
 amount INTEGER NOT NULL CHECK(amount > 0),
 max_uses INTEGER NOT NULL CHECK(max_uses > 0),
 uses_count INTEGER NOT NULL DEFAULT 0 CHECK(uses_count >= 0),
 expires_at INTEGER,
 created_by TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1))
);

CREATE TABLE IF NOT EXISTS reward_code_uses (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 code_id INTEGER NOT NULL,
 player_id TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount > 0),
 created_at INTEGER NOT NULL,
 UNIQUE(code_id, player_id),
 FOREIGN KEY(code_id) REFERENCES reward_codes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reward_codes_code
 ON reward_codes(code);

CREATE INDEX IF NOT EXISTS idx_reward_code_uses_player
 ON reward_code_uses(player_id);
`);

function now() { return Math.floor(Date.now() / 1000); }
function txId(prefix='TX') { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`; }
function activeSeason() { return db.prepare("SELECT * FROM seasons WHERE status='ACTIVE' ORDER BY id DESC LIMIT 1").get(); }
function ensureSeason() {
  let s = activeSeason();
  if (!s) {
    const t = now();
    db.prepare('INSERT INTO seasons(season_number,name,start_at,status,created_at) VALUES(?,?,?,?,?)')
      .run(1, 'GAKURAN CLASS WAR — Season 1', t, 'ACTIVE', t);
    s = activeSeason();
  }
  return s;
}
ensureSeason();

module.exports = { db, now, txId, activeSeason, ensureSeason };
