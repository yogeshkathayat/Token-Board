'use strict';

// Manage a background agent that runs `tokenboard sync` every 5 minutes. macOS uses a launchd
// LaunchAgent; other platforms print a cron line to add manually.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const LABEL = 'com.tokenboard.sync';
const INTERVAL = 300;

function binPath() {
  return path.resolve(__dirname, '..', '..', 'bin', 'tokenboard.js');
}

function plistPath() {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
}

function logPath() {
  return path.join(os.homedir(), 'Library', 'Logs', 'tokenboard-sync.log');
}

function renderPlist() {
  const node = process.execPath;
  const bin = binPath();
  const log = logPath();
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node}</string>
    <string>${bin}</string>
    <string>sync</string>
  </array>
  <key>StartInterval</key><integer>${INTERVAL}</integer>
  <key>RunAtLoad</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${log}</string>
  <key>StandardErrorPath</key><string>${log}</string>
</dict>
</plist>
`;
}

function launchctl(args) {
  try {
    execFileSync('launchctl', args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function install(out) {
  if (process.platform !== 'darwin') {
    out.write('Auto-sync via launchd is macOS-only. On Linux, add this to your crontab:\n');
    out.write(`  */5 * * * * ${process.execPath} ${binPath()} sync >> ${logPath()} 2>&1\n`);
    return 0;
  }
  const p = plistPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.mkdirSync(path.dirname(logPath()), { recursive: true });
  fs.writeFileSync(p, renderPlist());
  const gui = `gui/${process.getuid()}`;
  launchctl(['bootout', gui, p]); // clear any prior registration; ok if absent
  const ok = launchctl(['bootstrap', gui, p]);
  if (!ok) {
    out.write(`Wrote ${p} but launchctl bootstrap failed. Try: launchctl bootstrap ${gui} ${p}\n`);
    return 1;
  }
  out.write(`Auto-sync installed — \`tokenboard sync\` runs every ${INTERVAL / 60} min.\n`);
  out.write(`  agent: ${LABEL}\n  logs:  ${logPath()}\n`);
  return 0;
}

function uninstall(out) {
  if (process.platform !== 'darwin') {
    out.write('Remove the `*/5 * * * * tokenboard sync` line from your crontab.\n');
    return 0;
  }
  const p = plistPath();
  launchctl(['bootout', `gui/${process.getuid()}`, p]);
  try {
    fs.unlinkSync(p);
  } catch {
    /* already gone */
  }
  out.write('Auto-sync uninstalled.\n');
  return 0;
}

function status(out) {
  if (process.platform !== 'darwin') {
    out.write('Auto-sync status is only tracked on macOS (launchd).\n');
    return 0;
  }
  const running = launchctl(['print', `gui/${process.getuid()}/${LABEL}`]);
  out.write(`Auto-sync agent ${LABEL}: ${running ? 'installed' : 'not installed'}\n`);
  if (fs.existsSync(plistPath())) out.write(`  plist: ${plistPath()}\n`);
  return 0;
}

async function run(argv) {
  const out = process.stdout;
  const sub = (argv && argv[0]) || 'status';
  if (sub === 'install') return install(out);
  if (sub === 'uninstall') return uninstall(out);
  if (sub === 'status') return status(out);
  out.write('Usage: tokenboard autosync <install|uninstall|status>\n');
  return 2;
}

module.exports = { run, LABEL, INTERVAL, renderPlist, binPath };
