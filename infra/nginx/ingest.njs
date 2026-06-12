// Defense-in-depth: device tokens (opaque, non-JWT) are hashed before being
// forwarded to the API server, so they never appear in API logs or error
// traces. JWTs (3 dot-separated parts) pass through unchanged so the API can
// distinguish authentication shape.

async function handle(r) {
  const bearer = r.headersIn['Authorization'] || '';
  const token = bearer.replace(/^Bearer\s+/i, '');
  let hash = '';

  const isJwt = token && token.split('.').length === 3;
  // Hashing is on unless explicitly disabled via INGEST_BEARER_HASH=false.
  const hashEnabled = (process.env.INGEST_BEARER_HASH || 'true') !== 'false'
    && (process.env.INGEST_BEARER_HASH || 'true') !== '0';

  if (token && !isJwt && hashEnabled) {
    const data = new TextEncoder().encode(token);
    const buf = await crypto.subtle.digest('SHA-256', data);
    hash = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  const headers = {
    'Content-Type': r.headersIn['Content-Type'] || 'application/json',
    'X-Real-IP': r.remoteAddress,
    // Set from the real peer only — never trust a client-supplied X-Forwarded-For.
    'X-Forwarded-For': r.remoteAddress,
    'X-Forwarded-Proto': r.headersIn['X-Forwarded-Proto'] || 'https',
  };
  if (hash) headers['x-tokenboard-device-token-hash'] = hash;
  // When hashing is disabled, forward the raw bearer so the API can hash it.
  if (isJwt || (token && !hashEnabled)) headers['Authorization'] = 'Bearer ' + token;

  try {
    const resp = await ngx.fetch('http://api:3000/api/v1/ingest', {
      method: r.method,
      headers,
      body: r.requestBuffer,
    });
    r.headersOut['Content-Type'] = 'application/json';
    r.return(resp.status, await resp.text());
  } catch (e) {
    r.error('ingest proxy fetch failed: ' + (e.message || e));
    r.return(502, JSON.stringify({ error: 'upstream_unavailable' }));
  }
}

export default { handle };
