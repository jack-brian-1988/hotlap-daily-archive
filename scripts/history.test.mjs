import test from 'node:test';
import assert from 'node:assert/strict';
import {replayHistory,driverKey} from '../lib/rating-history.js';
import {createHistoryReader,validateHistory,historyResponse} from '../lib/history-source.js';

test('multiplayer replay matches the independently saved Python 0.4.5 opening race',()=>{
 // The archived Python experiment begins with a 339-driver race, all at the prior.
 const rows=Array.from({length:339},(_,i)=>['2025-09-16',i+1,'Driver '+i]);
 const p=replayHistory(rows).get('driver 0').history[0];
 assert.ok(Math.abs(p.mu-46.7401)<.0001);assert.ok(Math.abs(p.sigma-4.6896)<.0001);assert.ok(Math.abs(p.rating-32.6713)<.0001);
});
const rows=[['2026-01-01',1,'A'],['2026-01-01',2,'Hoozah!  🕶️'],['2026-01-01',3,'B'],['2026-03-01',1,'Hoozah! 🕶️'],['2026-03-01',2,'A']];
const snapshot=players=>[...players].map(([key,p])=>{const end=p.history.at(-1);return [null,key,null,null,end.rating,end.mu,end.sigma,p.history.length,p.history[0].date,end.date]});
test('all positions count, aliases merge literally, absences add no observations and one-driver races stay unchanged',()=>{
 const players=replayHistory(rows);assert.equal(players.size,3);assert.equal(players.get(driverKey('Hoozah!  🕶️')).history.length,2);
 assert.equal(players.get('b').history.length,1);assert.equal(players.get('b').history[0].position,3);
 const first=replayHistory(rows.slice(0,3));assert.deepEqual(players.get('b'),first.get('b'));
 const single=replayHistory([['2026-01-01',1,'<*>']]).get('<*>').history[0];assert.equal(single.mu,25);assert.equal(single.sigma,25/3);
 assert.throws(()=>replayHistory([['2026-01-01',2,'A']]));assert.throws(()=>replayHistory([...rows,...rows.slice(0,3)]));
});
test('saved ratings, counts and coverage must agree before returning any graph',()=>{
 const players=replayHistory(rows),saved=snapshot(players);validateHistory(players,saved);
 for(const [column,value] of [[5,999],[6,99],[7,999],[8,'2025-01-01'],[9,'2026-04-01']]){const altered=structuredClone(saved);altered[0][column]=value;assert.throws(()=>validateHistory(players,altered))}
 assert.throws(()=>validateHistory(players,saved.slice(1)));
});
test('profile requests share one replay, refresh when ratings change and retry after a partial source failure',async()=>{
 const p=replayHistory(rows);let saved=snapshot(p),reads=0,fail=false;
 const read=createHistoryReader({readRatings:async()=>Response.json({rows:saved,lastRace:'2026-03-01'}),readRows:async()=>{reads++;await new Promise(resolve=>setTimeout(resolve,5));if(fail)throw Error('Source updating');return rows}});
 const [a,h]=await Promise.all([read('A'),read('Hoozah!  🕶️')]);assert.equal(reads,1);assert.equal(a.history.length,2);assert.equal(h.history.length,2);assert.equal(a.through,'2026-03-01');await read('B');assert.equal(reads,1);
 assert.equal(await read('Unknown'),null);assert.equal(reads,1);
 saved=structuredClone(saved);saved.reverse();fail=true;await assert.rejects(()=>read('A'));assert.equal(reads,2);fail=false;await read('A');assert.equal(reads,3);
 assert.equal((await historyResponse('')).status,400);
});
