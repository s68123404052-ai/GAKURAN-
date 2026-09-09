const { db, now } = require('../database');
const config = require('../config');
const score = require('./score.service');

function getPlayer(discordId) { return db.prepare('SELECT * FROM players WHERE discord_id=?').get(discordId); }
function getAllPlayers() { return db.prepare('SELECT * FROM players ORDER BY id ASC').all(); }
function ensurePlayer({discordId,displayName}) {
  let p=getPlayer(discordId); if(p) return p;
  const last=db.prepare('SELECT player_id FROM players ORDER BY id DESC LIMIT 1').get();
  const next=last?Number(last.player_id.replace('GK-',''))+1:1;
  const t=now();
  db.prepare('INSERT INTO players(player_id,discord_id,display_name,score,created_at,updated_at) VALUES(?,?,?,?,?,?)')
    .run(`GK-${String(next).padStart(6,'0')}`,discordId,displayName,config.startScore,t,t);
  return getPlayer(discordId);
}
function dayKey(ts=now()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:config.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ts*1000));
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function ensureDaily(id,ts=now()) {
  const d=dayKey(ts);
  db.prepare('INSERT INTO daily_stats(day_key,player_id) VALUES(?,?) ON CONFLICT(day_key,player_id) DO NOTHING').run(d,id);
  return db.prepare('SELECT * FROM daily_stats WHERE day_key=? AND player_id=?').get(d,id);
}
function activeMatch(id) {
  return db.prepare(`SELECT * FROM matches WHERE status IN ('APPROVED','ACTIVE','SUBMITTED','UNDER_REVIEW') AND (player_a_id=? OR player_b_id=?) ORDER BY id DESC LIMIT 1`).get(id,id);
}
function pairKey(a,b) { return [a,b].sort().join(':'); }
function pairCooldownSeconds(a,b) {
  const m=db.prepare(`SELECT ended_at FROM matches WHERE ((player_a_id=? AND player_b_id=?) OR (player_a_id=? AND player_b_id=?)) AND ended_at IS NOT NULL ORDER BY ended_at DESC LIMIT 1`).get(a,b,b,a);
  return m?Math.max(0,config.pairCooldownSeconds-(now()-m.ended_at)):0;
}
function pairScoredToday(a,b) {
  const d=dayKey();
  return db.prepare(`SELECT COUNT(*) AS c FROM matches WHERE status='VERIFIED' AND ((player_a_id=? AND player_b_id=?) OR (player_a_id=? AND player_b_id=?)) AND ended_at>=? AND ended_at<?`).get(a,b,b,a,startOfDay(d),startOfDay(nextDay(d))).c;
}
function startOfDay(day) { const [y,m,d]=day.split('-').map(Number); return Math.floor(new Date(`${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}T00:00:00+07:00`).getTime()/1000); }
function nextDay(day) { const t=startOfDay(day)+86400; return dayKey(t); }
function rankedStartedToday(id) { return ensureDaily(id).ranked_started; }
function validatePlayer(p) {
  if(!p) throw new Error('PLAYER_NOT_FOUND');
  const t=now();
  if(p.suspension_until>t) throw new Error('SUSPENSION_ACTIVE');
  if(p.fail_until>t) throw new Error('FAIL_ACTIVE');
  if(p.rest_until>t) throw new Error('EXTRA_REST_ACTIVE');
}
function protectedPlayer(p,ts=now()) {
  return p.score<config.protectionScore || p.scored_matches<config.protectionMatches || (p.first_scored_match_at && ts-p.first_scored_match_at<config.protectionDays*86400);
}
function createChallenge({challengerId,targetId,reason=''}) {
  if(challengerId===targetId) throw new Error('CANNOT_CHALLENGE_SELF');
  const a=getPlayer(challengerId), b=getPlayer(targetId); validatePlayer(a); validatePlayer(b);
  if(activeMatch(a.discord_id)||activeMatch(b.discord_id)) throw new Error('ACTIVE_MATCH');
  if(db.prepare("SELECT 1 FROM challenges WHERE challenger_id=? AND status='PENDING' AND expires_at>?").get(challengerId,now())) throw new Error('PENDING_CHALLENGE_EXISTS');
  const diff=Math.abs(a.score-b.score);
  if(diff>150) throw new Error('SCORE_DIFFERENCE_REQUIRES_ADMIN_APPROVAL');
  if(protectedPlayer(b)&&a.score>=b.score+150) throw new Error('TARGET_IS_PROTECTED');
  if(pairCooldownSeconds(a.discord_id,b.discord_id)>0) throw new Error('PAIR_COOLDOWN');
  if(pairScoredToday(a.discord_id,b.discord_id)>=config.maxPairScoredDaily) throw new Error('PAIR_DAILY_SCORED_LIMIT');
  if(rankedStartedToday(a.player_id)>=config.maxRankedDaily || rankedStartedToday(b.player_id)>=config.maxRankedDaily) throw new Error('RANKED_DAILY_LIMIT');
  const season=db.prepare("SELECT * FROM seasons WHERE status='ACTIVE' ORDER BY id DESC LIMIT 1").get();
  const t=now();
let code;
do {
    code=String(Math.floor(1000 + Math.random() * 9000));
} while (db.prepare('SELECT 1 FROM challenges WHERE challenge_code=?').get(code));
  db.prepare('INSERT INTO challenges(challenge_code,season_id,challenger_id,target_id,status,reason,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').run(code,season.id,a.player_id,b.player_id,'PENDING',reason,t,t+config.challengeTimeoutSeconds);
  return db.prepare('SELECT * FROM challenges WHERE challenge_code=?').get(code);
}
function expire(code) {
  const c=db.prepare('SELECT * FROM challenges WHERE challenge_code=?').get(code);
  if(!c) throw new Error('CHALLENGE_NOT_FOUND');
  if(c.status==='PENDING' && c.expires_at<=now()) db.prepare("UPDATE challenges SET status='EXPIRED' WHERE id=?").run(c.id);
  return db.prepare('SELECT * FROM challenges WHERE id=?').get(c.id);
}
function acceptChallenge(code, acceptingUserId) {
  let c = db.prepare(
    'SELECT * FROM challenges WHERE challenge_code=?'
  ).get(String(code));

  if (!c) throw new Error('CHALLENGE_NOT_FOUND');

  c = expire(String(code));

  if (c.status !== 'PENDING') {
    throw new Error('CHALLENGE_NOT_ACTIVE');
  }

  if (String(c.target_id) !== String(getPlayer(acceptingUserId)?.player_id)) {
    throw new Error('NOT_CHALLENGE_TARGET');
  }

  const a = db.prepare('SELECT * FROM players WHERE player_id=?').get(c.challenger_id);
  const b = db.prepare('SELECT * FROM players WHERE player_id=?').get(c.target_id);

  validatePlayer(a);
  validatePlayer(b);

  if (activeMatch(a.discord_id) || activeMatch(b.discord_id)) {
    throw new Error('ACTIVE_MATCH');
  }

  const season = db.prepare(
    "SELECT * FROM seasons WHERE status='ACTIVE' ORDER BY id DESC LIMIT 1"
  ).get();

  if (!season) throw new Error('NO_ACTIVE_SEASON');

  const t = now();

  let matchCode;
  do {
    matchCode = String(Math.floor(1000 + Math.random() * 9000));
  } while (
    db.prepare('SELECT 1 FROM matches WHERE match_code=?').get(matchCode)
  );

  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE challenges SET status='ACCEPTED', resolved_at=? WHERE id=?"
    ).run(t, c.id);

    const matchResult = db.prepare(`
      INSERT INTO matches (
        match_code, season_id, player_a_id, player_b_id,
        status, match_type, score_a_before, score_b_before,
        class_a_before, class_b_before, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      matchCode,
      season.id,
      a.discord_id,
      b.discord_id,
      'APPROVED',
      'RANKED',
      a.score,
      b.score,
      score.class0f(a.score),
      score.class0f(b.score),
      t,
      t
    );

    db.prepare(
      'UPDATE challenges SET match_id=? WHERE id=?'
    ).run(matchResult.lastInsertRowid, c.id);

    ensureDaily(a.player_id);
    ensureDaily(b.player_id);

    db.prepare(
      'UPDATE daily_stats SET ranked_started=ranked_started+1 WHERE day_key=? AND player_id=?'
    ).run(dayKey(t), a.player_id);

    db.prepare(
      'UPDATE daily_stats SET ranked_started=ranked_started+1 WHERE day_key=? AND player_id=?'
    ).run(dayKey(t), b.player_id);
  });

  tx();

  return db.prepare(
    'SELECT * FROM matches WHERE match_code=?'
  ).get(matchCode);
}

function decline(code,userId,reason='') {
  const c=db.prepare('SELECT * FROM challenges WHERE challenge_code=?').get(code); if(!c) throw new Error('CHALLENGE_NOT_FOUND');
  if(c.target_id!==(getPlayer(userId)?.player_id)) throw new Error('NOT_CHALLENGE_TARGET');
  if(c.status!=='PENDING') throw new Error('CHALLENGE_NOT_ACTIVE');
  db.prepare("UPDATE challenges SET status='DECLINED',decline_reason=? WHERE id=?").run(reason,c.id);
  return db.prepare('SELECT * FROM challenges WHERE id=?').get(c.id);
}
module.exports={getPlayer,getAllPlayers,ensurePlayer,dayKey,ensureDaily,activeMatch,pairCooldownSeconds,pairScoredToday,rankedStartedToday,protectedPlayer,createChallenge,acceptChallenge,decline,expire};
