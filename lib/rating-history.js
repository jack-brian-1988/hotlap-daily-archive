import {TrueSkill} from 'ts-trueskill';

// Match the Python 0.4.5 environment used by the stored rating updater.
export function driverKey(name){return name.trim().toLowerCase().replace(/^hoozah!\s+🕶️$/u,'hoozah! 🕶️')}
export function replayHistory(rows){
 const env=new TrueSkill(25,25/3,25/6,25/300,0),players=new Map();
 let previousDate='',previousPosition=0,dayRows=[];
 function closeDay(){
  if(!dayRows.length)return;
  const seen=new Set(),grid=[];
  for(const [date,position,name] of dayRows){const key=driverKey(name);if(seen.has(key))continue;seen.add(key);
   if(!players.has(key))players.set(key,{rating:env.createRating(),history:[]});
   grid.push({date,position,player:players.get(key)});
  }
  const rated=grid.length>1?env.rate(grid.map(r=>[r.player.rating]),grid.map(r=>r.position)):grid.map(r=>[r.player.rating]);
  grid.forEach((r,i)=>{const {mu,sigma}=rated[i][0];if(!Number.isFinite(mu)||!Number.isFinite(sigma)||sigma<=0)throw Error('Invalid rating calculation');r.player.rating=rated[i][0];r.player.history.push({date:r.date,rating:mu-3*sigma,mu,sigma,position:r.position})});
 }
 for(const row of rows){const [date,position,name]=row;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||typeof name!=='string'||!name.trim()||!Number.isInteger(position)||position<1||date<previousDate)throw Error('Invalid history classification');
  if(date!==previousDate){closeDay();dayRows=[];previousPosition=0;previousDate=date}
  if(position!==previousPosition+1)throw Error('Incomplete history classification');previousPosition=position;dayRows.push(row);
 }
 closeDay();return players;
}
