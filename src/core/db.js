const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');

let instance = null;

function getDataDir() {
  return process.env.SERVERNEST_DATA_DIR || path.join(os.homedir(), '.servernest');
}

function getDbPath() {
  return path.join(getDataDir(), 'servernest.db');
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS guilds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS members (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 0,
      last_xp_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS xp_roles (
      guild_id TEXT NOT NULL,
      level INTEGER NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY (guild_id, level)
    );
    CREATE TABLE IF NOT EXISTS module_settings (
      guild_id TEXT NOT NULL,
      module TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (guild_id, module)
    );
  `);
}

function getDb() {
  if (instance) return instance;
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  instance = new Database(getDbPath());
  instance.pragma('journal_mode = WAL');
  runMigrations(instance);
  return instance;
}

function migrate() {
  runMigrations(getDb());
}

function closeDb() {
  if (instance) {
    try {
      instance.close();
    } catch {
      // ignore close errors
    }
    instance = null;
  }
}

function upsertGuild(id, name) {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    'INSERT INTO guilds (id, name, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name'
  ).run(id, name, now);
  return getGuild(id);
}

function getGuild(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM guilds WHERE id = ?').get(id) || null;
}

function listGuilds() {
  const db = getDb();
  return db.prepare('SELECT * FROM guilds ORDER BY name ASC').all();
}

function upsertMember(guildId, userId) {
  const db = getDb();
  db.prepare(
    'INSERT INTO members (guild_id, user_id, xp, level, last_xp_at) VALUES (?, ?, 0, 0, 0) ON CONFLICT(guild_id, user_id) DO NOTHING'
  ).run(guildId, userId);
  return getMember(guildId, userId);
}

function getMember(guildId, userId) {
  const db = getDb();
  return db.prepare('SELECT * FROM members WHERE guild_id = ? AND user_id = ?').get(guildId, userId) || null;
}

function updateMember(guildId, userId, patch) {
  const db = getDb();
  let cur = getMember(guildId, userId);
  if (!cur) {
    upsertMember(guildId, userId);
    cur = getMember(guildId, userId);
  }
  const xp = patch.xp !== undefined ? patch.xp : cur.xp;
  const level = patch.level !== undefined ? patch.level : cur.level;
  const lastXpAt = patch.last_xp_at !== undefined ? patch.last_xp_at : cur.last_xp_at;
  db.prepare('UPDATE members SET xp = ?, level = ?, last_xp_at = ? WHERE guild_id = ? AND user_id = ?').run(
    xp,
    level,
    lastXpAt,
    guildId,
    userId
  );
  return getMember(guildId, userId);
}

function getTopMembers(guildId, limit) {
  const db = getDb();
  let n = Number(limit);
  if (!Number.isFinite(n)) n = 10;
  n = Math.max(1, Math.min(100, Math.floor(n)));
  return db.prepare('SELECT * FROM members WHERE guild_id = ? ORDER BY xp DESC LIMIT ?').all(guildId, n);
}

function setXpRole(guildId, level, roleId) {
  const db = getDb();
  db.prepare(
    'INSERT INTO xp_roles (guild_id, level, role_id) VALUES (?, ?, ?) ON CONFLICT(guild_id, level) DO UPDATE SET role_id=excluded.role_id'
  ).run(guildId, level, roleId);
  return getXpRole(guildId, level);
}

function getXpRole(guildId, level) {
  const db = getDb();
  return db.prepare('SELECT * FROM xp_roles WHERE guild_id = ? AND level = ?').get(guildId, level) || null;
}

function getXpRoles(guildId) {
  const db = getDb();
  return db.prepare('SELECT * FROM xp_roles WHERE guild_id = ? ORDER BY level ASC').all(guildId);
}

function removeXpRole(guildId, level) {
  const db = getDb();
  db.prepare('DELETE FROM xp_roles WHERE guild_id = ? AND level = ?').run(guildId, level);
}

function setModuleEnabled(guildId, module, enabled) {
  const db = getDb();
  const v = enabled ? 1 : 0;
  db.prepare(
    'INSERT INTO module_settings (guild_id, module, enabled) VALUES (?, ?, ?) ON CONFLICT(guild_id, module) DO UPDATE SET enabled=excluded.enabled'
  ).run(guildId, module, v);
}

function getModuleSetting(guildId, module) {
  const db = getDb();
  return db.prepare('SELECT * FROM module_settings WHERE guild_id = ? AND module = ?').get(guildId, module) || null;
}

function isModuleEnabled(guildId, module) {
  const row = getModuleSetting(guildId, module);
  if (!row) return true;
  return row.enabled === 1;
}

module.exports = {
  getDataDir,
  getDbPath,
  getDb,
  migrate,
  closeDb,
  upsertGuild,
  getGuild,
  listGuilds,
  upsertMember,
  getMember,
  updateMember,
  getTopMembers,
  setXpRole,
  getXpRole,
  getXpRoles,
  removeXpRole,
  setModuleEnabled,
  getModuleSetting,
  isModuleEnabled
};
