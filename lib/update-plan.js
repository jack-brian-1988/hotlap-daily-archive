import {TrueSkill} from 'ts-trueskill';

export const key = name => name.trim().toLowerCase().replace(/^hoozah!  🕶️$/u,'hoozah! 🕶️');
const day = 86400000;
const serial = date => Date.parse(date+'T00:00:00Z')/day+25569;
const iso = n => new Date((n-25569)*day).toISOString().slice(0,10);
const assert = (test,msg) => { if (!test) throw new Error(msg); };
const number = n => typeof n==='number' && Number.isFinite(n);
const dateOK = d => typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(serial(d)) && iso(serial(d))===d;
const alphabetical = (a,b) => a.localeCompare(b,'en-GB');

function rank(rows,index,value) {
  let last, rank;
  rows.forEach((r,i)=>{ if(i===0||value(r)!==last) rank=i+1; last=value(r); r[index]=rank; });
}
function mapRows(rows,id,name) {
  const out = new Map();
  for(const row of rows) {
    const k=id(row);
    assert(typeof k==='string' && k && !out.has(k) && typeof row[1]==='string' && key(row[1])===k, 'Invalid '+name+' identity');
    out.set(k,row.slice());
  }
  return out;
}
export function validateRace(date,rows,total) {
  assert(dateOK(date)&&Number.isInteger(total)&&total>=0&&rows.length===total,'Incomplete race '+date);
  const ids=new Set();
  for(const [i,r] of rows.entries()){
    assert(r[0]===date&&r[1]===i+1&&typeof r[2]==='string'&&r[2].trim()&&number(r[3])&&(i===0||r[3]>=rows[i-1][3])&&typeof r[4]==='string'&&r[4]&&!ids.has(r[4])&&r[5]===r[2].trim().toLowerCase(),'Invalid race row '+date);
    ids.add(r[4]);
  }
  return rows;
}
export async function fetchRace(date, request=fetch) {
  const rows=[]; let total;
  do{
    const u=new URL('https://www.hotlapdaily.com/api/global-leaderboard');
    u.search=new URLSearchParams({date,limit:'1000',offset:String(rows.length)});
    const r=await request(u,{signal:AbortSignal.timeout(12000),redirect:'error'});
    assert(r.ok,'Race API HTTP '+r.status+' for '+date);
    const x=await r.json();
    assert(x.date===date&&Number.isInteger(x.total)&&x.total>=0&&(total===undefined||total===x.total)&&x.startRank===rows.length+1&&Array.isArray(x.leaderboard)&&(x.leaderboard.length||x.total===0),'Invalid race page '+date);
    total=x.total;
    assert(rows.length+x.leaderboard.length<=total,'Overfull race page '+date);
    for(const a of x.leaderboard) rows.push([date,rows.length+1,a.driverName,a.bestLap,a.raceId,typeof a.driverName==='string'?a.driverName.trim().toLowerCase():null]);
  }while(rows.length<total);
  return validateRace(date,rows,total);
}

export async function planUpdate(snapshot, today, fetchDay=fetchRace) {
  assert(dateOK(today),'Invalid UTC today');
  const {resultsCheckpoint:rc,ratingsCheckpoint:tc,calendar:rawCal,calendarNotes,top:rawTop,points,ratings,wins,stored}=snapshot;
  const c=rawCal.map(r=>Array.from({length:6},(_,i)=>r[i]??''));
  const top=rawTop.map(r=>r.slice());
  assert(c.length&&c.every((r,i)=>Number.isInteger(r[0])&&(!i||r[0]===c[i-1][0]+1)), 'Invalid Calendar dates');
  const lastCal=iso(c.at(-1)[0]);
  const validCheckpoint=(v,s)=>v?.schema===s&&v.status==='final'&&dateOK(v.through)&&v.through<today;
  assert(validCheckpoint(rc,'hotlapdaily.full-results.v1')&&validCheckpoint(tc,'hotlapdaily.ratings.v1')&&tc.through<=rc.through&&lastCal<today,'Invalid or interrupted checkpoint');
  assert(tc.drivers===ratings.length&&Number.isInteger(rc.rows)&&rc.rows>=stored.length&&Array.isArray(rc.emptyDates),'Checkpoint count mismatch');
  assert(tc.model==='trueskill-0.4.5'&&tc.mu===25&&tc.sigma===25/3&&tc.beta===25/6&&tc.tau===25/300&&tc.draw_probability===0&&tc.elo?.initial===1500&&tc.elo?.kProvisional===96&&tc.elo?.kEstablished===32&&tc.elo?.provisionalRaces===10&&tc.eligibility?.inactiveAfterUtcDays===30&&tc.eligibility?.minimumRaces===10,'Unexpected rating parameters');
  const newest=calendarNotes.at(-1);
  assert(newest?.schema==='hotlapdaily.participants.v1'&&newest.status==='final'&&newest.date===lastCal&&newest.total===c.at(-1)[1],'Missing last Calendar closure');
  const p=mapRows(points,r=>r[15],'Points');
  const w=mapRows(wins,r=>key(r[1]),'Wins');
  const t=mapRows(ratings,r=>r[12],'Full Ratings');
  assert(p.size===w.size,'Points/Wins identity count mismatch');
  for(const [k,r] of p){
    const v=w.get(k);
    assert(r.slice(2,15).every(n=>Number.isInteger(n)&&n>=0)&&r[2]===r.slice(5,15).reduce((a,n,i)=>a+n*(10-i),0)&&r[3]===r[5]&&v&&v[2]===r[3]&&v[6]===r[2]&&v[7]===r[4],'Invalid standings baseline');
  }
  for(const r of t.values())assert([r[2],r[4],r[5],r[6]].every(number)&&r[6]>0&&Math.abs(r[4]-r[5]+3*r[6])<1e-9&&Number.isInteger(r[7])&&r[7]>0&&dateOK(r[8])&&dateOK(r[9])&&r[8]<=r[9]&&r[9]<=tc.through,'Invalid rating baseline');
  const seenIds=new Set(), byDay=new Map();
  for(const row of stored){
    assert(row[0]<=rc.through&&!seenIds.has(row[4]),'Invalid stored Full Results tail');
    seenIds.add(row[4]);
    if(!byDay.has(row[0]))byDay.set(row[0],[]);
    byDay.get(row[0]).push(row);
  }
  const env=new TrueSkill(25,25/3,25/6,25/300,0), appended=[], races=[], notes=[];
  const start=Math.min(serial(lastCal),serial(rc.through),serial(tc.through));
  const target=iso(serial(today)-1);
  assert(serial(target)-start<=31,'More than 31 dates pending; review manually');
  let requests=0;
  const empty=new Set(rc.emptyDates);
  for(let n=start+1;n<serial(today);n++){
    const date=iso(n), already=date<=rc.through;
    let rows;
    if(already){
      rows=byDay.get(date)??[];
      const old=c.find(r=>r[0]===n);
      const total=old?.[1]??rows.length;
      assert(rows.length||empty.has(date),'Missing stored classification '+date);
      validateRace(date,rows,total);
      assert(!rows.length===empty.has(date),'Stored empty date mismatch');
    }else{
      const old=c.find(r=>r[0]===n);
      rows=await fetchDay(date); requests++;
      validateRace(date,rows,rows.length);
      assert(!old||old[1]===rows.length,'API differs from closed Calendar');
      for(const row of rows){assert(!seenIds.has(row[4]),'Duplicate lap ID');seenIds.add(row[4]);appended.push(row)}
      if(!rows.length)empty.add(date);
    }
    if(date<=lastCal){
      const priorTop=top.filter(r=>r[0]===n);
      assert(priorTop.length===Math.min(10,rows.length)&&priorTop.every((r,i)=>r[1]===rows[i][1]&&r[3]===rows[i][3]&&r[5]===rows[i][4]&&r[6]===key(rows[i][2])),'Stored classification differs from closed standings');
    }
    const unique=new Map();
    for(const r of rows)if(!unique.has(key(r[2])))unique.set(key(r[2]),r);
    if(date>lastCal){
      const winner=rows[0], k=winner?key(winner[2]):'',prev=c.at(-1);
      c.push([n,rows.length,winner?.[2]??'',winner?.[3]??'',k,k?(prev[4]===k?prev[5]+1:1):0]);
      notes.push({schema:'hotlapdaily.participants.v1',date,status:'final',total:rows.length,keys:[...unique.keys()]});
      for(const [k,r] of unique){
        if(!p.has(k))p.set(k,[0,r[2],0,0,0,...Array(10).fill(0),k]);
        p.get(k)[4]++;
      }
      for(const [_,pos,name,lap,id] of rows.slice(0,10)){
        const k=key(name), pr=p.get(k);
        pr[2]+=11-pos;pr[3]+=Number(pos===1);pr[4+pos]++;
        top.push([n,pos,name,lap,11-pos,id,k]);
      }
    }
    if(date>tc.through){
      const ordered=[...unique].map(([k,r])=>{
        if(!t.has(k))t.set(k,['',r[2],1500,'',0,25,25/3,0,date,date,true,false,k]);
        return [t.get(k),r[1]];
      });
      const N=ordered.length, old=ordered.map(([r])=>r[2]);
      const rated=N>1?env.rate(ordered.map(([r])=>[env.createRating(r[5],r[6])]),ordered.map(x=>x[1])):null;
      ordered.forEach(([r],i)=>{
        if(rated){
          const expected=old.reduce((sum,v,j)=>j===i?sum:sum+1/(1+10**((v-old[i])/400)),0);
          r[2]=old[i]+(r[7]<10?96:32)*(N-1-i-expected)/(N-1);
          r[5]=rated[i][0].mu;r[6]=rated[i][0].sigma;r[4]=r[5]-3*r[6];
        }
        assert([r[2],r[4],r[5],r[6]].every(number)&&r[6]>0,'Invalid calculated rating');
        r[7]++;r[9]=date;
      });
    }
    races.push({date,raw:rows.length,unique:unique.size,reused:already});
  }
  let previous='',len=0;
  const streaks=new Map(), winsByKey=new Map(), topByKey=new Map(), positionsByDate=new Map();
  for(const r of c){
    const k=r[4];len=k?(k===previous?len+1:1):0;previous=k;
    assert(r[5]===len,'Calendar streak mismatch');
    if(!k)continue;
    winsByKey.set(k,(winsByKey.get(k)??0)+1);
    if(len>(streaks.get(k)?.[0]??0))streaks.set(k,[len,r[0]-len+1,r[0]]);
  }
  const calendarByDate=new Map(c.map(r=>[r[0],r]));
  for(const [d,pos,name,,score,,k] of top){
    const next=(positionsByDate.get(d)??0)+1;positionsByDate.set(d,next);
    assert(pos===next&&pos<=10&&score===11-pos&&key(name)===k&&p.has(k)&&calendarByDate.has(d),'Invalid Daily Top 10');
    if(pos===1)assert(calendarByDate.get(d)[4]===k,'Calendar winner mismatch');
    if(!topByKey.has(k))topByKey.set(k,Array(10).fill(0));
    topByKey.get(k)[pos-1]++;
  }
  for(const r of c)assert((positionsByDate.get(r[0])??0)===Math.min(10,r[1]),'Daily positions incomplete');
  for(const [k,r] of p){
    const hist=topByKey.get(k)??Array(10).fill(0);
    assert(r[3]===(winsByKey.get(k)??0)&&r.slice(5,15).every((v,i)=>v===hist[i]),'Standings history mismatch');
    const s=streaks.get(k)??[0,'',''];
    assert(s[0]<=r[3],'Impossible longest streak');
    w.set(k,[0,w.get(k)?.[1]??r[1],r[3],...s,r[2],r[4]]);
  }
  const pp=[...p.values()].sort((a,b)=>b[2]-a[2]||alphabetical(a[1],b[1]));
  const ww=[...w.values()].sort((a,b)=>b[2]-a[2]||alphabetical(a[1],b[1]));
  rank(pp,0,r=>r[2]);rank(ww,0,r=>r[2]);
  const tt=[...t.values()];
  for(const r of tt){r[10]=serial(today)-serial(r[9])<30;r[11]=r[7]>=10;r[0]='';r[3]=''}
  const eligible=tt.filter(r=>r[10]&&r[11]);
  for(const [i,j] of [[0,2],[3,4]])rank(eligible.slice().sort((a,b)=>b[j]-a[j]||alphabetical(a[1],b[1])),i,r=>r[j]);
  return {target,previous:{calendar:lastCal,fullResults:rc.through,fullRatings:tc.through},races,requests,calendar:c,top,points:pp,wins:ww,ratings:tt,appended,notes,
    resultsCheckpoint:{...rc,through:target,rows:rc.rows+appended.length,emptyDates:[...empty].sort()},
    ratingsCheckpoint:{...tc,through:target,drivers:tt.length,eligibility:{...tc.eligibility,checkedAt:today}},
    totals:{calendarDates:c.length,points:pp.reduce((a,r)=>a+r[2],0),wins:pp.reduce((a,r)=>a+r[3],0),entries:pp.reduce((a,r)=>a+r[4],0),results:rc.rows+appended.length,ratings:tt.length,eligible:eligible.length}};
}
