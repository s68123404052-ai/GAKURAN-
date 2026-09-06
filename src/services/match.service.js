const { db, now, txId } = require('../database');
const config = require('../config');
const score = require('./score.service');
const challenge = require('./challenge.service');

function get(code) {
  return db.prepare(
    'SELECT * FROM matches WHERE match_code=?'
  ).get(code);
}

function start(code, actorId) {
  const m = get(code);
  if (!m) throw new Error('MATCH_NOT_FOUND');
  if (m.status !== 'APPROVED') {
    throw new Error('MATCH_NOT_APPROVED');
  }

  const t = now();

  if (t - m.created_at > 5 * 60) {
    throw new Error('MATCH_START_WINDOW_EXPIRED');
  }

  const a = challenge.getPlayer(m.player_a_id);
  const b = challenge.getPlayer(m.player_b_id);

  if (!a || !b) {
    throw new Error('PLAYER_NOT_FOUND');
  }

  db.prepare(`
    UPDATE matches
    SET status='ACTIVE',
        started_at=?,
        updated_at=?
    WHERE id=? AND status='APPROVED'
  `).run(t, t, m.id);

  return get(code);
}

function submitEvidence(code, submittedBy, attachmentUrl) {
  const m = get(code);
  if (!m) throw new Error('MATCH_NOT_FOUND');

  if (!['ACTIVE', 'SUBMITTED', 'UNDER_REVIEW'].includes(m.status)) {
    throw new Error('MATCH_NOT_ACCEPTING_EVIDENCE');
  }

  if (!attachmentUrl || !/^https?:\/\//i.test(attachmentUrl)) {
    throw new Error('INVALID_EVIDENCE_URL');
  }

  const t = now();

  const timeout = Number(
    config.evidenceTimeoutSeconds ?? 3600
  );

  if (m.started_at && t - m.started_at > timeout) {
    throw new Error('EVIDENCE_TIMEOUT');
  }

  if (![m.player_a_id, m.player_b_id].includes(submittedBy)) {
    throw new Error('NOT_MATCH_PLAYER');
  }

  db.prepare(`
    INSERT INTO match_evidence
    (match_id, submitted_by, attachment_url, submitted_at)
    VALUES (?, ?, ?, ?)
  `).run(
    m.id,
    submittedBy,
    attachmentUrl,
    t
  );

  db.prepare(`
    UPDATE matches
    SET status='UNDER_REVIEW',
        ended_at=COALESCE(ended_at, ?),
        updated_at=?
    WHERE id=?
  `).run(t, t, m.id);

  return get(code);
}

function result(code, resultType) {
  const m = get(code);
  if (!m) throw new Error('MATCH_NOT_FOUND');

  if (!['ACTIVE', 'UNDER_REVIEW', 'SUBMITTED'].includes(m.status)) {
    throw new Error('MATCH_NOT_FINISHABLE');
  }

  if (resultType !== 'DRAW') {
    throw new Error('USE_VERIFY_FOR_WIN');
  }

  const t = now();

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE matches
      SET status='VERIFIED',
          result='DRAW',
          ended_at=?,
          verified_at=?,
          winner_id=NULL,
          loser_id=NULL,
          updated_at=?
      WHERE id=?
    `).run(t, t, t, m.id);

    db.prepare(`
      UPDATE players
      SET draws=draws+1,
          win_streak=0,
          losing_streak=0,
          updated_at=?
      WHERE discord_id IN (?, ?)
    `).run(
      t,
      m.player_a_id,
      m.player_b_id
    );

    db.prepare(`
      INSERT INTO audit_logs
      (actor_id, action, target_type, target_id,
       reason, transaction_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      null,
      'DRAW_MATCH',
      'MATCH',
      m.match_code,
      'Draw',
      txId('DRAW'),
      t
    );
  });

  transaction();

  return get(code);
}

function verify(
  code,
  winnerId,
  adminId,
  {
    allowSpecial = false,
    reason = 'Verified Ranked Match'
  } = {}
) {
  const m = get(code);

  if (!m) throw new Error('MATCH_NOT_FOUND');

  if (m.status === 'VERIFIED') {
    throw new Error('MATCH_ALREADY_VERIFIED');
  }

  if (m.status !== 'UNDER_REVIEW') {
    throw new Error('MATCH_NOT_UNDER_REVIEW');
  }

  if (![m.player_a_id, m.player_b_id].includes(winnerId)) {
    throw new Error('INVALID_WINNER');
  }

  const loserId =
    winnerId === m.player_a_id
      ? m.player_b_id
      : m.player_a_id;

  const calc = score.calculate(
    m.score_a_before,
    m.score_b_before,
    allowSpecial
  );

  const t = now();

  if (!calc.scored) {
    db.prepare(`
      UPDATE matches
      SET status='NO_SCORE',
          result='WIN',
          winner_id=?,
          loser_id=?,
          ended_at=COALESCE(ended_at, ?),
          verified_at=?,
          verified_by=?,
          no_score_reason=?,
          updated_at=?
      WHERE id=?
    `).run(
      winnerId,
      loserId,
      t,
      t,
      adminId,
      calc.reason,
      t,
      m.id
    );

    return {
      status: 'NO_SCORE',
      match: get(code),
      calc
    };
  }

  const bonusService = require('./bonus.service');

  const bonus =
    bonusService.selectForMatch({
      match: m,
      winnerId,
      loserId
    }) || null;

  const applied = score.applyScore({
    matchId: m.id,
    winnerId,
    loserId,
    calc,
    adminId,
    bonusAmount: bonus?.amount || 0,
    bonusType: bonus?.type || null,
    reason
  });

  return {
    status: 'VERIFIED',
    match: get(code),
    calc,
    bonus,
    applied
  };
}

function cancel(code, adminId, reason) {
  const m = get(code);

  if (!m) throw new Error('MATCH_NOT_FOUND');

  if (m.status === 'VERIFIED') {
    throw new Error(
      'VERIFIED_MATCH_REQUIRES_SPECIAL_REVERSAL'
    );
  }

  db.prepare(`
    UPDATE matches
    SET status='CANCELLED',
        no_score_reason=?,
        verified_by=?,
        updated_at=?
    WHERE id=?
  `).run(
    reason,
    adminId,
    now(),
    m.id
  );

  return get(code);
}

function noScore(code, adminId, reason) {
  const m = get(code);

  if (!m) throw new Error('MATCH_NOT_FOUND');

  if (m.status === 'VERIFIED') {
    throw new Error(
      'VERIFIED_MATCH_REQUIRES_SPECIAL_REVERSAL'
    );
  }

  const t = now();

  db.prepare(`
    UPDATE matches
    SET status='NO_SCORE',
        no_score_reason=?,
        verified_by=?,
        verified_at=?,
        updated_at=?
    WHERE id=?
  `).run(
    reason,
    adminId,
    t,
    t,
    m.id
  );

  return get(code);
}

function evidence(code) {
  const m = get(code);

  if (!m) return [];

  return db.prepare(`
    SELECT *
    FROM match_evidence
    WHERE match_id=?
    ORDER BY id
  `).all(m.id);
}

module.exports = {
  get,
  start,
  submitEvidence,
  result,
  verify,
  cancel,
  noScore,
  evidence
};
