#!/usr/bin/env node
const fs = require('fs');

const VERSION = '0.1.0';

function printUsage() {
  console.log('Usage: servernest [--version] <command>');
  console.log('');
  console.log('Commands:');
  console.log('  start           Connect to Discord (requires DISCORD_TOKEN)');
  console.log('  doctor          Check env, config dir and schema');
  console.log('  modules list    List registered modules');
  console.log('  dashboard       Serve local web UI');
  console.log('');
  console.log('Flags:');
  console.log('  --version, -V   Print version');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--version') || args.includes('-V')) {
    console.log(`servernest ${VERSION}`);
    return;
  }
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printUsage();
    return;
  }
  const cmd = args[0];
  if (cmd === 'start') {
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
      console.error('ERROR: DISCORD_TOKEN is required to start. Set DISCORD_TOKEN env var.');
      process.exit(1);
    }
    const { start } = require('../src/bot');
    try {
      await start(token);
    } catch (err) {
      console.error(`ERROR: failed to start: ${err.message}`);
      process.exit(1);
    }
    return;
  }
  if (cmd === 'doctor') {
    const db = require('../src/core/db');
    console.log('ServerNest doctor');
    const token = process.env.DISCORD_TOKEN;
    if (token) {
      console.log('[OK] DISCORD_TOKEN is set');
    } else {
      console.log('[WARN] DISCORD_TOKEN is not set (required for `start`, optional for doctor)');
    }
    const dir = db.getDataDir();
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      console.log(`[OK] data dir ${dir} writable`);
    } catch (err) {
      console.log(`[FAIL] data dir ${dir} not writable: ${err.message}`);
      process.exit(1);
    }
    try {
      db.migrate();
      const rows = db.getDb().prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
      const required = ['guilds', 'members', 'xp_roles', 'module_settings'];
      const missing = required.filter((t) => !rows.includes(t));
      if (missing.length > 0) {
        console.log(`[FAIL] missing tables: ${missing.join(', ')}`);
        process.exit(1);
      }
      console.log(`[OK] schema tables present: ${required.join(', ')}`);
    } catch (err) {
      console.log(`[FAIL] schema check failed: ${err.message}`);
      process.exit(1);
    }
    console.log('Doctor OK');
    return;
  }
  if (cmd === 'modules') {
    const sub = args[1];
    if (sub !== 'list') {
      console.error('ERROR: usage: servernest modules list');
      process.exit(1);
    }
    const loader = require('../src/core/loader');
    loader.loadModules();
    const list = loader.listModules();
    if (list.length === 0) {
      console.log('No modules registered.');
    } else {
      for (const m of list) {
        console.log(`- ${m.name}: ${m.description || ''}`);
      }
    }
    return;
  }
  if (cmd === 'dashboard') {
    const port = Number(process.env.PORT || 3000);
    const { createApp } = require('../src/dashboard/app');
    const app = createApp();
    app.listen(port, () => {
      console.log(`Dashboard listening on http://localhost:${port}`);
    });
    return;
  }
  console.error(`ERROR: unknown command "${cmd}"`);
  printUsage();
  process.exit(1);
}

main().catch((err) => {
  console.error(`ERROR: ${err && err.message ? err.message : err}`);
  process.exit(1);
});
