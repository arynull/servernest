const express = require('express');
const db = require('../core/db');
const loader = require('../core/loader');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createApp() {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  app.get('/', (req, res) => {
    try {
      if (loader.listModules().length === 0) {
        loader.loadModules();
      }
    } catch {
      // ignore
    }
    let guilds = [];
    try {
      guilds = db.listGuilds();
    } catch {
      guilds = [];
    }
    const mods = loader.listModules();
    let html = '<!doctype html><html><head><meta charset="utf-8"><title>ServerNest</title></head><body>';
    html += '<h1>ServerNest</h1>';
    if (guilds.length === 0) {
      html += '<p>No guilds yet.</p>';
    } else {
      html += '<ul>';
      for (const g of guilds) {
        html += `<li>${esc(g.name)} (${esc(g.id)}) — <a href="/guilds/${esc(g.id)}/leaderboard">Leaderboard</a>`;
        html += '<ul>';
        for (const m of mods) {
          let enabled = true;
          try {
            enabled = db.isModuleEnabled(g.id, m.name);
          } catch {
            enabled = true;
          }
          html += `<li>${esc(m.name)}: ${enabled ? 'enabled' : 'disabled'} `;
          html += `<form method="POST" action="/guilds/${esc(g.id)}/modules/${esc(m.name)}/toggle" style="display:inline">`;
          html += `<button type="submit">${enabled ? 'Disable' : 'Enable'}</button></form></li>`;
        }
        html += '</ul></li>';
      }
      html += '</ul>';
    }
    html += '</body></html>';
    res.status(200).send(html);
  });

  app.post('/guilds/:id/modules/:module/toggle', (req, res) => {
    const guildId = req.params.id;
    const mod = req.params.module;
    try {
      if (loader.listModules().length === 0) loader.loadModules();
      const current = db.isModuleEnabled(guildId, mod);
      db.setModuleEnabled(guildId, mod, current ? 0 : 1);
    } catch (err) {
      res.status(400).send(`Cannot toggle module: ${esc(err.message)}`);
      return;
    }
    res.redirect('/');
  });

  app.get('/guilds/:id/leaderboard', (req, res) => {
    const guildId = req.params.id;
    let guild = null;
    try {
      guild = db.getGuild(guildId);
    } catch {
      guild = null;
    }
    let rows = [];
    try {
      rows = db.getTopMembers(guildId, 25);
    } catch {
      rows = [];
    }
    let html = '<!doctype html><html><head><meta charset="utf-8"><title>Leaderboard</title></head><body>';
    html += `<h1>Leaderboard — ${esc(guild ? guild.name : guildId)}</h1>`;
    html += '<p><a href="/">Back</a></p>';
    if (rows.length === 0) {
      html += '<p>No XP yet.</p>';
    } else {
      html += '<table border="1"><tr><th>#</th><th>User</th><th>Level</th><th>XP</th></tr>';
      rows.forEach((r, i) => {
        html += `<tr><td>${i + 1}</td><td>${esc(r.user_id)}</td><td>${esc(r.level)}</td><td>${esc(r.xp)}</td></tr>`;
      });
      html += '</table>';
    }
    html += '</body></html>';
    res.status(200).send(html);
  });

  return app;
}

module.exports = { createApp };
