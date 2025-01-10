export const data = {
    name: 'help',
    description: 'Replies with a list of available commands.',
  };
  
export async function execute(interaction) {
  const response = `**Help**
- /configure: Configure fund info. Must have bot tech role.
- /funds: Check available funds.
- /james: James?
- /hello: Hello world!
- /stock_info: Get stock info.
- /generate_report: Generate fund performance report. Select the most current, close, or open time.`;

  await interaction.reply(response);
}

