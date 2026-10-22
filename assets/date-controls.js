export const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const pad=n=>String(n).padStart(2,'0');
export function mountDateControl(container,input,{firstYear,lastYear,label}){
  container.innerHTML='<select aria-label="'+label+' day" class="date-day"></select><select aria-label="'+label+' month" class="date-month"></select><select aria-label="'+label+' year" class="date-year"></select>';
  const day=container.querySelector('.date-day'),month=container.querySelector('.date-month'),year=container.querySelector('.date-year');
  month.innerHTML=MONTHS.map((name,i)=>'<option value="'+pad(i+1)+'">'+name+'</option>').join('');
  year.innerHTML=Array.from({length:lastYear-firstYear+1},(_,i)=>'<option value="'+(firstYear+i)+'">'+(firstYear+i)+'</option>').join('');
  function refreshDays(wanted){const count=new Date(Date.UTC(Number(year.value),Number(month.value),0)).getUTCDate();day.innerHTML=Array.from({length:count},(_,i)=>'<option value="'+pad(i+1)+'">'+(i+1)+'</option>').join('');day.value=pad(Math.min(wanted||1,count))}
  function write(){input.value=year.value+'-'+month.value+'-'+day.value;input.dispatchEvent(new Event('change',{bubbles:true}))}
  function set(value){const [y,m,d]=value.split('-');year.value=y;month.value=m;refreshDays(Number(d));input.value=value}
  month.onchange=year.onchange=()=>{refreshDays(Number(day.value));write()};day.onchange=write;
  set(input.value);return {set};
}
export function fillMonths(select,start,end,value){const months=[];let y=Number(start.slice(0,4)),m=Number(start.slice(5,7));const last=end.slice(0,7);while(y+'-'+pad(m)<=last){const key=y+'-'+pad(m);months.push('<option value="'+key+'">'+MONTHS[m-1]+' '+y+'</option>');if(++m>12){m=1;y++}}select.innerHTML=months.join('');select.value=value;}
