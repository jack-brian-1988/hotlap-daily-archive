const sourceId=process.env.GOOGLE_SHEETS_ID||'';
const fullGid=Number(process.env.FULL_RESULTS_SHEET_GID||1751763858),ratingsGid=Number(process.env.FULL_RATINGS_SHEET_GID||924913483);
const headers={'Cache-Control':'private, no-store'};
const cache=new Map(),pending=new Map();
export function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s}
export async function querySheet(gid,query){
 if(!/^[a-zA-Z0-9_-]+$/.test(sourceId)||!Number.isSafeInteger(gid))throw Error('Source not configured');
 const url='https://docs.google.com/spreadsheets/d/'+sourceId+'/gviz/tq?gid='+gid+'&headers=1&tqx=out:json&tq='+encodeURIComponent(query);
 const response=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('Source unavailable');
 const text=await response.text();if(text.length>20_000_000)throw Error('Oversized source');
 const first=text.indexOf('{'),last=text.lastIndexOf('}');if(first<0||last<first)throw Error('Invalid source');
 const data=JSON.parse(text.slice(first,last+1));if(data.status!=='ok'||!Array.isArray(data.table?.rows))throw Error('Invalid source response');
 return data.table.rows.map(row=>(row.c||[]).map(cell=>cell?.v??null));
}
async function cachedRead(key,read){const now=Date.now(),hit=cache.get(key);if(hit&&now-hit.at<30000)return hit.data;
 if(!pending.has(key)){pending.set(key,read().then(data=>{if(cache.size>=64&&!cache.has(key))cache.delete(cache.keys().next().value);cache.set(key,{data,at:Date.now()});return data}).finally(()=>pending.delete(key)))}return pending.get(key)}
export function methodError(request){if(!['GET','HEAD'].includes(request.method))return Response.json({error:'Method not allowed'},{status:405,headers:{...headers,Allow:'GET, HEAD'}})}
export async function raceResponse(date){
 if(!validDate(date)||date>new Date().toISOString().slice(0,10))return Response.json({error:'Choose a valid completed race date.'},{status:400,headers});
 try{const data=await cachedRead('race:'+date,async()=>{
  const rows=await querySheet(fullGid,"select A,B,C,D where A = '"+date+"' order by B");const seen=new Set();
  const results=rows.map((r,i)=>{const [day,position,name,lap]=r;if(day!==date||position!==i+1||typeof name!=='string'||!name.trim()||!Number.isFinite(lap)||lap<0||seen.has(name.trim().toLowerCase())||(i&&lap<rows[i-1][3]))throw Error('Invalid classification');seen.add(name.trim().toLowerCase());return {position,name,lap:String(lap),points:Math.max(0,11-position)}});
  return {date,total:results.length,results,fetchedAt:new Date().toISOString()};});return Response.json(data,{headers});
 }catch{return Response.json({error:'The full classification is temporarily unavailable. Please try again shortly.'},{status:503,headers})}
}
export async function ratingsResponse(){
 try{const data=await cachedRead('ratings',async()=>{
  const input=await querySheet(ratingsGid,'select B,E,F,G,H,I,J'),seen=new Set();let lastRace='';
  const rows=input.map(r=>{const [name,score,mu,sigma,n,first,last]=r;if(typeof name!=='string'||!name.trim()||seen.has(name.trim().toLowerCase())||![score,mu,sigma,n].every(Number.isFinite)||sigma<=0||!Number.isInteger(n)||n<1||!validDate(first)||!validDate(last)||first>last||Math.abs(score-(mu-3*sigma))>1e-8)throw Error('Invalid ratings');seen.add(name.trim().toLowerCase());if(last>lastRace)lastRace=last;return [null,name,null,null,score,mu,sigma,n,first,last]});
  if(!rows.length)throw Error('Empty ratings');return {rows,lastRace,fetchedAt:new Date().toISOString()};});return Response.json(data,{headers});
 }catch{return Response.json({error:'TrueSkill ratings are temporarily unavailable. Please try again shortly.'},{status:503,headers})}
}
