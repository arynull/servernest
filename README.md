# ServerNest

Self-hosted all-in-one Discord community OS.

ServerNest runs your Discord community from your own server: leveling with XP ranks and role rewards, a local dashboard, and a modular foundation for more modules later.

Offline-first: state lives in SQLite. No external services required except Discord itself when running live.

## Install

Requires Node.js >= 22.

```bash
npm install
```

## Setup

Create a Discord application and bot, then export the token:

```bash
export DISCORD_TOKEN=REPLACE_ME
```

You can also copy `.env.example` to `.env` and set `DISCORD_TOKEN`:

```bash
cp .env.example .env
# edit .env and set DISCORD_TOKEN=REPLACE_ME
export DISCORD_TOKEN=REPLACE_ME
```

Never commit real tokens. Use placeholders in docs and fixtures.

Deploy slash commands to a guild (live only):

```bash
export DISCORD_TOKEN=REPLACE_ME
node scripts/deploy-commands.js GUILD_ID CLIENT_ID
```

## Usage

All commands run via the `servernest` bin:

```bash
node bin/servernest.js --version
node bin/servernest.js start
node bin/servernest.js doctor
node bin/servernest.js modules list
node bin/servernest.js dashboard
```

Or if linked:

```bash
servernest --version
servernest start
servernest doctor
servernest modules list
servernest dashboard
```

### Command reference

#### `servernest --version`

Prints the version.

```bash
servernest --version
# servernest 0.1.0
```

Flags: `--version`, `-V`.

#### `servernest start`

Connects to Discord with `DISCORD_TOKEN`. Refuses to run without it.

```bash
export DISCORD_TOKEN=REPLACE_ME
servernest start
```

Without a token:

```bash
servernest start
# ERROR: DISCORD_TOKEN is required to start. Set DISCORD_TOKEN env var.
```

#### `servernest doctor`

Checks environment, config dir, and database schema.

```bash
servernest doctor
```

Example output:

```bash
ServerNest doctor
[WARN] DISCORD_TOKEN is not set (required for `start`, optional for doctor)
[OK] data dir /home/user/.servernest writable
[OK] schema tables present: guilds, members, xp_roles, module_settings
Doctor OK
```

Exits 0 when dir and schema are healthy, even if `DISCORD_TOKEN` is missing.

#### `servernest modules list`

Lists registered modules.

```bash
servernest modules list
# - leveling: XP, ranks and role rewards
```

#### `servernest dashboard`

Serves the local web UI.

```bash
servernest dashboard
# Dashboard listening on http://localhost:3000
```

Override port:

```bash
PORT=4000 servernest dashboard
```

Routes:

- `GET /` — guild overview with module enable/disable toggles
- `POST /guilds/:id/modules/:module/toggle` — toggle a module
- `GET /guilds/:id/leaderboard` — leveling leaderboard view

### Discord commands (leveling)

- `/rank [user]` — show XP rank. Example: `/rank` or `/rank @alice`
- `/leaderboard [limit]` — show top XP. Example: `/leaderboard` or `/leaderboard 10`
- `/xp-roles` — view XP role rewards
- `/xp-role-add <level> <role>` — set a reward (admin only). Example: `/xp-role-add 5 @Veteran`

Messages earn 15–25 random XP with a 60s per-user cooldown. On level-up the bot announces and grants configured role rewards.

## Modules

- `leveling` — XP awards, `/rank`, `/leaderboard`, `/xp-roles`, `/xp-role-add`, level-up announcements, role rewards.

Enable/disable per guild via dashboard or code:

```js
const loader = require('./src/core/loader');
loader.loadModules();
loader.enableModule('GUILD_ID', 'leveling');
loader.disableModule('GUILD_ID', 'leveling');
```

## Data directory and environment

- `SERVERNEST_DATA_DIR` — state directory. Default `~/.servernest/`. SQLite file is `servernest.db` inside it.
- `DISCORD_TOKEN` — Discord bot token. Required for `start` and `deploy-commands`, never required for local use.
- `PORT` — dashboard port. Default `3000`.

```bash
export SERVERNEST_DATA_DIR=/data/servernest
export DISCORD_TOKEN=REPLACE_ME
export PORT=3000
```

Schema tables: `guilds(id, name, created_at)`, `members(guild_id, user_id, xp, level, last_xp_at)`, `xp_roles(guild_id, level, role_id)`, `module_settings(guild_id, module, enabled)`. All queries are parameterized.
