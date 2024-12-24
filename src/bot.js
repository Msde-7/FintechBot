import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// Initialize a collection to hold commands
client.commands = new Collection();

const loadCommands = async () => {
  const commandsPath = path.resolve('./src/commands');
  const commandFiles = await fs.readdir(commandsPath);

  // JS 🤮 Write this in Python
  for (const file of commandFiles) {
    if (file.endsWith('.js')) {
      const commandPath = path.join(commandsPath, file);
      const { data, execute } = await import(`file://${commandPath}`);
      client.commands.set(data.name, { data, execute });
      console.log(`Loaded command: ${data.name}`);
    }
  }
};

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
  }
});

// Load all commands and start the bot
(async () => {
  try {
    await loadCommands();
    await client.login(process.env.TOKEN);
  } catch (error) {
    console.error('Error starting the bot:', error);
  }
})();
