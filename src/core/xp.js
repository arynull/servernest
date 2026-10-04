// XP math: level L requires 100 * L^2 total XP.
// levelForXp(xp) = floor(sqrt(xp / 100)) for xp >= 0, else 0.
// Thresholds: L0=0, L1=100, L2=400, L3=900, L4=1600, ...
// Monotonic non-decreasing in xp.

function xpForLevel(level) {
  const l = Math.floor(Number(level));
  if (!Number.isFinite(l) || l <= 0) return 0;
  return 100 * l * l;
}

function levelForXp(xp) {
  const x = Number(xp);
  if (!Number.isFinite(x) || x <= 0) return 0;
  return Math.floor(Math.sqrt(x / 100));
}

const COOLDOWN_MS = 60 * 1000;

// Pure: does not touch the DB. Mutates `member` in place for convenience.
// member: { xp, level, last_xp_at }
// Returns { xp, level, leveledUp }.
function awardXp(member, amount, now) {
  const t = now === undefined ? Date.now() : Number(now);
  const amt = Number(amount);
  const currentXp = Number(member.xp || 0);
  const currentLevel = member.level === undefined || member.level === null ? levelForXp(currentXp) : Number(member.level);
  const last = Number(member.last_xp_at || 0);
  if (t - last < COOLDOWN_MS) {
    return { xp: currentXp, level: currentLevel, leveledUp: false };
  }
  const newXp = currentXp + amt;
  const newLevel = levelForXp(newXp);
  const leveledUp = newLevel > currentLevel;
  member.xp = newXp;
  member.level = newLevel;
  member.last_xp_at = t;
  return { xp: newXp, level: newLevel, leveledUp };
}

// DB-backed: loads member, applies cooldown, persists on award.
function awardXpForMember(guildId, userId, amount, now) {
  const db = require('./db');
  const t = now === undefined ? Date.now() : Number(now);
  let row = db.getMember(guildId, userId);
  if (!row) {
    db.upsertMember(guildId, userId);
    row = db.getMember(guildId, userId);
  }
  const last = Number(row.last_xp_at || 0);
  if (t - last < COOLDOWN_MS) {
    return { xp: Number(row.xp || 0), level: Number(row.level || 0), leveledUp: false };
  }
  const member = { xp: Number(row.xp || 0), level: Number(row.level || 0), last_xp_at: last };
  const res = awardXp(member, amount, t);
  db.updateMember(guildId, userId, { xp: res.xp, level: res.level, last_xp_at: t });
  return res;
}

module.exports = {
  COOLDOWN_MS,
  xpForLevel,
  levelForXp,
  awardXp,
  awardXpForMember
};
