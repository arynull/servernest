const { Client, GatewayIntentBits } = require('discord.js');
const loader = require('./core/loader');

function buildCommands() {
  if (loader.listModules().length === 0) {
    loader.loadModules();
  }
  const cmds = [];
  for (const m of loader.listModules()) {
    for (const c of m.commands || []) {
      cmds.push(c);
    }
  }
  return cmds;
}

function createClient() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
  });
  client.on('interactionCreate', async (interaction) => {
    try {
      await loader.routeInteraction(interaction);
    } catch (err) {
      console.error(`interaction error: ${err && err.message ? err.message : err}`);
    }
  });
  client.on('messageCreate', async (msg) => {
    try {
      if (msg.author && msg.author.bot) return;
      await loader.routeMessage(msg);
    } catch (err) {
      console.error(`message error: ${err && err.message ? err.message : err}`);
    }
  });
  return client;
}

async function start(token) {
  if (!token) {
    throw new Error('DISCORD_TOKEN is required');
  }
  loader.loadModules();
  const client = createClient();
  await client.login(token);
  return client;
}

module.exports = {
  buildCommands,
  createClient,
  start
};
