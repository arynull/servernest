const db = require('./db');

const modules = new Map();

function registerModule(manifest, handlers) {
  if (!manifest || typeof manifest.name !== 'string' || manifest.name.length === 0) {
    throw new Error('Module manifest must have a name');
  }
  modules.set(manifest.name, { manifest, handlers: handlers || {} });
  return manifest.name;
}

function clearModules() {
  modules.clear();
}

function getModule(name) {
  return modules.get(name) || null;
}

function listModules() {
  return Array.from(modules.values()).map((e) => e.manifest);
}

function loadModules() {
  const manifest = require('../modules/leveling/manifest');
  const handlers = require('../modules/leveling/handlers');
  registerModule(manifest, handlers);
  return listModules();
}

function ensureKnown(moduleName) {
  if (!modules.has(moduleName)) {
    throw new Error(`Unknown module: ${moduleName}`);
  }
}

function enableModule(guildId, moduleName) {
  ensureKnown(moduleName);
  db.setModuleEnabled(guildId, moduleName, 1);
}

function disableModule(guildId, moduleName) {
  ensureKnown(moduleName);
  db.setModuleEnabled(guildId, moduleName, 0);
}

function isModuleEnabled(guildId, moduleName) {
  ensureKnown(moduleName);
  return db.isModuleEnabled(guildId, moduleName);
}

function findModuleForCommand(commandName) {
  for (const [name, entry] of modules.entries()) {
    const cmds = entry.manifest.commands || [];
    if (cmds.some((c) => c.name === commandName)) {
      return { name, entry };
    }
  }
  return null;
}

function resolveHandler(handlers, commandName) {
  if (!handlers) return null;
  if (typeof handlers[commandName] === 'function') return handlers[commandName];
  const camel = 'handle' + commandName.charAt(0).toUpperCase() + commandName.slice(1);
  if (typeof handlers[camel] === 'function') return handlers[camel];
  // kebab-case like xp-role-add -> handleXpRoleAdd
  const parts = commandName.split('-');
  if (parts.length > 1) {
    const cc = 'handle' + parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    if (typeof handlers[cc] === 'function') return handlers[cc];
  }
  if (typeof handlers.handleInteraction === 'function') return handlers.handleInteraction;
  return null;
}

async function routeInteraction(interaction) {
  const commandName =
    interaction.commandName || interaction.command || (interaction.data && interaction.data.name);
  if (!commandName) {
    return { handled: false, reason: 'unknown-command' };
  }
  const found = findModuleForCommand(commandName);
  if (!found) {
    return { handled: false, reason: 'unknown-command' };
  }
  const guildId = interaction.guildId || interaction.guild_id || (interaction.guild && interaction.guild.id);
  if (guildId) {
    let enabled = true;
    try {
      enabled = db.isModuleEnabled(guildId, found.name);
    } catch {
      enabled = true;
    }
    if (!enabled) {
      return { handled: false, reason: 'disabled', module: found.name };
    }
  }
  const handler = resolveHandler(found.entry.handlers, commandName);
  if (!handler) {
    return { handled: false, reason: 'no-handler', module: found.name };
  }
  const result = await handler(interaction);
  return { handled: true, module: found.name, result };
}

async function routeMessage(message) {
  const guildId = message.guildId || message.guild_id || (message.guild && message.guild.id);
  const results = [];
  for (const [name, entry] of modules.entries()) {
    if (guildId) {
      let enabled = true;
      try {
        enabled = db.isModuleEnabled(guildId, name);
      } catch {
        enabled = true;
      }
      if (!enabled) {
        continue;
      }
    }
    const fn = entry.handlers && entry.handlers.onMessage;
    if (typeof fn === 'function') {
      const r = await fn(message);
      results.push({ module: name, result: r });
    }
  }
  return results;
}

module.exports = {
  registerModule,
  clearModules,
  getModule,
  listModules,
  loadModules,
  enableModule,
  disableModule,
  isModuleEnabled,
  routeInteraction,
  routeMessage
};
