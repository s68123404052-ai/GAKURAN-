const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('ไม่พบ DISCORD_TOKEN');
  process.exit(1);
}

client.once('ready', () => {
  console.log(`Discord Bot Online: ${client.user.tag}`);
});

client.login(TOKEN);
