const { db, now, txId } = require('../database');
const config = require('../config');

function clampScore(score) {
  const min = Number(config.minScore ?? 50);
  return Math.max(min, Math.floor(score));
}

function changeScore({
  playerId,
  amount,
  reason,
  adminId,
  source = 'ADMIN'
}) {
  const value = Number(amount);

  if (!Number.isInteger(value) || value === 0) {
    throw new Error('INVALID_SCORE_AMOUNT');
  }

  if (!reason || !String(reason).trim()) {
    throw new Error('REASON_REQUIRED');
  }

  const player = db.prepare(
    'SELECT * FROM players WHERE discord_id = ?'
  ).get(playerId);

  if (!player) {
    throw new Error('PLAYER_NOT_FOUND');
  }

  const before = player.score;
  const after = clampScore(before + value);
  const change = after - before;

  if (change === 0) {
    throw new Error('SCORE_NO_CHANGE');
  }

  const transactionId = txId('ADMIN_SCORE');
  const timestamp = now();

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE players
      SET score = ?
      WHERE discord_id = ?
    `).run(after, playerId);

    db.prepare(`
      INSERT INTO score_logs
      (player_id, match_id, before_score, change, after_score,
       reason, source, admin_id, transaction_id, created_at)
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      playerId,
      before,
      change,
      after,
      String(reason).trim(),
      source,
      adminId,
      transactionId,
      timestamp
    );

    db.prepare(`
      INSERT INTO audit_logs
      (actor_id, action, target_type, target_id,
       before_json, after_json, reason, transaction_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      adminId,
      'ADMIN_SCORE_CHANGE',
      'PLAYER',
      playerId,
      JSON.stringify({ score: before }),
      JSON.stringify({ score: after }),
      String(reason).trim(),
      transactionId,
      timestamp
    );
  });

  transaction();

  return {
    playerId,
    displayName: player.display_name,
    before,
    change,
    after,
    transactionId,
    reason: String(reason).trim()
  };
}

function setScore({
  playerId,
  score,
  reason,
  adminId,
  source = 'ADMIN'
}) {
  const targetScore = Number(score);

  if (!Number.isInteger(targetScore)) {
    throw new Error('INVALID_SCORE_AMOUNT');
  }

  if (!reason || !String(reason).trim()) {
    throw new Error('REASON_REQUIRED');
  }

  const player = db.prepare(
    'SELECT * FROM players WHERE discord_id = ?'
  ).get(playerId);

  if (!player) {
    throw new Error('PLAYER_NOT_FOUND');
  }

  const before = player.score;
  const after = clampScore(targetScore);
  const change = after - before;

  if (change === 0) {
    throw new Error('SCORE_NO_CHANGE');
  }

  const transactionId = txId('ADMIN_SCORE');
  const timestamp = now();

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE players
      SET score = ?
      WHERE discord_id = ?
    `).run(after, playerId);

    db.prepare(`
      INSERT INTO score_logs
      (player_id, match_id, before_score, change, after_score,
       reason, source, admin_id, transaction_id, created_at)
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      playerId,
      before,
      change,
      after,
      String(reason).trim(),
      source,
      adminId,
      transactionId,
      timestamp
    );

    db.prepare(`
      INSERT INTO audit_logs
      (actor_id, action, target_type, target_id,
       before_json, after_json, reason, transaction_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      adminId,
      'ADMIN_SCORE_SET',
      'PLAYER',
      playerId,
      JSON.stringify({ score: before }),
      JSON.stringify({ score: after }),
      String(reason).trim(),
      transactionId,
      timestamp
    );
  });

  transaction();

  return {
    playerId,
    displayName: player.display_name,
    before,
    change,
    after,
    transactionId,
    reason: String(reason).trim()
  };
}

module.exports = {
  changeScore,
  setScore
};
