import test from 'node:test';
import assert from 'node:assert/strict';
import {withPodiumStreaks,filterArchive} from '../assets/range.js';
test('podium streaks handle gaps, ties, mixed case and duplicate finishes on one day',()=>{
 const daily=[['2026-01-01',2,'Alice'],['2026-01-02',3,'ALICE'],['2026-01-02',2,'Alice'],['2026-01-03',4,'Alice'],['2026-01-04',1,'Alice'],['2026-01-06',2,'Alice'],['2026-01-07',3,'Alice']];
 const source={drivers:[{name:'Alice'},{name:'Bob'}],daily};const d=withPodiumStreaks(source).drivers;
 assert.equal(d[0].podiumStreak,2);assert.equal(d[0].podiumStreakStart,'2026-01-01');assert.equal(d[0].podiumStreakEnd,'2026-01-02');assert.equal(d[1].podiumStreak,0);assert.equal(source.drivers[0].podiumStreak,undefined);
});
test('podium streaks are clipped to the inclusive selected period',()=>{
 const source={drivers:[{name:'Alice'}],daily:[['2026-01-01',2,'Alice','1',9],['2026-01-02',3,'Alice','1',8],['2026-01-03',1,'Alice','1',10]],calendar:[1,2,3].map(n=>({date:'2026-01-0'+n,drivers:1,winner:'Alice'}))};
 assert.equal(filterArchive(source,'2026-01-02','2026-01-03').drivers[0].podiumStreak,2);
 assert.equal(filterArchive(source,'2026-01-03','2026-01-03').drivers[0].podiumStreak,1);
 assert.deepEqual(filterArchive(source,'2026-02-01','2026-02-02').drivers,[]);
});
