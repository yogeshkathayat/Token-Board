// Defense-in-depth: device tokens (opaque, non-JWT) are hashed before being
// forwarded to the API server, so they never appear in API logs or error
// traces. JWTs (3 dot-separated parts) pass through unchanged so the API can
// distinguish authentication shape.

async function handle(r) {
  const bearer = r.headersIn['Authorization'] || '';
  const token = bearer.replace(/^Bearer\s+/i, '');
  let hash = '';

  const isJwt = token && token.split('.').length === 3;

  if (token && !isJwt) {
    const data = new TextEncoder().encode(token);
    const buf = await crypto.subtle.digest('SHA-256', data);
    hash = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  const headers = {
    'Content-Type': r.headersIn['Content-Type'] || 'application/json',
    'X-Real-IP': r.remoteAddress,
    'X-Forwarded-For': r.headersIn['X-Forwarded-For'] || r.remoteAddress,
    'X-Forwarded-Proto': r.headersIn['X-Forwarded-Proto'] || 'https',
  };
  if (hash) headers['x-tokenboard-device-token-hash'] = hash;
  if (isJwt) headers['Authorization'] = 'Bearer ' + token;

  try {
    const resp = await ngx.fetch('http://api:3000/api/v1/ingest', {
      method: r.method,
      headers,
      body: r.requestBuffer,
    });
    r.headersOut['Content-Type'] = 'application/json';
    r.return(resp.status, await resp.text());
  } catch (e) {
    r.return(502, JSON.stringify({ error: 'upstream_unavailable' }));
  }
}

export default { handle };
