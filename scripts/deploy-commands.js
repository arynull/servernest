#!/usr/bin/env node
const { REST, Routes } = require('discord.js');

function toApiType(t) {
  if (t === 'user') return 6;
  if (t === 'role') return 8;
  if (t === 'integer') return 4;
  if (t === 'string') return 3;
  return 3;
}

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const guildId = process.argv[2] || process.env.GUILD_ID;
  const clientId = process.argv[3] || process.env.CLIENT_ID;
  if (!token) {
    console.error('ERROR: DISCORD_TOKEN is required.');
    process.exit(1);
  }
  if (!guildId) {
    console.error('ERROR: guild id is required. Usage: node scripts/deploy-commands.js <guildId> <clientId>');
    process.exit(1);
  }
  if (!clientId) {
    console.error('ERROR: client id is required. Usage: node scripts/deploy-commands.js <guildId> <clientId>');
    process.exit(1);
  }
  const manifest = require('../src/modules/leveling/manifest');
  const body = (manifest.commands || []).map((c) => ({
    name: c.name,
    description: c.description,
    options: (c.options || []).map((o) => ({
      name: o.name,
      description: o.description,
      type: toApiType(o.type),
      required: Boolean(o.required)
    }))
  }));
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  console.log(`Deployed ${body.length} commands to guild ${guildId}.`);
}

main().catch((err) => {
  console.error(`ERROR: ${err && err.message ? err.message : err}`);
  process.exit(1);
});
