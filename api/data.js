import { getArchiveResponse } from '../lib/archive.js';

export default {
  async fetch(request) {
    if (!['GET', 'HEAD'].includes(request.method)) {
      return Response.json({ error: 'Method not allowed' }, {
        status: 405,
        headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' }
      });
    }
    const response = await getArchiveResponse();
    return request.method === 'HEAD'
      ? new Response(null, { status: response.status, headers: response.headers })
      : response;
  }
};
