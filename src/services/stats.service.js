const { db } = require('../database');

function getPlayerStats(playerId) {
  const player = db.prepare(`
    SELECT
      id,
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
  `).get(playerId);

  if (!player) return null;

  const totalMatches = player.wins + player.losses + player.draws;

  const winRate = totalMatches > 0
    ? Number(((player.wins / totalMatches) * 100).toFixed(2))
    : 0;

  const scoreLogs = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN change > 0 THEN change ELSE 0 END), 0) AS total_gained,
      COALESCE(SUM(CASE WHEN change < 0 THEN ABS(change) ELSE 0 END), 0) AS total_lost,
      COALESCE(SUM(change), 0) AS net_change
    FROM score_logs
    WHERE player_id = ?
  `).get(player.id);

const lastMatch = db.prepare(`
    SELECT
      m.match_code,
      m.result,
      CASE
        WHEN m.winner_id = ? THEN 'WIN'
        WHEN m.loser_id = ? THEN 'LOSS'
        WHEN m.result = 'DRAW' THEN 'DRAW'
        ELSE 'UNKNOWN'
      END AS playerResult,
      m.winner_id,
      m.loser_id,
      m.verified_at
    FROM matches m
    WHERE m.player_a_id = ?
       OR m.player_b_id = ?
    ORDER BY COALESCE(m.verified_at, m.ended_at, m.created_at) DESC
    LIMIT 1
`).get(
    player.discord_id,
    player.discord_id,
    player.discord_id,
    player.discord_id
  );
  return {
    playerId: player.player_id,
    discordId: player.discord_id,
    displayName: player.display_name,
    score: player.score,

    matches: {
      total: totalMatches,
      scored: player.scored_matches,
      wins: player.wins,
      losses: player.losses,
      draws: player.draws,
      winRate
    },

    streak: {
      currentWins: player.win_streak,
      currentLosses: player.losing_streak
    },

    scoreChange: {
      totalGained: scoreLogs.total_gained,
      totalLost: scoreLogs.total_lost,
      netChange: scoreLogs.net_change
    },

    status: {
      comebackPending: Boolean(player.comeback_pending),
      revengeOpponentId: player.revenge_opponent_id,
      revengeExpiresAt: player.revenge_expires_at,
      failUntil: player.fail_until,
      restUntil: player.rest_until,
      suspensionUntil: player.suspension_until
    },

    lastMatch
  };
}

function getSeasonStats(playerId, seasonId) {
  const player = db.prepare(`
    SELECT
      player_id,
      discord_id
    FROM players
    WHERE player_id = ?
  `).get(playerId);

  if (!player) return null;

  const rows = db.prepare(`
    SELECT
      m.winner_id,
      m.loser_id,
      m.result
    FROM matches m
    WHERE m.season_id = ?
      AND m.status = 'VERIFIED'
      AND (m.player_a_id = ? OR m.player_b_id = ?)
  `).all(
    seasonId,
    player.discord_id,
    player.discord_id
  );

  const totalMatches = rows.length;

  const wins = rows.filter(
    match => match.winner_id === player.discord_id
  ).length;

  const losses = rows.filter(
    match => match.loser_id === player.discord_id
  ).length;

  const draws = rows.filter(
    match => match.result === 'DRAW'
  ).length;

  return {
    playerId: player.player_id,
    seasonId,
    totalMatches,
    wins,
    losses,
    draws,
    winRate: totalMatches > 0
      ? Number(((wins / totalMatches) * 100).toFixed(2))
      : 0
  };
}

module.exports = {
  getPlayerStats,
  getSeasonStats
};
