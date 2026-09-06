const { ensureSeason } = require('./database');
const challenge=require('./services/challenge.service');
const match=require('./services/match.service');
const score=require('./services/score.service');

const admin='ADMIN-DEMO';
const runId = Date.now();

const a = challenge.ensurePlayer({
  discordId: `demo-a-${runId}`,
  displayName: 'Aoi'
});

const b = challenge.ensurePlayer({
  discordId: `demo-b-${runId}`,
  displayName: 'Ren'
});
console.log('Players:', a.player_id, b.player_id);
const c=challenge.createChallenge({challengerId:a.discord_id,targetId:b.discord_id});
console.log('Challenge:',c.challenge_code);
const m=challenge.acceptChallenge(c.challenge_code,b.discord_id);
console.log('Match:',m.match_code);
match.start(m.match_code,a.discord_id);
match.submitEvidence(m.match_code,a.discord_id,'https://example.com/evidence.png');
const out=match.verify(m.match_code,a.discord_id,admin);
console.log('Result:',out);
console.log('A:',challenge.getPlayer(a.discord_id));
console.log('B:',challenge.getPlayer(b.discord_id));
console.log('Season:',ensureSeason());
