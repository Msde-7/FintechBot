export const data = {
    name: 'ping',
    description: 'Replies with Pong!',
  };
  
  export async function execute(interaction) {
    await interaction.reply('Pong!');
  }