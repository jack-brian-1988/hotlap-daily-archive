import {handleSchedule} from '@vercel/schedules';
import {openWorkbook} from '../lib/update-source.js';
import {applyDaily} from '../lib/update-write.js';

// Private Vercel Schedule target. Never add a public rewrite to this file.
export const POST=handleSchedule(async metadata=>{
  const now=new Date();
  if(metadata.name!=='hotlap-daily-update')throw Error('Unexpected schedule');
  if(process.env.VERCEL_ENV!=='production'||process.env.HOTLAP_UPDATE_ENABLED!=='true')
    return console.log('Hotlap daily update: disabled');
  if(now.getUTCHours()!==0)
    return console.log('Hotlap daily update: outside first UTC hour');
  try{
    const result=await applyDaily({client:await openWorkbook({writable:true}),today:now.toISOString().slice(0,10)});
    console.log('Hotlap daily update',JSON.stringify(result));
  }catch(e){
    console.error('Hotlap daily update failed:',e instanceof Error?e.message:'Unknown error');
    throw Error('Hotlap scheduled update failed');
  }
});
