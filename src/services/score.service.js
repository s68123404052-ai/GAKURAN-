const { db, now, txId } = require('../database');
const config = require('../config');

function class0f(score) {
  if (score >= 2000) return 'GODLIKE';
  if (score >= 1900) return 'GOD';
  if (score >= 1800) return 'LEGENDARY';
  if (score >= 1700) return 'LEGEND';
  if (score >= 1600) return 'MYTHIC';
  if (score >= 1500) return 'EMPEROR';
  if (score >= 1400) return 'ASCENDANT';
  if (score >= 1300) return 'SUPREME';
  if (score >= 1200) return 'IMMORTAL';
  if (score >= 1100) return 'OVERLORD';
  if (score >= 1000) return 'GRAND CHAMPION';
  if (score >= 900) return 'CHAMPION';
  if (score >= 800) return 'MASTER';
  if (score >= 700) return 'ELITE';
  if (score >= 600) return 'VETERAN';
  if (score >= 500) return 'EXECUTIVE';
  if (score >= 400) return 'PREFECT';
  if (score >= 300) return 'ELITE STUDENT';
  if (score >= 200) return 'STUDENT';
  if (score >= 100) return 'ROOKIE';
  return 'UNRANKED';
}

function baseTier(avg) {
  if (avg >= 800) return { winner: 21, loser: 19 };
  if (avg >= 600) return { winner: 19, loser: 17 };
  if (avg >= 400) return { winner: 17, loser: 15 };
  if (avg >= 200) return { winner: 15, loser: 13 };
  return { winner: 13, loser: 11 };
}

function calculate(scoreA, scoreB, allowSpecial = false) {
  const diff = Math.abs(scoreA - scoreB);
  const average = Math.floor((scoreA + scoreB) / 2);
  const base = baseTier(average);

  if (diff > 150 && !allowSpecial) {
    return {
      scored: false,
      reason: 'SCORE_DIFFERENCE_OVER_150',
      diff,
      average,
      ...base
    };
  }

  let winner = base.winner;
  let loser = base.loser;
  let modifier = 'FULL';

  if (diff > 150 && allowSpecial) {
    modifier = 'ADMIN_SPECIAL_OVER_150';
  } else if (diff >= 101) {
    winner -= 4;
    loser = Math.floor(loser * 0.5);
    modifier = 'DIFF_101_150';
  } else if (diff >= 51) {
    winner -= 2;
    loser = Math.floor(loser * 0.75);
    modifier = 'DIFF_51_100';
  }

  return {
    scored: true,
    diff,
    average,
    winner: Math.max(5, winner),
    loser: Math.min(20, loser),
    winnerBase: base.winner,
    loserBase: base.loser,
    modifier
  };
}

function clampScore(score) {
  const min = Number(config.minScore ?? 50);
  return Math.max(min, Math.floor(score));
}

function seasonResetScore(oldScore) {
  return Math.max(50, Math.floor(100 + (oldScore - 100) * 0.4));
}

function applyScore({
  matchId,
  winnerId,
  loserId,
  allowSpecial = false,
  bonusAmount = 0,
  bonusType = null,
  adminId = null
}) {
  const match = db.prepare(
    'SELECT * FROM matches WHERE id = ?'
  ).get(matchId);

  if (!match) throw new Error('MATCH_NOT_FOUND');
  if (match.status === 'VERIFIED') {
    throw new Error('MATCH_ALREADY_VERIFIED');
  }

  const playerA = db.prepare(
    'SELECT * FROM players WHERE discord_id = ?'
  ).get(match.player_a_id);

  const playerB = db.prepare(
    'SELECT * FROM players WHERE discord_id = ?'
  ).get(match.player_b_id);

  if (!playerA || !playerB) {
    throw new Error('PLAYER_NOT_FOUND');
  }

  if (![playerA.discord_id, playerB.discord_id].includes(winnerId)) {
    throw new Error('WINNER_NOT_IN_MATCH');
  }

  if (![playerA.discord_id, playerB.discord_id].includes(loserId)) {
    throw new Error('LOSER_NOT_IN_MATCH');
  }

  const winner = winnerId === playerA.discord_id ? playerA : playerB;
  const loser = loserId === playerA.discord_id ? playerA : playerB;

  const calc = calculate(winner.score, loser.score, allowSpecial);

  if (!calc.scored) {
    return {
      scored: false,
      reason: calc.reason,
      diff: calc.diff
    };
  }

  const winnerGain = calc.winner + Number(bonusAmount || 0);
  const loserLoss = Math.min(
    calc.loser,
    Math.max(0, loser.score - Number(config.minScore ?? 50))
  );

  const winnerAfter = clampScore(winner.score + winnerGain);
  const loserAfter = clampScore(loser.score - loserLoss);

  const winnerChange = winnerAfter - winner.score;
  const loserChange = loserAfter - loser.score;

  const transactionId = txId('SCORE');
  const timestamp = now();

  const winnerStreak = (winner.win_streak || 0) + 1;
  const loserStreak = (loser.losing_streak || 0) + 1;

  const failSeconds = loser.score <
    Number(config.failThreshold ?? 100)
      ? Number(config.failLowSeconds ?? 1800)
      : Number(config.failHighSeconds ?? 1800);

  const failUntil = timestamp + failSeconds;

  const extraRest = loserStreak >= 3
    ? Number(config.extraRestSeconds ?? 0)
    : 0;

  const restUntil = Math.max(
    Number(loser.rest_until || 0),
    failUntil + extraRest
  );

  let comebackLossIds = [];
  try {
    comebackLossIds = JSON.parse(loser.comeback_loss_ids || '[]');
  } catch {
    comebackLossIds = [];
  }

  comebackLossIds.push(winner.discord_id);
  comebackLossIds = comebackLossIds.slice(-3);

  const comebackPending =
    loserStreak === 3
      ? 1
      : loser.comeback_pending;

  const scoreAAfter = winner.discord_id === match.player_a_id
      ? winnerAfter
      : loserAfter;

    const scoreBAfter = winner.discord_id === match.player_b_id
      ? winnerAfter
      : loserAfter;

    const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE players
      SET score = ?,
          wins = wins + 1,
          scored_matches = scored_matches + 1,
          win_streak = ?,
          losing_streak = 0,
          comeback_pending = CASE WHEN ? = 'COMEBACK' THEN 0 ELSE comeback_pending END,
          comeback_loss_ids = CASE WHEN ? = 'COMEBACK' THEN '[]' ELSE comeback_loss_ids END,
          revenge_opponent_id = CASE WHEN ? = 'REVENGE' THEN NULL ELSE revenge_opponent_id END,
          revenge_expires_at = CASE WHEN ? = 'REVENGE' THEN NULL ELSE revenge_expires_at END,
          updated_at = ?
      WHERE discord_id = ?
    `).run(
      winnerAfter,
      winnerStreak,
      bonusType || null,
      bonusType || null,
      bonusType || null,
      bonusType || null,
      timestamp,
      winner.discord_id
    );

    db.prepare(`
      UPDATE players
      SET score = ?,
          losses = losses + 1,
          scored_matches = scored_matches + 1,
          win_streak = 0,
          losing_streak = ?,
          comeback_pending = ?,
          comeback_loss_ids = ?,
          revenge_opponent_id = ?,
          revenge_expires_at = ?,
          fail_until = ?,
          rest_until = ?,
          updated_at = ?
      WHERE discord_id = ?
    `).run(
      loserAfter,
      loserStreak,
      comebackPending,
      JSON.stringify(comebackLossIds),
      winner.discord_id,
      timestamp + 86400,
      failUntil,
      restUntil,
      timestamp,
      loser.discord_id
    );

    db.prepare(`
      UPDATE matches
      SET status = 'VERIFIED',
          winner_id = ?,
          loser_id = ?,
          result = 'WIN',
          score_difference = ?,
          average_score = ?,
          base_winner = ?,
          base_loser = ?,
          winner_change = ?,
          loser_change = ?,
          score_a_after = ?,
          score_b_after = ?,
          modifier_type = ?,
          verified_by = ?,
          verified_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      winner.discord_id,
      loser.discord_id,
      calc.diff,
      calc.average,
      calc.winnerBase,
      calc.loserBase,
      winnerChange,
      loserChange,
      scoreAAfter,
      scoreBAfter,
      calc.modifier,
      adminId,
      timestamp,
      timestamp,
      matchId
    );

    db.prepare(`
      INSERT INTO score_logs
      (player_id, match_id, before_score, change, after_score,
       reason, source, admin_id, transaction_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      winner.id,
      matchId,
      winner.score,
      winnerChange,
      winnerAfter,
      'MATCH_WIN',
      'MATCH',
      adminId,
      transactionId,
      timestamp
    );

    db.prepare(`
      INSERT INTO score_logs
      (player_id, match_id, before_score, change, after_score,
       reason, source, admin_id, transaction_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      loser.id,
      matchId,
      loser.score,
      loserChange,
      loserAfter,
      'MATCH_LOSS',
      'MATCH',
      adminId,
      transactionId,
      timestamp
    );
  });

  transaction();

  return {
    scored: true,
    winnerId: winner.discord_id,
    loserId: loser.discord_id,
    winnerBefore: winner.score,
    winnerAfter,
    winnerChange,
    loserBefore: loser.score,
    loserAfter,
    loserChange,
    winnerClass: class0f(winnerAfter),
    loserClass: class0f(loserAfter),
    modifier: calc.modifier,
    transactionId,
    failUntil,
    restUntil
  };
}

module.exports = {
  class0f,
  baseTier,
  calculate,
  seasonResetScore,
  applyScore,
  clampScore
};
