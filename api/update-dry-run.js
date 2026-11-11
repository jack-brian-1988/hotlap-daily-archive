import {planUpdate} from '../lib/update-plan.js';
import {readSnapshot} from '../lib/update-source.js';

export default {async fetch(request){
  const url=new URL(request.url);
  const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex'};
  if(request.method!=='GET'||process.env.VERCEL_ENV!=='production'||url.hostname!==process.env.VERCEL_URL)
    return Response.json({ok:false},{status:404,headers});
  try {
    const today=new Date().toISOString().slice(0,10);
    const result=await planUpdate(await readSnapshot(),today);
    const {target,previous,races,requests,totals}=result;
    return Response.json({ok:true,readOnly:true,target,previous,races,classificationDatesFetched:requests,totals},{headers});
  }catch(e){
    const reason=e instanceof Error?e.message:'Unknown dry-run error';
    console.error('Hotlap dry run failed:',reason);
    return Response.json({ok:false,readOnly:true,reason},{status:502,headers});
  }
}};
