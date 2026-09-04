const { db, now, txId } = require('../database');
const config = require('../config');

function classOf(score) {
  if (score >= 900) return 'CHAMPION';
  if (score >= 700) return 'ELITE';
  if (score >= 500) return 'EXECUTIVE';
  if (score >= 400) return 'PREFECT';
  if (score >= 300) return 'ELITE STUDENT';
  if (score >= 200) return 'STUDENT';
  if (score >= 100) return 'ROOKIE';
  return 'UNRANKED';
}
function baseTier(avg) {
  if (avg >= 800) return { winner:21, loser:19 };
  if (avg >= 600) return { winner:19, loser:17 };
  if (avg >= 400) return { winner:17, loser:15 };
  if (avg >= 200) return { winner:15, loser:13 };
  return { winner:13, loser:11 };
}
function calculate(scoreA, scoreB, allowSpecial=false) {
  const diff = Math.abs(scoreA-scoreB);
  const average = Math.floor((scoreA+scoreB)/2);
  const base = baseTier(average);
  if (diff > 150 && !allowSpecial) return { scored:false, reason:'SCORE_DIFFERENCE_OVER_150', diff, average, ...base };
  let winner = base.winner, loser = base.loser, modifier='FULL';
  if (diff > 150 && allowSpecial) modifier='ADMIN_SPECIAL_OVER_150';
  else if (diff >= 101) { winner -= 4; loser = Math.floor(loser*0.50); modifier='DIFF_101_150'; }
  else if (diff >= 51) { winner -= 2; loser = Math.floor(loser*0.75); modifier='DIFF_51_100'; }
  return { scored:true, diff, average, winner:Math.max(5,winner), loser:Math.min(20,loser), winnerBase:base.winner, loserBase:base.loser, modifier };
}
function clampScore(x) { return Math.max(config.minScore, Math.floor(x)); }
function seasonResetScore(oldScore) {
  if (oldScore < 100) return 50;
  return Math.min(400, Math.floor(100 + 0.4*(oldScore-100)));
}
function applyScore({matchId, winnerId, loserId, calc, adminId, bonusAmount=0, bonusType=null, reason='Ranked Match'}) {
  const m = db.prepare('SELECT * FROM matches WHERE id=?').get(matchId);
  if (!m) throw new Error('MATCH_NOT_FOUND');
  if (m.status === 'VERIFIED') throw new Error('MATCH_ALREADY_VERIFIED');
  if (m.status !== 'UNDER_REVIEW') throw new Error('MATCH_NOT_READY_FOR_SCORE');
  const a = db.prepare('SELECT * FROM players WHERE discord_id=?').get(m.player_a_id);
  const b = db.prepare('SELECT * FROM players WHERE discord_id=?').get(m.player_b_id);
  const winner = winnerId===a.discord_id ? a : b;
  const loser = winnerId===a.discord_id ? b : a;
  const loserLoss = loser.score <= config.minScore ? 0 : Math.min(calc.loser, loser.score-config.minScore);
  const winnerAfterBase = clampScore(winner.score + calc.winner);
  const winnerAfter = clampScore(winnerAfterBase + bonusAmount);
  const loserAfter = clampScore(loser.score - loserLoss);
  const winnerChange = winnerAfter - winner.score;
  const loserChange = loserAfter - loser.score;
  const transactionId = txId('SCORE');
  const t = now();
  const nextWinnerStreak = winner.win_streak + 1;
  const nextLoserStreak = loser.losing_streak + 1;
  const tx = db.transaction(() => {
    db.prepare(`UPDATE players SET score=?, wins=wins+1, scored_matches=scored_matches+1, win_streak=?, losing_streak=0, first_scored_match_at=COALESCE(first_scored_match_at,?), updated_at=? WHERE discord_id=?`)
      .run(winnerAfter,nextWinnerStreak,m.started_at||t,t,winner.discord_id);
    const fail = t + (loser.score < config.failThreshold ? config.failLowSeconds : config.failHighSeconds);
    const extraRest = nextLoserStreak >= 3 ? fail + config.extraRestSeconds : loser.rest_until;
    db.prepare(`UPDATE players SET score=?, losses=losses+1, scored_matches=scored_matches+1, win_streak=0, losing_streak=?, fail_until=?, rest_until=?, updated_at=? WHERE discord_id=?`)
      .run(loserAfter,nextLoserStreak,fail,Math.max(loser.rest_until,extraRest),t,loser.discord_id);
    db.prepare(`UPDATE matches SET status='VERIFIED', winner_id=?, loser_id=?, result='WIN', score_a_after=?, score_b_after=?, winner_change=?, loser_change=?, verified_at=?, verified_by=?, ended_at=COALESCE(ended_at,?), updated_at=? WHERE id=?`)
      .run(winnerId,loserId,
        m.player_a_id===winnerId?winnerAfter:loserAfter,
        m.player_a_id===winnerId?loserAfter:winnerAfter,
        winnerChange,loserChange,t,adminId,t,t,m.id);
    db.prepare(`INSERT INTO score_logs(player_id,match_id,before_score,change,after_score,reason,source,admin_id,transaction_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .run(winner.discord_id,m.id,winner.score,winnerChange,winnerAfter,reason,'RANKED_MATCH',adminId,transactionId,t);
    db.prepare(`INSERT INTO score_logs(player_id,match_id,before_score,change,after_score,reason,source,admin_id,transaction_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .run(loser.discord_id,m.id,loser.score,loserChange,loserAfter,`${reason} — Loss`,'RANKED_MATCH',adminId,transactionId,t);
    if (bonusType && bonusAmount>0) db.prepare('INSERT INTO bonus_logs(match_id,player_id,bonus_type,amount,priority,selected,reason,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(m.id,winner.discord_id,bonusType,bonusAmount,0,1,reason,t);
    db.prepare(`INSERT INTO audit_logs(actor_id,action,target_type,target_id,before_json,after_json,reason,transaction_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)`)
      .run(adminId,'VERIFY_MATCH','MATCH',m.match_code,JSON.stringify({winner:winner.score,loser:loser.score}),JSON.stringify({winner:winnerAfter,loser:loserAfter}),reason,transactionId,t);
  });
  tx();
  return { transactionId, winnerBefore:winner.score, winnerAfter, loserBefore:loser.score, loserAfter, winnerChange, loserChange, failUntil:t+(loser.score<config.failThreshold?config.failLowSeconds:config.failHighSeconds), extraRest:nextLoserStreak>=3 };
}

module.exports = { classOf, baseTier, calculate, seasonResetScore, applyScore, clampScore };
