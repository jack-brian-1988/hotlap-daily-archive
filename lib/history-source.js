import {createHash} from 'node:crypto';
import {querySheet,ratingsResponse,validDate} from './extended.js';
import {driverKey,replayHistory} from './rating-history.js';

const headers={'Cache-Control':'private, no-store'};
export function validateHistory(players,rows){
 if(players.size!==rows.length)throw Error('History coverage mismatch');
 for(const row of rows){const p=players.get(driverKey(row[1])),end=p?.history.at(-1);
  if(!end||p.history.length!==row[7]||p.history[0].date!==row[8]||end.date!==row[9]||Math.abs(end.mu-row[5])>1e-6||Math.abs(end.sigma-row[6])>1e-6)throw Error('History does not match saved ratings');
 }
}
export function createHistoryReader({readRatings=ratingsResponse,readRows=querySheet,replay=replayHistory}={}){
 let cache,inflight;
 return async name=>{
  const result=await readRatings();if(!result.ok)throw Error('Ratings unavailable');
  const snapshot=await result.json(),key=driverKey(name);
  if(!validDate(snapshot.lastRace))throw Error('Invalid history coverage');
  if(!snapshot.rows.some(r=>driverKey(r[1])===key))return null;
  const fingerprint=createHash('sha256').update(JSON.stringify(snapshot.rows)).digest('hex');
  if(!cache||cache.fingerprint!==fingerprint||Date.now()-cache.at>300000){
   // Coalesce all profile reads while a full replay is being built.
   if(inflight&&inflight.fingerprint!==fingerprint)await inflight.promise;
   if(!inflight){const promise=(async()=>{
    const rows=await readRows(Number(process.env.FULL_RESULTS_SHEET_GID||1751763858),"select A,B,C where A <= '"+snapshot.lastRace+"' order by A,B");
    const players=replay(rows);validateHistory(players,snapshot.rows);
    cache={players,fingerprint,at:Date.now(),through:snapshot.lastRace};
   })();inflight={fingerprint,promise};promise.finally(()=>{if(inflight?.promise===promise)inflight=null}).catch(()=>{});}
   await inflight.promise;
  }
  return {name,through:cache.through,history:cache.players.get(key).history};
 }
}
const readHistory=createHistoryReader();
export async function historyResponse(name){
 if(typeof name!=='string'||!name.trim()||name.length>512)return Response.json({error:'Choose a valid driver.'},{status:400,headers});
 try{const data=await readHistory(name);return data?Response.json(data,{headers}):Response.json({error:'No saved TrueSkill history for this driver.'},{status:404,headers})}
 catch{return Response.json({error:'TrueSkill history is temporarily unavailable or still syncing. Please try again shortly.'},{status:503,headers})}
}
