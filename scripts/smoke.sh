#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
TMP="$(mktemp -d)"
export SERVERNEST_DATA_DIR="$TMP"
DASH_PID=""
PORT="${PORT:-3457}"
cleanup() {
  if [ -n "${DASH_PID:-}" ]; then
    kill "$DASH_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT
fail() {
  echo "SMOKE FAIL: $*" >&2
  exit 1
}
pass() {
  echo "SMOKE PASS: $*"
}
pass "using temp data dir $TMP"
node -e "const db=require('./src/core/db'); db.migrate(); console.log('db init ok');" || fail "db init failed"
node <<'NODE' || fail "xp engine / leaderboard / xp-roles failed"
const db = require('./src/core/db');
const xp = require('./src/core/xp');
const handlers = require('./src/modules/leveling/handlers');
db.migrate();
db.upsertGuild('smoke-guild', 'Smoke Guild');
// Simulate 3 members + messages via XP engine directly (spaced to avoid cooldown)
const base = Date.now() - 1000000;
xp.awardXpForMember('smoke-guild', 'u1', 100, base);
xp.awardXpForMember('smoke-guild', 'u2', 300, base + 70000);
xp.awardXpForMember('smoke-guild', 'u3', 200, base + 140000);
// Force deterministic ordering for assertion
db.updateMember('smoke-guild', 'u1', { xp: 100, level: xp.levelForXp(100), last_xp_at: base });
db.updateMember('smoke-guild', 'u2', { xp: 300, level: xp.levelForXp(300), last_xp_at: base });
db.updateMember('smoke-guild', 'u3', { xp: 200, level: xp.levelForXp(200), last_xp_at: base });
const top = db.getTopMembers('smoke-guild', 3);
if (top.length !== 3) throw new Error('expected 3 members');
if (top[0].user_id !== 'u2' || top[1].user_id !== 'u3' || top[2].user_id !== 'u1') {
  throw new Error('leaderboard ordering wrong: ' + JSON.stringify(top.map(r => r.user_id)));
}
// Handler-level leaderboard ordering
(async () => {
  let text = '';
  await handlers.handleLeaderboard({ guildId: 'smoke-guild', options: { limit: 3 }, reply: async (m) => { text = typeof m === 'string' ? m : m.content; } });
  const i1 = text.indexOf('u2');
  const i2 = text.indexOf('u3');
  const i3 = text.indexOf('u1');
  if (!(i1 >= 0 && i2 > i1 && i3 > i2)) throw new Error('handler leaderboard ordering wrong: ' + text);
  // XP role round-trip
  db.setXpRole('smoke-guild', 1, 'role-1');
  const roles = db.getXpRoles('smoke-guild');
  if (!roles.some(r => Number(r.level) === 1 && r.role_id === 'role-1')) throw new Error('xp role round-trip failed');
  console.log('engine + leaderboard + xp-roles ok');
})().catch(e => { console.error(e); process.exit(1); });
NODE
pass "xp engine, leaderboard ordering, xp-role round-trip"
node bin/servernest.js --version | grep -q "0.1.0" || fail "--version did not report 0.1.0"
pass "CLI --version"
node bin/servernest.js doctor || fail "doctor exited non-zero"
pass "CLI doctor"
PORT="$PORT" node -e "const {createApp}=require('./src/dashboard/app'); const p=Number(process.env.PORT||3457); createApp().listen(p,()=>console.log('dash up'));" &
DASH_PID=$!
for i in $(seq 1 20); do
  if curl -sf "http://127.0.0.1:${PORT}/" >/tmp/smoke_dash.html 2>/dev/null; then
    break
  fi
  sleep 0.5
  if [ "$i" = "20" ]; then
    fail "dashboard did not boot on /"
  fi
done
grep -q "ServerNest" /tmp/smoke_dash.html || fail "dashboard / did not contain ServerNest"
pass "dashboard boots and returns 200 on /"
kill "$DASH_PID" 2>/dev/null || true
DASH_PID=""
pass "smoke OK"
