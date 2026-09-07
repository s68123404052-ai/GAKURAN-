const { db } = require('../database');

function getMatchHistory(playerId, limit = 20, offset = 0) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const player = db.prepare(`
    SELECT discord_id
    FROM players
    WHERE player_id = ?
  `).get(playerId);

  if (!player) return [];

  return db.prepare(`
    SELECT
      m.id,
      m.match_code,
      m.season_id,
      m.player_a_id,
      m.player_b_id,
      m.status,
      m.result,
      m.winner_id,
      m.loser_id,
      m.score_a_before,
      m.score_b_before,
      m.score_a_after,
      m.score_b_after,
      m.winner_change,
      m.loser_change,
      m.modifier_type,
      m.ended_at,
      m.verified_at,
      CASE
        WHEN m.winner_id = ? THEN 'WIN'
        WHEN m.loser_id = ? THEN 'LOSS'
        WHEN m.result = 'DRAW' THEN 'DRAW'
        ELSE 'UNKNOWN'
      END AS player_result
    FROM matches m
    WHERE m.player_a_id = ?
       OR m.player_b_id = ?
    ORDER BY COALESCE(m.verified_at, m.ended_at, m.created_at) DESC
    LIMIT ? OFFSET ?
  `).all(
    player.discord_id,
    player.discord_id,
    player.discord_id,
    player.discord_id,
    safeLimit,
    safeOffset
  );
}

function getScoreHistory(playerId, limit = 20, offset = 0) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const player = db.prepare(`
    SELECT id
    FROM players
    WHERE player_id = ?
  `).get(playerId);

  if (!player) return [];

  return db.prepare(`
    SELECT
      sl.*,
      m.match_code
    FROM score_logs sl
    LEFT JOIN matches m ON m.id = sl.match_id
    WHERE sl.player_id = ?
    ORDER BY sl.created_at DESC, sl.id DESC
    LIMIT ? OFFSET ?
  `).all(
    player.id,
    safeLimit,
    safeOffset
  );
}

function getMatchDetails(matchCode) {
  const match = db.prepare(`
    SELECT *
    FROM matches
    WHERE match_code = ?
  `).get(matchCode);

  if (!match) return null;

  const evidence = db.prepare(`
    SELECT *
    FROM match_evidence
    WHERE match_id = ?
    ORDER BY id
  `).all(match.id);

  const scores = db.prepare(`
    SELECT
      sl.*,
      p.player_id,
      p.display_name
    FROM score_logs sl
    LEFT JOIN players p ON p.id = sl.player_id
    WHERE sl.match_id = ?
    ORDER BY sl.id
  `).all(match.id);

  const bonuses = db.prepare(`
    SELECT *
    FROM bonus_logs
    WHERE match_id = ?
    ORDER BY id
  `).all(match.id);

  return {
    match,
    evidence,
    scores,
    bonuses
  };
}

function getPlayerStats(playerId) {
  return db.prepare(`
    SELECT
      player_id,
      discord_id,
      display_name,
      score,
      wins,
      losses,
      draws,
      scored_matches,
      win_streak,
      losing_streak,
      comeback_pending,
      revenge_opponent_id,
      revenge_expires_at,
      fail_until,
      rest_until,
      suspension_until,
      created_at,
      updated_at
    FROM players
    WHERE player_id = ?
  `).get(playerId) || null;
}

module.exports = {
  getMatchHistory,
  getScoreHistory,
  getMatchDetails,
  getPlayerStats
};
