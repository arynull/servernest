module.exports = {
  name: 'leveling',
  description: 'XP, ranks and role rewards',
  commands: [
    {
      name: 'rank',
      description: 'Show XP rank for a user',
      options: [{ name: 'user', description: 'User to check', type: 'user', required: false }]
    },
    {
      name: 'leaderboard',
      description: 'Show XP leaderboard',
      options: [{ name: 'limit', description: 'How many users', type: 'integer', required: false, min: 1, max: 25 }]
    },
    {
      name: 'xp-roles',
      description: 'View XP role rewards',
      options: []
    },
    {
      name: 'xp-role-add',
      description: 'Set an XP role reward (admin only)',
      defaultMemberPermissions: 'Administrator',
      options: [
        { name: 'level', description: 'Level required', type: 'integer', required: true, min: 1 },
        { name: 'role', description: 'Role to grant', type: 'role', required: true }
      ]
    }
  ]
};
