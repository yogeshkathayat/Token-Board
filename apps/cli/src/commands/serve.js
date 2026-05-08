'use strict';

/**
 * Local development dashboard. Starts a tiny HTTP server on port 7680 that
 * serves a minimal "queue inspector" so users can poke at what would be
 * uploaded. The hosted dashboard is the real UI; this is mostly for
 * debugging and offline use.
 */
const http = require('http');
const fs = require('fs');

const { paths } = require('../lib/paths.js');
const { loadQueueState } = require('../lib/queue.js');
const throttle = require('../lib/throttle.js');

const DEFAULT_PORT = 7680;

async function run(argv) {
  const port = Number(argv.find((a) => a.startsWith('--port='))?.split('=')[1] ?? DEFAULT_PORT) || DEFAULT_PORT;
  const server = http.createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200);
      res.end('ok');
      return;
    }
    if (req.url === '/queue.jsonl') {
      try {
        const stream = fs.createReadStream(paths().queue);
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
        stream.pipe(res);
        return;
      } catch {
        res.writeHead(404);
        res.end();
        return;
      }
    }
    if (req.url === '/status.json') {
      const body = {
        queueState: loadQueueState(),
        throttle: throttle.loadState(),
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body, null, 2));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><meta charset=utf-8><title>tokenboard</title>
<body style="font:14px system-ui;padding:2rem">
<h1>tokenboard — local dev</h1>
<p>This is a minimal local view. The full dashboard runs on your team's hosted instance.</p>
<ul>
  <li><a href="/status.json">/status.json</a></li>
  <li><a href="/queue.jsonl">/queue.jsonl</a> (raw NDJSON of pending buckets)</li>
</ul>
</body>`);
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`tokenboard serving on http://127.0.0.1:${port}`);
  });
}

module.exports = { run };
