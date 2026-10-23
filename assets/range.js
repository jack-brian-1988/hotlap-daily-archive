const dayNumber=date=>Date.parse(date+'T00:00:00Z')/86400000;
export function quickRange(kind,today,latest){
  if(kind==='last7'){const end=latest<today?latest:today;const start=new Date((dayNumber(end)-6)*86400000).toISOString().slice(0,10);return {start,end}}
  if(kind==='month')return {start:today.slice(0,7)+'-01',end:today};
  if(kind==='year')return {start:today.slice(0,4)+'-01-01',end:today};
  throw Error('Unknown quick range');
}
export function filterArchive(source,start,end){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||!Number.isFinite(dayNumber(start))||!Number.isFinite(dayNumber(end))||start>end)throw Error('Choose a valid start and end date.');
  const calendar=source.calendar.filter(d=>d.date>=start&&d.date<=end).map(d=>({...d})).sort((a,b)=>a.date.localeCompare(b.date));
  const daily=source.daily.filter(r=>r[0]>=start&&r[0]<=end);
  const originals=new Map(source.drivers.map(d=>[d.name.toLowerCase(),d]));
  const totals=new Map();
  for(const row of daily){const [date,position,name,,points]=row,key=name.toLowerCase();let driver=totals.get(key);if(!driver){driver={name:originals.get(key)?.name||name,points:0,wins:0,entries:0,places:Array(10).fill(0),streak:0,streakStart:'',streakEnd:'',days:new Set()};totals.set(key,driver)}driver.points+=points;driver.places[position-1]++;driver.wins+=Number(position===1);driver.days.add(date)}
  let previous=null,runStart='';
  for(const day of calendar){const consecutive=day.drivers>0&&previous?.drivers>0&&day.winner.toLowerCase()===previous.winner.toLowerCase()&&dayNumber(day.date)-dayNumber(previous.date)===1;if(!consecutive)runStart=day.date;day.streak=day.drivers?(consecutive?previous.streak+1:1):0;const winner=totals.get(day.winner.toLowerCase());if(winner&&day.streak>winner.streak){winner.streak=day.streak;winner.streakStart=runStart;winner.streakEnd=day.date}previous=day}
  const drivers=[...totals.values()].map(({days,...d})=>({...d,entries:days.size})).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
  let rank=0,last;drivers.forEach((d,i)=>{if(d.points!==last)rank=i+1;last=d.points;d.rank=rank});
  return withPodiumStreaks({...source,drivers,calendar,daily,filtered:true,period:{start,end}});
}

// One podium per driver per UTC day; gaps always break the streak.
export function withPodiumStreaks(archive){
  const runs=new Map();
  for(const [date,position,name] of [...archive.daily].filter(r=>r[1]>=1&&r[1]<=3).sort((a,b)=>a[0].localeCompare(b[0]))){
    const key=name.toLowerCase();let run=runs.get(key);
    if(!run){run={last:null,current:0,start:'',best:0,bestStart:'',bestEnd:''};runs.set(key,run)}
    if(run.last===date)continue;
    const consecutive=run.last&&dayNumber(date)-dayNumber(run.last)===1;
    run.current=consecutive?run.current+1:1;if(!consecutive)run.start=date;
    if(run.current>run.best){run.best=run.current;run.bestStart=run.start;run.bestEnd=date}run.last=date;
  }
  return {...archive,drivers:archive.drivers.map(d=>{const r=runs.get(d.name.toLowerCase());return {...d,podiumStreak:r?.best||0,podiumStreakStart:r?.bestStart||'',podiumStreakEnd:r?.bestEnd||''}})};
}
