import assert from 'node:assert/strict';
import test from 'node:test';
import {fetchRace,planUpdate} from '../lib/update-plan.js';
const date='2026-11-09', old='2026-11-08';
const race=[
  [date,1,'Alice',4.1,'a9','alice'],
  [date,2,'Bob',4.1,'b9','bob'],
];
const fixture=()=>({
  calendar:[[46334,1,'Alice',4.3,'alice',1]],calendarNotes:[{schema:'hotlapdaily.participants.v1',date:old,total:1,status:'final'}],
  top:[[46334,1,'Alice',4.3,10,'a8','alice']],points:[[1,'Alice',10,1,1,1,0,0,0,0,0,0,0,0,0,'alice']],
  wins:[[1,'Alice',1,1,46334,46334,10,1]],
  ratings:[['','Alice',1500,'',0,25,25/3,1,old,old,true,false,'alice']],
  stored:[],
  resultsCheckpoint:{schema:'hotlapdaily.full-results.v1',status:'final',through:old,rows:1,emptyDates:[]},
  ratingsCheckpoint:{schema:'hotlapdaily.ratings.v1',status:'final',through:old,drivers:1,model:'trueskill-0.4.5',
    mu:25,sigma:25/3,beta:25/6,tau:25/300,draw_probability:0,
    elo:{initial:1500,kProvisional:96,kEstablished:32,provisionalRaces:10},eligibility:{minimumRaces:10,inactiveAfterUtcDays:30}},
});
test('one race updates all six projections and preserves API tie order',async()=>{
  const plan=await planUpdate(fixture(),'2026-11-10',async d=>{assert.equal(d,date);return race});
  assert.deepEqual(plan.totals,{calendarDates:2,points:29,wins:2,entries:3,results:3,ratings:2,eligible:0});
  assert.deepEqual(plan.calendar.at(-1),[46335,2,'Alice',4.1,'alice',2]);
  assert.equal(plan.points[0][1],'Alice');
  assert.deepEqual(plan.wins[0].slice(2,6),[2,2,46334,46335]);
  assert.deepEqual(plan.ratings.map(r=>r[2]),[1548,1452]);
  assert.deepEqual(plan.ratings.map(r=>r[7]),[2,1]);
  // Values from Python trueskill 0.4.5, default backend, with draw_probability=0.
  assert.ok(Math.abs(plan.ratings[0][5]-29.205473106813677)<1e-10);
  assert.ok(Math.abs(plan.ratings[0][6]-7.194816551480743)<1e-10);
});
test('uses stored race once and calls no API when checkpoint is complete',async()=>{
  const base=fixture();base.resultsCheckpoint={...base.resultsCheckpoint,through:date,rows:3};base.stored=race;
  const forbidden=()=>assert.fail('unexpected API call');
  const a=await planUpdate(base,'2026-11-10',forbidden);
  const b=await planUpdate({...base,calendar:a.calendar,calendarNotes:a.notes,top:a.top,points:a.points,wins:a.wins,ratings:a.ratings,ratingsCheckpoint:a.ratingsCheckpoint,stored:[]},'2026-11-10',forbidden);
  assert.equal(a.races[0].reused,true);
  assert.deepEqual(b.races,[]);
  assert.deepEqual(b.totals,a.totals);
  assert.deepEqual(b.ratings,a.ratings);
});
test('rejects interrupted checkpoint and API errors',async()=>{
  const base=fixture();base.ratingsCheckpoint.status='updating';
  await assert.rejects(planUpdate(base,'2026-11-10'),/checkpoint/);
  await assert.rejects(fetchRace(date,async()=>new Response('',{status:429})),/HTTP 429/);
  await assert.rejects(fetchRace(date,async()=>Response.json({date,total:3,startRank:1,leaderboard:[]})),/Invalid race page/);
});
test('paginates only when total exceeds the first page',async()=>{
  const offsets=[];
  const rows=await fetchRace(date,async u=>{
    const i=Number(u.searchParams.get('offset'));offsets.push(i);
    return Response.json({date,total:2,startRank:i+1,leaderboard:[{driverName:race[i][2],bestLap:race[i][3],raceId:race[i][4]}]});
  });
  assert.deepEqual(rows,race);assert.deepEqual(offsets,[0,1]);
});
