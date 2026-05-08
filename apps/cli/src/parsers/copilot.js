'use strict';

const fs = require('fs');

const cursors = require('../lib/cursors.js');
const { BucketAggregator } = require('../lib/buckets.js');

const SOURCE = 'copilot';

/**
 * GitHub Copilot writes OpenTelemetry JSONL when COPILOT_OTEL_FILE_EXPORTER_PATH
 * is set. Each line is a span; spans of name "chat.completion" carry
 * usage attributes (gen_ai.usage.input_tokens, output_tokens, model).
 */

function exporterPath() {
  return process.env.COPILOT_OTEL_FILE_EXPORTER_PATH || '';
}

async function detect() {
  const p = exporterPath();
  if (!p) return false;
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function attr(span, key) {
  if (!span?.attributes) return null;
  if (Array.isArray(span.attributes)) {
    const found = span.attributes.find((a) => a.key === key);
    return found?.value?.intValue ?? found?.value?.stringValue ?? null;
  }
  return span.attributes[key] ?? null;
}

async function parse() {
  const file = exporterPath();
  if (!file) return [];

  const state = cursors.get(SOURCE);
  state.files = state.files || {};
  let prev = state.files[file];
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return [];
  }
  if (!prev || prev.size > stat.size) prev = { offset: 0, size: 0 };
  if (stat.size <= prev.offset) {
    state.files[file] = { offset: prev.offset, size: stat.size };
    cursors.set(SOURCE, state);
    return [];
  }

  const fd = fs.openSync(file, 'r');
  const agg = new BucketAggregator();
  try {
    const len = stat.size - prev.offset;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, prev.offset);
    const text = buf.toString('utf8');
    const lastNl = text.lastIndexOf('\n');
    const usable = lastNl >= 0 ? text.slice(0, lastNl) : text;
    const consumed = lastNl >= 0 ? lastNl + 1 : 0;
    for (const line of usable.split('\n')) {
      if (!line) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      const spans = row?.resourceSpans?.[0]?.scopeSpans?.[0]?.spans ?? row?.spans ?? [];
      for (const span of spans) {
        const name = span?.name || '';
        if (!name.includes('completion') && !name.includes('chat')) continue;
        const ts = span?.startTimeUnixNano
          ? new Date(Number(BigInt(span.startTimeUnixNano) / 1_000_000n)).toISOString()
          : null;
        if (!ts) continue;
        const model = String(attr(span, 'gen_ai.request.model') || attr(span, 'model') || 'copilot');
        const inTok = Number(attr(span, 'gen_ai.usage.input_tokens') || 0);
        const outTok = Number(attr(span, 'gen_ai.usage.output_tokens') || 0);
        if (inTok + outTok <= 0) continue;
        agg.add(SOURCE, model, ts, { input_tokens: inTok, output_tokens: outTok });
      }
    }
    state.files[file] = { offset: prev.offset + consumed, size: stat.size };
  } finally {
    fs.closeSync(fd);
  }

  cursors.set(SOURCE, state);
  return agg.values();
}

module.exports = { source: SOURCE, detect, parse };
