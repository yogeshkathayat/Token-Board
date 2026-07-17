'use strict';

const fs = require('node:fs');

// Incrementally read complete new lines appended to a file since the previous
// cursor. Resets to offset 0 when the inode changes (rotation) or the file is
// smaller than the recorded offset (truncation). Never returns a partial
// trailing line — the byte offset stops at the last newline so a line still
// being written is picked up on the next run.
function readNewLines(filePath, prev) {
  let st;
  try {
    st = fs.statSync(filePath);
  } catch {
    return null;
  }
  if (!st.isFile()) return null;

  const inode = st.ino || 0;
  const size = st.size;
  const sameInode = prev && prev.inode === inode;
  let startOffset = sameInode ? Number(prev.offset) || 0 : 0;
  if (startOffset > size) startOffset = 0; // truncated

  if (startOffset >= size) {
    return { lines: [], cursor: { inode, offset: size } };
  }

  const fd = fs.openSync(filePath, 'r');
  try {
    const len = size - startOffset;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, startOffset);
    const lastNl = buf.lastIndexOf(0x0a);
    if (lastNl === -1) {
      return { lines: [], cursor: { inode, offset: startOffset } };
    }
    const consumed = lastNl + 1;
    const text = buf.slice(0, consumed).toString('utf8');
    const lines = [];
    for (const line of text.split('\n')) {
      if (line) lines.push(line);
    }
    return { lines, cursor: { inode, offset: startOffset + consumed } };
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { readNewLines };
