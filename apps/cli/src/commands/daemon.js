'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const { paths } = require('../lib/paths.js');

const LABEL = 'com.tokenboard.sync';
const INTERVAL_SECONDS = 600; // 10 minutes
const LAUNCHD_PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const SYSTEMD_UNIT_DIR = path.join(os.homedir(), '.config', 'systemd', 'user');
const SYSTEMD_SERVICE = path.join(SYSTEMD_UNIT_DIR, 'tokenboard.service');
const SYSTEMD_TIMER = path.join(SYSTEMD_UNIT_DIR, 'tokenboard.timer');

function nodeBinary() {
  return process.execPath;
}

/**
 * Resolve the path to bin/tracker.js. When the CLI was installed via
 * `npm i -g`, this is a stable absolute path. When invoked via npx, the
 * path is in a tmp dir and won't survive — warn the user.
 */
function resolveCliBin() {
  // process.argv[1] is bin/tracker.js when running through node.
  const argv1 = process.argv[1];
  if (argv1 && fs.existsSync(argv1)) return argv1;
  return null;
}

function macosPlistBody({ node, cli, logFile }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node}</string>
    <string>${cli}</string>
    <string>sync</string>
    <string>--quiet</string>
  </array>
  <key>StartInterval</key>
  <integer>${INTERVAL_SECONDS}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${logFile}</string>
  <key>StandardErrorPath</key>
  <string>${logFile}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
  </dict>
</dict>
</plist>
`;
}

function systemdServiceBody({ node, cli }) {
  return `[Unit]
Description=tokenboard sync (one-shot)

[Service]
Type=oneshot
ExecStart=${node} ${cli} sync --quiet
`;
}

function systemdTimerBody() {
  return `[Unit]
Description=Run tokenboard sync every 10 minutes

[Timer]
OnBootSec=60
OnUnitActiveSec=${INTERVAL_SECONDS}
Persistent=true
Unit=tokenboard.service

[Install]
WantedBy=timers.target
`;
}

async function installMacos(cli) {
  const body = macosPlistBody({ node: nodeBinary(), cli, logFile: paths().logFile });
  fs.mkdirSync(path.dirname(LAUNCHD_PLIST), { recursive: true });
  fs.writeFileSync(LAUNCHD_PLIST, body, { mode: 0o644 });
  // unload (idempotent), then load.
  spawnSync('launchctl', ['unload', LAUNCHD_PLIST], { stdio: 'ignore' });
  const r = spawnSync('launchctl', ['load', LAUNCHD_PLIST], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`launchctl load failed: ${r.stderr || r.stdout}`);
  }
  console.log(`✓ launchd agent installed at ${LAUNCHD_PLIST}`);
  console.log(`  syncs every ${INTERVAL_SECONDS / 60} min, logs to ${paths().logFile}`);
}

async function uninstallMacos() {
  if (!fs.existsSync(LAUNCHD_PLIST)) {
    console.log('No daemon installed.');
    return;
  }
  spawnSync('launchctl', ['unload', LAUNCHD_PLIST], { stdio: 'ignore' });
  fs.unlinkSync(LAUNCHD_PLIST);
  console.log('✓ launchd agent removed');
}

async function statusMacos() {
  if (!fs.existsSync(LAUNCHD_PLIST)) {
    console.log('Daemon: not installed.');
    return;
  }
  const r = spawnSync('launchctl', ['list', LABEL], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.log('Daemon: plist exists but is not loaded. Run `tokenboard daemon install` to reload.');
    return;
  }
  console.log('Daemon: loaded.');
  console.log(r.stdout.trim());
  console.log(`Plist: ${LAUNCHD_PLIST}`);
  console.log(`Logs:  ${paths().logFile}`);
}

async function installLinux(cli) {
  fs.mkdirSync(SYSTEMD_UNIT_DIR, { recursive: true });
  fs.writeFileSync(SYSTEMD_SERVICE, systemdServiceBody({ node: nodeBinary(), cli }));
  fs.writeFileSync(SYSTEMD_TIMER, systemdTimerBody());
  // reload + enable + start
  for (const cmd of [
    ['daemon-reload'],
    ['enable', '--now', 'tokenboard.timer'],
  ]) {
    const r = spawnSync('systemctl', ['--user', ...cmd], { encoding: 'utf8' });
    if (r.status !== 0) {
      throw new Error(`systemctl --user ${cmd.join(' ')} failed: ${r.stderr || r.stdout}`);
    }
  }
  console.log('✓ systemd user units installed');
  console.log(`  ${SYSTEMD_SERVICE}`);
  console.log(`  ${SYSTEMD_TIMER}`);
  console.log('  syncs every 10 min after first boot');
}

async function uninstallLinux() {
  if (!fs.existsSync(SYSTEMD_TIMER)) {
    console.log('No daemon installed.');
    return;
  }
  spawnSync('systemctl', ['--user', 'disable', '--now', 'tokenboard.timer'], { stdio: 'ignore' });
  for (const f of [SYSTEMD_TIMER, SYSTEMD_SERVICE]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
  spawnSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'ignore' });
  console.log('✓ systemd user units removed');
}

async function statusLinux() {
  if (!fs.existsSync(SYSTEMD_TIMER)) {
    console.log('Daemon: not installed.');
    return;
  }
  const r = spawnSync('systemctl', ['--user', 'status', 'tokenboard.timer'], { encoding: 'utf8' });
  console.log(r.stdout || r.stderr);
}

function printHelp() {
  console.log(`tokenboard daemon — background sync every 10 minutes

Usage:
  tokenboard daemon install     Install + start the daemon
  tokenboard daemon uninstall   Stop + remove the daemon
  tokenboard daemon status      Show whether it's running
  tokenboard daemon --help

Implementations:
  macOS  → launchd user agent at ~/Library/LaunchAgents/${LABEL}.plist
  Linux  → systemd --user timer at ~/.config/systemd/user/tokenboard.timer
`);
}

async function run(argv) {
  const sub = argv[0];
  if (!sub || sub === '--help' || sub === '-h') {
    printHelp();
    return;
  }
  const platform = process.platform;
  if (platform !== 'darwin' && platform !== 'linux') {
    throw new Error(`daemon command not supported on ${platform}`);
  }

  if (sub === 'install') {
    const cli = resolveCliBin();
    if (!cli) {
      throw new Error(
        'Could not determine CLI path. Install tokenboard globally first: `npm install -g tokenboard-cli`',
      );
    }
    if (cli.includes('/_npx/')) {
      console.log('⚠ You are running via `npx`. The daemon needs a stable path.');
      console.log('  Install globally first: npm install -g tokenboard-cli');
      throw new Error('refusing to install daemon pointing at a temporary npx path');
    }
    if (platform === 'darwin') return installMacos(cli);
    return installLinux(cli);
  }
  if (sub === 'uninstall' || sub === 'remove') {
    if (platform === 'darwin') return uninstallMacos();
    return uninstallLinux();
  }
  if (sub === 'status') {
    if (platform === 'darwin') return statusMacos();
    return statusLinux();
  }
  throw new Error(`Unknown daemon subcommand: ${sub}`);
}

module.exports = { run };
