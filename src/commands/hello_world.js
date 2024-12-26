export const data = {
    name: 'hello',
    description: 'hello world!',
  };
  
  export async function execute(interaction) {
    await interaction.reply('Hello World!');
  }