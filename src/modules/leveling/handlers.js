const db = require('../../core/db');
const xp = require('../../core/xp');

function randomXpAmount() {
  return Math.floor(Math.random() * 11) + 15;
}

async function grantRole(guildId, userId, roleId) {
    void guildId; void userId; void roleId;
  return true;
}

function getGuildId(src) {
  if (!src) return null;
  return src.guildId || src.guild_id || (src.guild && src.guild.id) || null;
}

async function safeReply(interaction, content) {
  if (interaction && typeof interaction.reply === 'function') {
    const payload = typeof content === 'string' ? { content } : content;
    await interaction.reply(payload);
    return payload;
  }
  return content;
}

function getTargetUserId(interaction) {
  if (interaction.options && typeof interaction.options.getUser === 'function') {
    try {
      const u = interaction.options.getUser('user');
      if (u && u.id) return u.id;
    } catch {
      // fall through
    }
  }
  if (interaction.options && interaction.options.userId) return interaction.options.userId;
  if (interaction.targetUserId) return interaction.targetUserId;
  if (interaction.user && interaction.user.id) return interaction.user.id;
  if (interaction.author && interaction.author.id) return interaction.author.id;
  return null;
}

function getLimit(interaction) {
  let limit;
  if (interaction.options && typeof interaction.options.getInteger === 'function') {
    try {
      limit = interaction.options.getInteger('limit');
    } catch {
      limit = undefined;
    }
  }
  if (limit === undefined || limit === null) {
    limit = interaction.options && interaction.options.limit !== undefined ? interaction.options.limit : 10;
  }
  limit = Number(limit);
  if (!Number.isFinite(limit)) limit = 10;
  limit = Math.max(1, Math.min(25, Math.floor(limit)));
  return limit;
}

function getLevelOption(interaction) {
  let level;
  if (interaction.options && typeof interaction.options.getInteger === 'function') {
    try {
      level = interaction.options.getInteger('level');
    } catch {
      level = undefined;
    }
  }
  if (level === undefined || level === null) {
    if (interaction.options && interaction.options.level !== undefined) level = interaction.options.level;
    else if (interaction.level !== undefined) level = interaction.level;
  }
  return level;
}

function getRoleOption(interaction) {
  if (interaction.options && typeof interaction.options.getRole === 'function') {
    try {
      const r = interaction.options.getRole('role');
      if (r && r.id) return r.id;
    } catch {
      // fall through
    }
  }
  if (interaction.options && interaction.options.roleId) return interaction.options.roleId;
  if (interaction.options && interaction.options.role) return interaction.options.role;
  if (interaction.roleId) return interaction.roleId;
  if (interaction.role) return interaction.role;
  return null;
}

function isAdmin(interaction) {
  if (typeof interaction.isAdmin === 'boolean') return interaction.isAdmin;
  if (interaction.memberPermissions && typeof interaction.memberPermissions.has === 'function') {
    try {
      if (interaction.memberPermissions.has('Administrator')) return true;
    } catch {
      // ignore
    }
  }
  if (interaction.member && interaction.member.permissions && typeof interaction.member.permissions.has === 'function') {
    try {
      if (interaction.member.permissions.has('Administrator')) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

async function onMessage(message) {
  const guildId = getGuildId(message);
  const authorId = (message.author && message.author.id) || message.authorId || null;
  const botFlag = (message.author && message.author.bot) || message.bot || false;
  if (!guildId || !authorId || botFlag) {
    return { awarded: false, reason: 'ignored' };
  }
  try {
    if (!db.isModuleEnabled(guildId, 'leveling')) {
      return { awarded: false, reason: 'disabled' };
    }
  } catch {
    // if module not registered, assume enabled
  }
  const before = db.getMember(guildId, authorId);
  const oldXp = before ? Number(before.xp || 0) : 0;
  const oldLevel = before ? Number(before.level || 0) : xp.levelForXp(oldXp);
  const amount = randomXpAmount();
  const res = xp.awardXpForMember(guildId, authorId, amount);
  const awarded = res.xp !== oldXp;
  if (!awarded) {
    return { awarded: false, xp: res.xp, level: res.level, leveledUp: false };
  }
  if (res.leveledUp) {
    const rewards = db.getXpRoles(guildId).filter((r) => Number(r.level) > oldLevel && Number(r.level) <= res.level);
    for (const r of rewards) {
      try {
        await module.exports.grantRole(guildId, authorId, r.role_id);
      } catch {
        // do not fail message handling on grant errors
      }
    }
    const text = `<@${authorId}> leveled up to level ${res.level}!`;
    try {
      if (message.channel && typeof message.channel.send === 'function') {
        await message.channel.send(text);
      } else if (typeof message.reply === 'function') {
        await message.reply(text);
      }
    } catch {
      // ignore announce errors
    }
  }
  return { awarded: true, amount, xp: res.xp, level: res.level, leveledUp: res.leveledUp };
}

async function handleRank(interaction) {
  const guildId = getGuildId(interaction);
  const targetId = getTargetUserId(interaction);
  if (!guildId || !targetId) {
    await safeReply(interaction, 'Could not determine guild or user.');
    return { ok: false, reason: 'missing-ids' };
  }
  const row = db.getMember(guildId, targetId);
  const curXp = row ? Number(row.xp || 0) : 0;
  const curLevel = row ? Number(row.level || 0) : xp.levelForXp(curXp);
  await safeReply(interaction, `<@${targetId}> — Level ${curLevel} (${curXp} XP)`);
  return { ok: true, userId: targetId, xp: curXp, level: curLevel };
}

async function handleLeaderboard(interaction) {
  const guildId = getGuildId(interaction);
  if (!guildId) {
    await safeReply(interaction, 'Could not determine guild.');
    return { ok: false, reason: 'missing-guild' };
  }
  const limit = getLimit(interaction);
  const rows = db.getTopMembers(guildId, limit);
  if (rows.length === 0) {
    await safeReply(interaction, 'No XP yet.');
    return { ok: true, entries: [] };
  }
  const lines = rows.map((r, i) => `${i + 1}. <@${r.user_id}> — Level ${r.level} (${r.xp} XP)`);
  await safeReply(interaction, lines.join('\n'));
  return { ok: true, entries: rows };
}

async function handleXpRoles(interaction) {
  const guildId = getGuildId(interaction);
  if (!guildId) {
    await safeReply(interaction, 'Could not determine guild.');
    return { ok: false, reason: 'missing-guild' };
  }
  const roles = db.getXpRoles(guildId);
  if (roles.length === 0) {
    await safeReply(interaction, 'No XP role rewards configured.');
    return { ok: true, roles: [] };
  }
  const lines = roles.map((r) => `Level ${r.level} → <@&${r.role_id}>`);
  await safeReply(interaction, lines.join('\n'));
  return { ok: true, roles };
}

async function handleXpRoleAdd(interaction) {
  const guildId = getGuildId(interaction);
  if (!guildId) {
    await safeReply(interaction, 'Could not determine guild.');
    return { ok: false, reason: 'missing-guild' };
  }
  if (!isAdmin(interaction)) {
    await safeReply(interaction, { content: 'You need Administrator to use this command.', ephemeral: true });
    return { ok: false, reason: 'forbidden' };
  }
  const rawLevel = getLevelOption(interaction);
  const roleId = getRoleOption(interaction);
  const level = Number(rawLevel);
  if (!Number.isInteger(level) || level < 1 || level > 1000) {
    await safeReply(interaction, { content: 'Invalid level. Provide an integer >= 1.', ephemeral: true });
    return { ok: false, reason: 'invalid-level' };
  }
  if (typeof roleId !== 'string' || roleId.length === 0) {
    await safeReply(interaction, { content: 'Invalid role. Provide a role.', ephemeral: true });
    return { ok: false, reason: 'invalid-role' };
  }
  db.setXpRole(guildId, level, roleId);
  await safeReply(interaction, `XP role set: Level ${level} → <@&${roleId}>`);
  return { ok: true, level, roleId };
}

async function handleInteraction(interaction) {
  const name = interaction.commandName || interaction.command || (interaction.data && interaction.data.name);
  if (name === 'rank') return handleRank(interaction);
  if (name === 'leaderboard') return handleLeaderboard(interaction);
  if (name === 'xp-roles') return handleXpRoles(interaction);
  if (name === 'xp-role-add') return handleXpRoleAdd(interaction);
  await safeReply(interaction, `Unknown command: ${name}`);
  return { ok: false, reason: 'unknown-command' };
}

module.exports = {
  randomXpAmount,
  grantRole,
  onMessage,
  handleRank,
  handleLeaderboard,
  handleXpRoles,
  handleXpRoleAdd,
  handleInteraction,
  rank: handleRank,
  leaderboard: handleLeaderboard
};
