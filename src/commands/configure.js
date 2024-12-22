import FundManager from '../db/fundManager.js';

const fundManager = new FundManager();

export const data = {
  name: 'configure',
  description: 'Configures the fund and manages stocks.',
  options: [
    {
      name: 'fund',
      type: 1, // SUBCOMMAND type
      description: 'Manage the fund.',
      options: [
        {
          name: 'amount',
          type: 10, // NUMBER type
          description: 'The amount to add or delete from the fund.',
          required: true,
        },
        {
          name: 'date',
          type: 3, // STRING type
          description: 'The date of the transaction (MM-DD-YYYY).',
          required: true,
        },
      ],
    },
    {
      name: 'add',
      type: 1, // SUBCOMMAND type
      description: 'Add a stock to the fund.',
      options: [
        {
          name: 'ticker',
          type: 3, // STRING type
          description: 'The stock ticker symbol.',
          required: true,
        },
        {
          name: 'quantity',
          type: 10, // NUMBER type
          description: 'The number of shares purchased.',
          required: true,
        },
        {
          name: 'price',
          type: 10, // NUMBER type
          description: 'The purchase price per share.',
          required: true,
        },
        {
          name: 'date',
          type: 3, // STRING type
          description: 'The date of the transaction (MM-DD-YYYY).',
          required: true,
        },
        {
          name: 'exit_price',
          type: 10, // NUMBER type
          description: 'The planned exit price per share.',
          required: false,
        },
        {
          name: 'pitchers',
          type: 3, // STRING type
          description: 'Comma-separated list of pitcher names (e.g., "John Doe, Jane Smith").',
          required: false,
        },
      ],
    },
    {
      name: 'delete',
      type: 1, // SUBCOMMAND type
      description: 'Delete a stock from the fund.',
      options: [
        {
          name: 'ticker',
          type: 3, // STRING type
          description: 'The stock ticker symbol to remove.',
          required: true,
        },
        {
          name: 'date',
          type: 3, // STRING type
          description: 'The date of the transaction (MM-DD-YYYY).',
          required: true,
        },
        {
          name: 'quantity',
          type: 10, // NUMBER type
          description: 'The number of shares to remove (leave empty to remove all).',
          required: false,
        },
      ],
    },
    {
      name: 'undo',
      type: 1, // SUBCOMMAND type
      description: 'Undo the last action or all actions.',
    },
  ],
};

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  console.log('Subcommand:', subcommand);

  // Access the options directly from _hoistedOptions
  const options = interaction.options._hoistedOptions.reduce((acc, opt) => {
    acc[opt.name] = opt.value;
    return acc;
  }, {});

  console.log('Options:', options);

  try {
    switch (subcommand) {
      case 'fund':
        fundManager.addFund(options.amount, options.date);
        await interaction.reply(`Fund updated with ${options.amount} on ${options.date}.`);
        break;
      case 'add':
        const pitchers = options.pitchers ? options.pitchers.split(',').map(name => name.trim()) : [];
        fundManager.addStock(
          options.ticker,
          options.quantity,
          options.price,
          options.exit_price,
          options.date,
          pitchers
        );
        await interaction.reply(
          `Stock ${options.ticker} added with ${options.quantity} shares at ${options.price} per share on ${options.date}.` +
          (pitchers.length > 0 ? ` Pitcher(s): ${pitchers.join(', ')}` : '')
        );
        break;
      case 'delete':
        fundManager.deleteStock(options.ticker, options.quantity, options.date);
        await interaction.reply(
          `Stock ${options.ticker} updated. ${options.quantity || 'All'} shares removed on ${options.date}.`
        );
        break;
      case 'undo':
        fundManager.undoLastAction();
        await interaction.reply('Last action undone.');
        break;
      default:
        await interaction.reply('Unknown subcommand.');
    }
  } catch (error) {
    console.error('Error executing configure command:', error);
    await interaction.reply('An error occurred while executing this command.');
  }
}
