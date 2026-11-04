const day=s=>Date.parse(s+'T00:00:00Z')/86400000;
export function prepareRatings(rows,today){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(today)||!Number.isFinite(day(today)))throw Error('Invalid activity date');
 const drivers=rows.map(r=>{
  const [,, , , conservative,mu,sigma,races,first,last]=r;
  if(!r[1]||![conservative,mu,sigma,races].every(Number.isFinite)||sigma<=0||races<1||!Number.isFinite(day(last))||day(last)>day(today))throw Error('Invalid rating row');
  const daysAway=day(today)-day(last),inactive=daysAway>=30,provisional=races<10;
  return {name:r[1],conservative,mu,sigma,races,first,last,daysAway,inactive,provisional,rank:null};
 });
 const established=drivers.filter(d=>!d.inactive&&!d.provisional).sort((a,b)=>b.conservative-a.conservative||a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
 let rank=0,previous;established.forEach((d,i)=>{if(d.conservative!==previous)rank=i+1;previous=d.conservative;d.rank=rank});
 return {drivers,established,active:established.length,provisional:drivers.filter(d=>!d.inactive&&d.provisional).length,inactive:drivers.filter(d=>d.inactive).length};
}
export function selectRatings(drivers,{status='active',query='',sort='conservative',direction=-1}={}){
 return drivers.filter(d=>(status==='all'||status==='inactive'&&d.inactive||status==='provisional'&&!d.inactive&&d.provisional||status==='active'&&!d.inactive&&!d.provisional)&&d.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>direction*(sort==='name'?a.name.localeCompare(b.name,'en',{sensitivity:'base'}):sort==='last'?a.last.localeCompare(b.last):a[sort]-b[sort])||a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
}
