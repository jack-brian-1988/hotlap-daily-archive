import {ratingsResponse,methodError} from '../lib/extended.js';
export default {async fetch(request){const rejected=methodError(request);if(rejected)return rejected;const response=await ratingsResponse();return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response}};
