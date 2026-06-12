'use strict';

/**
 * Minimal HTTP client around fetch. Adds:
 *   — backend base URL prefixing
 *   — Bearer authorization
 *   — request timeout (TOKENBOARD_HTTP_TIMEOUT_MS, default 20s)
 *   — debug logging when TOKENBOARD_DEBUG=1
 */

function timeoutMs() {
  const raw = Number(process.env.TOKENBOARD_HTTP_TIMEOUT_MS);
  if (!Number.isFinite(raw)) return 20_000;
  if (raw <= 0) return 0;
  return Math.max(1000, Math.min(120_000, raw));
}

async function request({ baseUrl, path, method = 'GET', token, body, headers }) {
  if (!baseUrl) throw new Error('Backend URL not configured. Run `tokenboard init` first.');
  const url = new URL(path, baseUrl).toString();
  const ms = timeoutMs();
  const controller = ms > 0 ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), ms) : null;

  const t0 = Date.now();
  try {
    // Fastify rejects requests that declare Content-Type: application/json
    // with an empty body — only send the header when we actually have a body.
    const baseHeaders = {
      Accept: 'application/json',
      'User-Agent': 'tokenboard-cli',
    };
    if (body !== undefined) baseHeaders['Content-Type'] = 'application/json';
    if (token) baseHeaders.Authorization = `Bearer ${token}`;
    const res = await fetch(url, {
      method,
      headers: Object.assign(baseHeaders, headers || {}),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller?.signal,
    });
    const text = await res.text();
    const elapsed = Date.now() - t0;
    if (process.env.TOKENBOARD_DEBUG) {
      process.stderr.write(`[http] ${method} ${path} → ${res.status} (${elapsed}ms)\n`);
    }
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} on ${method} ${path}: ${json?.message || text}`);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

module.exports = { request, timeoutMs };
