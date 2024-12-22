import { REST, Routes } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const commands = [];

const loadCommands = async () => {
  const commandsPath = path.resolve('./src/commands');
  const commandFiles = await fs.readdir(commandsPath);

  for (const file of commandFiles) {
    if (file.endsWith('.js')) {
      const commandPath = path.join(commandsPath, file);
      const { data } = await import(`file://${commandPath}`);
      commands.push(data);
      console.log(`Loaded command: ${data.name}`);
    }
  }
};

const deployCommands = async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error deploying commands:', error);
  }
};

(async () => {
  await loadCommands();
  await deployCommands();
})();