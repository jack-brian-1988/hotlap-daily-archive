import {raceResponse,methodError} from '../lib/extended.js';
export default {async fetch(request){const rejected=methodError(request);if(rejected)return rejected;const response=await raceResponse(new URL(request.url).searchParams.get('date')||'');return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response}};
