import {methodError} from '../lib/extended.js';
import {historyResponse} from '../lib/history-source.js';
export default {async fetch(request){const rejected=methodError(request);if(rejected)return rejected;const response=await historyResponse(new URL(request.url).searchParams.get('driver'));return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response}};
