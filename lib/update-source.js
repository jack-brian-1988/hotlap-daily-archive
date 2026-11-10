import {getVercelOidcToken} from '@vercel/oidc';

const provider='/projects/722275557561/locations/global/workloadIdentityPools/vercel-hotlap/providers/vercel';
const audience='https://iam.googleapis.com'+provider;
const account='hotlap-updater@hotlap-daily-data-update.iam.gserviceaccount.com';
const scope='https://www.googleapis.com/auth/spreadsheets.readonly';

async function json(url, options, stage, request) {
  const r=await request(url,{...options,redirect:'error',signal:AbortSignal.timeout(25000)});
  if(!r.ok)throw new Error(stage+' HTTP '+r.status);
  return r.json();
}

export async function openWorkbook({request=fetch, token=getVercelOidcToken, sheet=process.env.GOOGLE_SHEETS_ID, writable=false}={}) {
  if(typeof sheet!=='string'||!/^[-\w]{25,100}$/.test(sheet))throw Error('Unexpected workbook configuration');
  const jwt=await token({audience});
  const claims=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url'));
  if(claims.iss!=='https://oidc.vercel.com/dcarracedopais'||claims.sub!=='owner:dcarracedopais:project:hotlap-daily-archive:environment:production'||claims.aud!==audience)throw Error('Unexpected Vercel identity');
  const sts=await json('https://sts.googleapis.com/v1/token',{method:'POST',body:new URLSearchParams({
    audience:'//iam.googleapis.com'+provider,scope:'https://www.googleapis.com/auth/cloud-platform',
    grant_type:'urn:ietf:params:oauth:grant-type:token-exchange',requested_token_type:'urn:ietf:params:oauth:token-type:access_token',
    subject_token_type:'urn:ietf:params:oauth:token-type:jwt',subject_token:jwt,
  })},'STS',request);
  if(!sts.access_token)throw Error('STS missing access token');
  const iam=await json('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'+account+':generateAccessToken',{
    method:'POST',headers:{Authorization:'Bearer '+sts.access_token,'Content-Type':'application/json'},
    body:JSON.stringify({scope:[writable?'https://www.googleapis.com/auth/spreadsheets':scope],lifetime:'600s'}),
  },'IAM',request);
  if(!iam.accessToken)throw Error('IAM missing access token');
  const root='https://sheets.googleapis.com/v4/spreadsheets/'+sheet;
  const get=(path,params)=>json(root+path+'?'+params,{
    headers:{Authorization:'Bearer '+iam.accessToken},
  },'Sheets',request);
  const batch=async requests=>{
    if(!writable)throw Error('Read-only workbook client');
    if(!requests.length)return;
    await json(root+':batchUpdate',{method:'POST',headers:{Authorization:'Bearer '+iam.accessToken,'Content-Type':'application/json'},
      body:JSON.stringify({requests})},'Sheets write',request);
  };
  const snapshot=async ({pending=false,appendCount=0,calendarNoteCount=1}={})=>{
  const props=await get('',new URLSearchParams({fields:'spreadsheetId,properties(title),developerMetadata(metadataId,metadataKey,metadataValue),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),basicFilter)'}));
  if(props.spreadsheetId!==sheet||props.properties?.title!=='Hotlap Daily — All-time Wins and Points')throw Error('Unexpected workbook identity');
  const sheets=new Map(props.sheets.map(s=>[s.properties.title,s.properties]));
  for(const [title,id] of [['Points',801946561],['Wins',1479199503],['Calendar',2076106737],['Daily Top 10',816613409],['Full Results',1751763858],['Full Ratings',924913483]])
    if(sheets.get(title)?.sheetId!==id)throw Error('Unexpected tab identity');
  const rows=(title)=>sheets.get(title).gridProperties.rowCount;
  const ranges=(rs,render='UNFORMATTED_VALUE')=>{
    const q=new URLSearchParams({valueRenderOption:render,dateTimeRenderOption:'SERIAL_NUMBER'});
    for(const r of rs)q.append('ranges',r);
    return get('/values:batchGet',q).then(x=>x.valueRanges.map(r=>r.values??[]));
  };
  const notes=async rs=>{
    const q=new URLSearchParams({fields:'sheets(properties(title),data(startRow,rowData(values(note))))'});
    for(const r of rs)q.append('ranges',r);
    const x=await get('',q);
    return new Map(x.sheets.map(s=>[s.properties.title,s.data[0].rowData?.map(r=>r.values?.[0]?.note?JSON.parse(r.values[0].note):null)??[]]));
  };
  const [[calendar,top],checkpoints]=await Promise.all([
    ranges([`Calendar!A8:F${rows('Calendar')}`,`'Daily Top 10'!A8:G${rows('Daily Top 10')}`]),
    notes(["'Full Results'!A1","'Full Ratings'!A1"]),
  ]);
  const rc=checkpoints.get('Full Results')?.[0],tc=checkpoints.get('Full Ratings')?.[0];
  if(rc?.status!==(pending?'updating':'final')||tc?.status!==(pending?'updating':'final')||!calendar.length||
    !Number.isInteger(rc.rows)||rc.rows+1>rows('Full Results')||!Number.isInteger(tc.drivers)||tc.drivers+1>rows('Full Ratings'))throw Error('Incomplete workbook checkpoints');
  const finalCal=7+calendar.length, last=calendar.at(-1)[0];
  const today=Math.floor(Date.now()/86400000)+25569, oldest=Math.min(last,Date.parse(tc.through)/86400000+25569,Date.parse(rc.through)/86400000+25569);
  if(!Number.isInteger(oldest)||today-oldest>32)throw Error('Pending date window invalid');
  const chunks=async (title,from,to,col)=>{
    const queries=[];
    for(let start=from;start<=to;start+=2500)queries.push(`'${title}'!A${start}:${col}${Math.min(to,start+2499)}`);
    const out=[];
    for(let i=0;i<queries.length;i+=3)out.push(...(await ranges(queries.slice(i,i+3))).flat());
    return out;
  };
  const cutoff=new Date((oldest-25569)*86400000).toISOString().slice(0,10);
  const tail=Math.max(2,rc.rows-31999);
  const [points,wins,ratings,stored,calNotes]=await Promise.all([
    chunks('Points',8,rows('Points'),'P'),chunks('Wins',8,rows('Wins'),'H'),
    chunks('Full Ratings',2,tc.drivers+1,'M'),appendCount?chunks('Full Results',rc.rows+2-appendCount,rc.rows+1,'F'):rc.through>cutoff?chunks('Full Results',tail,rc.rows+1,'F'):[],
    notes([`Calendar!B${finalCal-calendarNoteCount+1}:B${finalCal}`]),
  ]);
  return {calendar,top,points,wins,ratings,stored:appendCount?stored:stored.filter(r=>r[0]>cutoff),calendarNotes:calNotes.get('Calendar'),resultsCheckpoint:rc,ratingsCheckpoint:tc,
    grids:Object.fromEntries(props.sheets.map(s=>[s.properties.title,{rows:s.properties.gridProperties.rowCount,filter:s.basicFilter}])),metadata:props.developerMetadata??[]};
  };
  return {snapshot,batch};
}

export async function readSnapshot(options){return (await openWorkbook(options)).snapshot()}
