import {randomUUID} from 'node:crypto';
import {key,planUpdate} from './update-plan.js';

const ids={Points:801946561,Wins:1479199503,Calendar:2076106737,'Daily Top 10':816613409,'Full Results':1751763858,'Full Ratings':924913483};
const lockId=722275557,lockKey='hotlapdaily.update-lock.v1';
const markerKey='hotlapdaily.update-day.v1';
const grid=(name,row,last,col,end)=>({sheetId:ids[name],startRowIndex:row-1,endRowIndex:last,startColumnIndex:col,endColumnIndex:end});
const value=x=>x===''||x==null?{}:{userEnteredValue:typeof x==='object'?x:typeof x==='boolean'?{boolValue:x}:typeof x==='number'?{numberValue:x}:{stringValue:x}};
const f=formulaValue=>({formulaValue});
const normalize=x=>x??'';
const same=(a,b)=>a===b||(typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(a),Math.abs(b)));
const matches=(a,b,width)=>a.length===b.length&&a.every((r,i)=>Array.from({length:width},(_,j)=>same(normalize(r[j]),normalize(b[i][j]))).every(Boolean));
const note=(name,row,col,data)=>({updateCells:{start:{sheetId:ids[name],rowIndex:row-1,columnIndex:col},rows:[{values:[{note:JSON.stringify(data)}]}],fields:'note'}});
const changed=(a,b)=>JSON.stringify(a)!==JSON.stringify(b);
const safe=(v)=>{if(!v)throw Error('Workbook verification failed; update lock retained')};

export function prepareWrite(old,plan,run=randomUUID()){
  if(old.metadata.some(m=>m.metadataId===lockId||m.metadataKey===lockKey))throw Error('Prior update requires review');
  const calendarAdded=plan.calendar.length-old.calendar.length,topAdded=plan.top.length-old.top.length;
  const pEnd=7+plan.points.length,wEnd=7+plan.wins.length,cEnd=7+plan.calendar.length;
  const q=[{createDeveloperMetadata:{developerMetadata:{metadataId:lockId,metadataKey:lockKey,metadataValue:JSON.stringify({run,through:plan.target,previous:plan.previous,totals:plan.totals}),visibility:'DOCUMENT',location:{spreadsheet:true}}}}];
  // Retain one immutable marker per execution date: a stale concurrent
  // invocation still cannot commit after a successful run releases its lock.
  const executionDate=plan.ratingsCheckpoint.eligibility.checkedAt;
  q.push({createDeveloperMetadata:{developerMetadata:{metadataId:lockId+1+Math.floor(Date.parse(executionDate)/86400000),metadataKey:markerKey,metadataValue:executionDate,visibility:'DOCUMENT',location:{spreadsheet:true}}}});
  const finish=[];
  const put=(dest,name,row,col,rows)=>{
    if(rows.length)dest.push({updateCells:{range:grid(name,row,row+rows.length-1,col,col+rows[0].length),rows:rows.map(r=>({values:r.map(value)})),fields:'userEnteredValue'}});
  };
  const rep=(dest,name,first,last,col,formula)=>{
    if(last>=first)dest.push({repeatCell:{range:grid(name,first,last,col,col+1),cell:value(f(formula)),fields:'userEnteredValue'}});
  };
  const extend=(name,from,to,width)=>{
    const m=old.grids[name];
    if(to<=from)return;
    if(to>m.rows)q.push({appendDimension:{sheetId:ids[name],dimension:'ROWS',length:to-m.rows}});
    q.push({copyPaste:{source:grid(name,from,from,0,width),destination:grid(name,from+1,to,0,width),pasteType:'PASTE_FORMAT',pasteOrientation:'NORMAL'}});
    if(m.filter?.range?.endRowIndex===from)q.push({setBasicFilter:{filter:{...m.filter,range:{...m.filter.range,endRowIndex:to}}}});
  };
  const pending=(name,checkpoint)=>{
    const copy={...checkpoint};delete copy.sha256;
    q.push(note(name,1,0,{...copy,status:'updating'}));
    finish.push(note(name,1,0,{...copy,status:'final'}));
  };
  pending('Full Results',plan.resultsCheckpoint);pending('Full Ratings',plan.ratingsCheckpoint);
  extend('Full Results',old.resultsCheckpoint.rows+1,plan.resultsCheckpoint.rows+1,6);
  put(q,'Full Results',old.resultsCheckpoint.rows+2,0,plan.appended);
  extend('Calendar',7+old.calendar.length,cEnd,6);
  for(let i=0;i<calendarAdded;i++){
    const row=8+old.calendar.length+i,prev=row-1,r=plan.calendar[old.calendar.length+i];
    put(q,'Calendar',row,0,[[...r.slice(0,5),f(`=IF(B${row}=0,0,IF(AND(E${row}=E${prev},A${row}=A${prev}+1),F${prev}+1,1))`)]]);
    q.push(note('Calendar',row,1,{...plan.notes[i],status:'updating'}));
    finish.push(note('Calendar',row,1,plan.notes[i]));
  }
  extend('Daily Top 10',7+old.top.length,7+plan.top.length,7);
  if(topAdded)put(q,'Daily Top 10',8+old.top.length,0,plan.top.slice(old.top.length).map((r,i)=>[...r.slice(0,4),f(`=MAX(0,11-B${8+old.top.length+i})`),...r.slice(5)]));
  const pmap=new Map(plan.points.map(r=>[r[15],r])),wmap=new Map(plan.wins.map(r=>[key(r[1]),r]));
  const oldP=new Set(old.points.map(r=>r[15])),oldW=new Set(old.wins.map(r=>key(r[1])));
  const newP=plan.points.filter(r=>!oldP.has(r[15])),newW=plan.wins.filter(r=>!oldW.has(key(r[1])));
  if(calendarAdded){
    extend('Points',7+old.points.length,pEnd,16);
    extend('Wins',7+old.wins.length,wEnd,8);
    for(const [i,r] of old.points.entries()){
      const n=pmap.get(r[15]);if(n[1]!==r[1])throw Error('Existing name changed');
      if(changed(r.slice(4,15),n.slice(4,15)))put(q,'Points',8+i,4,[n.slice(4,15)]);
    }
    put(q,'Points',8+old.points.length,1,newP.map(r=>[r[1]]));
    put(q,'Points',8+old.points.length,4,newP.map(r=>r.slice(4)));
    const start=8+old.points.length;
    rep(q,'Points',start,pEnd,2,`=SUMPRODUCT(F${start}:O${start},$F$6:$O$6)`);
    rep(q,'Points',start,pEnd,3,`=F${start}`);
    for(const [i,r] of old.wins.entries()){
      const n=wmap.get(key(r[1]));if(n[1]!==r[1])throw Error('Existing winner name changed');
      if(changed(r.slice(4,6),n.slice(4,6)))put(q,'Wins',8+i,4,[n.slice(4,6)]);
    }
    put(q,'Wins',8+old.wins.length,1,newW.map(r=>[r[1]]));
    put(q,'Wins',8+old.wins.length,4,newW.map(r=>r.slice(4,6)));
    const identity='IF(LOWER(TRIM(B8))="hoozah! 🕶️","hoozah! 🕶️",LOWER(REGEXREPLACE(B8,"^\\s+|\\s+$","")))';
    for(const [col,source] of [[2,'D'],[6,'C'],[7,'E']])
      rep(q,'Wins',8,wEnd,col,`=IFNA(XLOOKUP(${identity},Points!$P$8:$P$${pEnd},Points!$${source}$8:$${source}$${pEnd}),0)`);
    rep(q,'Wins',8,wEnd,3,`=IFNA(MAX(FILTER(Calendar!$F$8:$F$${cEnd},Calendar!$E$8:$E$${cEnd}=${identity})),0)`);
    put(finish,'Points',3,0,[[`${plan.totals.wins.toLocaleString('en-GB')} race days · ${dateFrom(plan.calendar.find(r=>r[1]>0)[0])} to ${plan.target} UTC · all results final`]]);
    put(finish,'Wins',3,0,[[`${plan.points.length.toLocaleString('en-GB')} driver names · ${plan.wins.filter(r=>r[2]>0).length} winners · ${plan.totals.wins} daily wins`]]);
    put(finish,'Calendar',3,0,[[`${plan.calendar.length} dates listed · ${plan.totals.wins} race days · ${plan.calendar.length-plan.totals.wins} date(s) without results.`]]);
    put(finish,'Calendar',5,0,[[`Updated: ${plan.ratingsCheckpoint.eligibility.checkedAt}. Completed UTC days through ${plan.target}. Participant lists cached in Drivers cell notes.`]]);
  }
  extend('Full Ratings',old.ratings.length+1,plan.ratings.length+1,13);
  for(const [i,r] of plan.ratings.entries()){
    if(i<old.ratings.length&&r[12]!==old.ratings[i][12])throw Error('Existing rating order changed');
    if(!matches([r],[old.ratings[i]??[]],13))put(q,'Full Ratings',i+2,0,[r]);
  }
  const sort=[];
  if(calendarAdded){
    for(const [name,end,width] of [['Points',pEnd,16],['Wins',wEnd,8]]){
      sort.push({sortRange:{range:grid(name,8,end,0,width),sortSpecs:[{dimensionIndex:2,sortOrder:'DESCENDING'},{dimensionIndex:1,sortOrder:'ASCENDING'}]}});
      rep(sort,name,8,end,0,'=IF(C8=C7,A7,ROW()-7)');
    }
  }
  finish.push({deleteDeveloperMetadata:{dataFilter:{developerMetadataLookup:{metadataId:lockId,metadataKey:lockKey,metadataValue:q[0].createDeveloperMetadata.developerMetadata.metadataValue}}}});
  return {apply:q,sort,finish,lock:q[0].createDeveloperMetadata.developerMetadata};
}

const dateFrom=n=>new Date((n-25569)*86400000).toISOString().slice(0,10);
function verifyStandings(snapshot,plan,sorted){
  for(const [rows,expected,width,identity] of [
    [snapshot.points,plan.points,16,r=>r[15]],
    [snapshot.wins,plan.wins,8,r=>key(r[1])],
  ]){
    safe(rows.length===expected.length);
    const m=new Map(expected.map(r=>[identity(r),r]));
    let rank=0;
    for(const [i,r] of rows.entries()){
      const k=identity(r),e=m.get(k);
      safe(e&&matches([r.slice(1)],[e.slice(1)],width-1));m.delete(k);
      if(sorted){
        safe(!i||rows[i-1][2]>=r[2]);
        if(!i||rows[i-1][2]!==r[2])rank=i+1;
        safe(r[0]===rank);
      }
    }
    safe(m.size===0);
  }
}
export async function applyDaily({client,today,fetchDay}){
  const old=await client.snapshot();
  if(old.metadata.some(m=>m.metadataId===lockId||m.metadataKey===lockKey))throw Error('Prior update requires review');
  const plan=await planUpdate(old,today,fetchDay);
  if(!plan.races.length&&old.ratingsCheckpoint.eligibility.checkedAt===today&&matches(old.ratings,plan.ratings,13))
    return {status:'unchanged',through:plan.target,totals:plan.totals};
  const next=prepareWrite(old,plan);
  // An earlier invocation might have finished while this one was planning.
  const live=await client.snapshot();
  if(changed(live.resultsCheckpoint,old.resultsCheckpoint)||changed(live.ratingsCheckpoint,old.ratingsCheckpoint)||
    !matches(live.calendar,old.calendar,6)||!matches(live.top,old.top,7)||!matches(live.points,old.points,16)||!matches(live.wins,old.wins,8)||!matches(live.ratings,old.ratings,13)||
    live.metadata.some(m=>m.metadataId===lockId||m.metadataKey===lockKey))throw Error('Workbook changed during planning');
  await client.batch(next.apply);
  const pending=await client.snapshot({pending:true});
  safe(pending.metadata.some(m=>m.metadataId===lockId&&m.metadataValue===next.lock.metadataValue));
  verifyStandings(pending,plan,false); // Recalculated values, before sortRange.
  if(next.sort.length)await client.batch(next.sort);
  const saved=await client.snapshot({pending:true,appendCount:plan.appended.length,calendarNoteCount:Math.max(1,plan.notes.length)});
  verifyStandings(saved,plan,true);
  safe(matches(saved.calendar,plan.calendar,6)&&matches(saved.top,plan.top,7)&&matches(saved.ratings,plan.ratings,13));
  if(plan.appended.length)safe(matches(saved.stored.slice(-plan.appended.length),plan.appended,6));
  if(plan.notes.length)safe(!changed(saved.calendarNotes,plan.notes.map(n=>({...n,status:'updating'}))));
  safe(saved.calendar[0][0]===plan.calendar[0][0]&&saved.ratingsCheckpoint.through===plan.target&&saved.resultsCheckpoint.through===plan.target);
  await client.batch(next.finish);
  const final=await client.snapshot({calendarNoteCount:Math.max(1,plan.notes.length)});
  safe(final.resultsCheckpoint.through===plan.target&&final.ratingsCheckpoint.through===plan.target&&
    !final.metadata.some(m=>m.metadataId===lockId)&&final.calendarNotes.at(-1)?.date===plan.target&&final.calendarNotes.at(-1)?.status==='final');
  if(plan.notes.length)safe(!changed(final.calendarNotes,plan.notes));
  verifyStandings(final,plan,true);
  return {status:'updated',through:plan.target,totals:plan.totals,races:plan.races};
}
