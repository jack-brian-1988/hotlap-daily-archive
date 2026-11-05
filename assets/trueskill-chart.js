const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortDate=s=>new Date(s+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const day=s=>Date.parse(s+'T00:00:00Z');
const requests=new WeakMap(),cache=new Map();

export function drawHistory(host,data){
 const rows=data.history;
 if(!Array.isArray(rows)||!rows.length||rows.some((p,i)=>!Number.isFinite(p.rating)||!Number.isFinite(p.mu)||!Number.isFinite(p.sigma)||p.sigma<=0||!Number.isFinite(day(p.date))||i&&p.date<=rows[i-1].date))throw Error('Invalid rating history');
 const first=rows[0],last=rows.at(-1),peak=Math.max(...rows.map(p=>p.rating)),low=Math.min(...rows.map(p=>p.rating));
 const pad=Math.max(1,(peak-low)*.12),bottom=low-pad,top=peak+pad;
 const W=640,H=250,left=48,right=620,upper=20,lower=207,t0=day(first.date),t1=day(last.date);
 const x=p=>t0===t1?(left+right)/2:left+(day(p.date)-t0)/(t1-t0)*(right-left),y=v=>lower-(v-bottom)/(top-bottom)*(lower-upper),n=v=>v.toFixed(2);
 // Hold the previous rating during absences; changes occur on race dates only.
 const path=rows.map((p,i)=>i?'H'+n(x(p))+'V'+n(y(p.rating)):'M'+n(x(p))+','+n(y(p.rating))).join(' ');
 const ticks=Array.from({length:4},(_,i)=>{const value=bottom+(top-bottom)*i/3,cy=y(value);return '<line x1="'+left+'" x2="'+right+'" y1="'+cy+'" y2="'+cy+'" class="ts-chart-grid"/><text x="'+(left-8)+'" y="'+(cy+4)+'" text-anchor="end">'+value.toFixed(1)+'</text>'}).join('');
 const dates=t0===t1?'<text x="'+x(first)+'" y="238" text-anchor="middle">'+shortDate(first.date)+'</text>':'<text x="'+left+'" y="238">'+shortDate(first.date)+'</text><text x="'+right+'" y="238" text-anchor="end">'+shortDate(last.date)+'</text>';
 host.innerHTML='<h3>TRUESKILL EVOLUTION</h3><p class="ts-chart-caption">Rating μ − 3σ · one point per recorded race · all-time history</p><div class="ts-chart-metrics"><span>FIRST <b>'+first.rating.toFixed(2)+'</b></span><span>LATEST <b>'+last.rating.toFixed(2)+'</b></span><span>BEST <b>'+peak.toFixed(2)+'</b></span></div><svg class="ts-history-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="TrueSkill rating evolution for '+escape(data.name)+' from '+shortDate(first.date)+' to '+shortDate(last.date)+'. Latest rating '+last.rating.toFixed(2)+'."><g aria-hidden="true">'+ticks+dates+'<path d="'+path+'" class="ts-chart-line"/><line class="ts-chart-cursor" y1="'+upper+'" y2="'+lower+'"/><circle class="ts-chart-point" r="5"/></g></svg><output class="ts-chart-selection" aria-live="polite"></output><label class="ts-chart-slider-label">Explore race history<input class="ts-chart-slider" aria-label="Select a recorded race to inspect its TrueSkill rating" type="range" min="0" max="'+(rows.length-1)+'" value="'+(rows.length-1)+'" step="1" '+(rows.length===1?'disabled':'')+'></label><p class="ts-chart-caption">'+rows.length+' recorded '+(rows.length===1?'race':'races')+' · source through '+shortDate(data.through)+'. Ratings stay unchanged between races, including during inactivity.</p>';
 const svg=host.querySelector('svg'),slider=host.querySelector('input'),output=host.querySelector('output'),point=host.querySelector('circle'),cursor=host.querySelector('.ts-chart-cursor');
 function select(index){const p=rows[index];slider.value=index;point.setAttribute('cx',x(p));point.setAttribute('cy',y(p.rating));cursor.setAttribute('x1',x(p));cursor.setAttribute('x2',x(p));const label=shortDate(p.date)+' · rating '+p.rating.toFixed(2)+' · μ '+p.mu.toFixed(2)+' · σ '+p.sigma.toFixed(2)+' · finish P'+p.position;output.textContent=label;slider.setAttribute('aria-valuetext',label)}
 slider.addEventListener('input',()=>select(Number(slider.value)));
 svg.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=svg.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*W;let index=0;rows.forEach((p,i)=>{if(Math.abs(x(p)-px)<Math.abs(x(rows[index])-px))index=i});select(index)});
 select(rows.length-1);
}

export async function mountTrueSkillChart(parent,name){
 requests.get(parent)?.abort();const controller=new AbortController();requests.set(parent,controller);
 const host=document.createElement('section');host.className='ts-history';parent.append(host);
 async function load(){
  host.innerHTML='<h3>TRUESKILL EVOLUTION</h3><p role="status">Loading rating history… The first request may take a few seconds.</p>';
  try{
   const key=name.trim().toLowerCase();let data=cache.get(key);
   if(!data){const response=await fetch('/api/trueskill-history?driver='+encodeURIComponent(name),{cache:'no-store',signal:controller.signal});if(response.status===404){if(!controller.signal.aborted)host.innerHTML='<h3>TRUESKILL EVOLUTION</h3><p>No saved TrueSkill history for this driver yet.</p>';return}if(!response.ok)throw Error('History unavailable');data=await response.json()}
   if(controller.signal.aborted||!host.isConnected)return;drawHistory(host,data);cache.set(key,data);if(cache.size>100)cache.delete(cache.keys().next().value);
  }catch(error){if(controller.signal.aborted)return;host.innerHTML='<h3>TRUESKILL EVOLUTION</h3><p role="status">Rating history is temporarily unavailable or still syncing.</p><button type="button">Try again</button>';host.querySelector('button').onclick=load}
 }
 await load();
}
