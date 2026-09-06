const { db, now } = require('../database');
const config = require('../config');
const challenge = require('./challenge.service');

const PRIORITY = Object.freeze({EVENT:1,BOUNTY:2,WIN_STREAK:3,COMEBACK:4,REVENGE:5,RIVAL:6,PERFECT_DAY:7,HOT_MATCH:8,DAILY:9,LAST_CHANCE:10});
function player(id){return challenge.getPlayer(id);}
function eligibleBounty(m,winner,loser){
  const diff=Math.abs(m.score_a_before-m.score_b_before);
  if(diff<50||diff>150||winner.score>=loser.score) return null;
  const d=challenge.ensureDaily(winner.discord_id);
  if(d.bounty_count>=2||d.bounty_points>=20) return null;
  const amount=diff>=150?8:diff>=100?5:3;
  if(d.bounty_points+amount>20) return null;
  return {type:'BOUNTY',amount,priority:PRIORITY.BOUNTY,reason:`Defeated higher score by ${diff}`};
}
function eligibleStreak(winner){
  const next=winner.win_streak+1;
  if(![3,5,8].includes(next)) return null;
  const amount=next===8?8:next===5?5:3;
  return {type:'WIN_STREAK',amount,priority:PRIORITY.WIN_STREAK,reason:`Reached ${next}-win streak`};
}
function eligibleComeback(winner,loser){
  if(!winner.comeback_pending) return null;
  let ids=[]; try{ids=JSON.parse(winner.comeback_loss_ids||'[]')}catch{}
  if(ids.includes(loser.discord_id)) return null;
  return {type:'COMEBACK',amount:5,priority:PRIORITY.COMEBACK,reason:'Won after 3 consecutive scored losses'};
}
function eligibleRevenge(winner,loser){
  if(winner.revenge_opponent_id!==loser.discord_id) return null;
  if(!winner.revenge_expires_at||winner.revenge_expires_at<now()) return null;
  return {type:'REVENGE',amount:5,priority:PRIORITY.REVENGE,reason:'Revenge win within 24 hours'};
}
function evaluate({match,winnerId,loserId}) {
  const winner=player(winnerId), loser=player(loserId); if(!winner||!loser) return [];
  const candidates=[];
  // Event/Hot/Daily/Defender are intentionally injected by their own services later.
  const b=eligibleBounty(match,winner,loser); if(b)candidates.push(b);
  const s=eligibleStreak(winner); if(s)candidates.push(s);
  const c=eligibleComeback(winner,loser); if(c)candidates.push(c);
  const r=eligibleRevenge(winner,loser); if(r)candidates.push(r);
  return candidates.sort((a,b)=>a.priority-b.priority);
}
function selectForMatch(args){
  const candidates=evaluate(args);
  const selected=candidates[0]||null;
  const t=now();
  for(const c of candidates){
    db.prepare('INSERT INTO bonus_logs(match_id,player_id,bonus_type,amount,priority,selected,reason,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(args.match.id,args.winnerId,c.type,c.amount,c.priority,c===selected?1:0,c===selected?c.reason:`Not selected; higher priority bonus exists`,t);
  }

  if(selected?.type === 'BOUNTY'){
    const d = challenge.ensureDaily(args.winnerId);
    db.prepare(`
      UPDATE daily_stats
      SET bounty_count = bounty_count + 1,
          bounty_points = bounty_points + ?
      WHERE day_key = ? AND player_id = ?
    `).run(selected.amount, challenge.dayKey());
  }

  return selected;
}
function claimDaily(playerId){
  const d = challenge.ensureDaily(playerId);

  if(d.daily_claimed){
    return {claimed:false, amount:0, reason:'DAILY_ALREADY_CLAIMED'};
  }

  const p = player(playerId);
  if(!p) throw new Error('PLAYER_NOT_FOUND');

  const amount = 10;
  const before = p.score;
  const after = before + amount;

  db.prepare(
    'UPDATE players SET score=? WHERE discord_id=?'
  ).run(after, playerId);

  db.prepare(
    'UPDATE daily_stats SET daily_claimed=1 WHERE day_key=? AND player_id=?'
  ).run(challenge.dayKey(), playerId);

  return {
    claimed:true,
    amount,
    before,
    after,
    reason:'DAILY_LOGIN'
  };
}

module.exports={PRIORITY,evaluate,selectForMatch,claimDaily};
