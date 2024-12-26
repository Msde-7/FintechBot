import FundManager from '../db/fundManager.js';

const fundManager = new FundManager();

// Command data for /stockinfo
export const data = {
  name: 'stock_info',
  description: 'Replies with detailed stock information.',
  options: [
    {
      name: 'ticker',
      description: 'The stock ticker symbol to get information for.',
      type: 3, // STRING type
      required: true, // Mark the argument as required
    },
  ],
};

// The execute function that handles the interaction
export async function execute(interaction) {
  const ticker = interaction.options.getString('ticker'); // Get the required argument

  try {
    // Get stock info using the FundManager
    fundManager.getStockInfo(ticker, (err, info) => {
      if (err) {
        console.error(`Error retrieving stock info for ${ticker}:`, err.message);
        interaction.reply('There was an error retrieving the stock information.');
      } else if (!info) {
        interaction.reply(`No stock found with ticker: ${ticker.toUpperCase()}`);
      } else {
        const {
          entryPrice,
          totalOriginalWorth,
          amountBought,
          mostRecentPrice,
          totalRecentWorth,
          amountGained,
          percentageGained,
          pitchers,
          dateBought, // New field
        } = info;

        // Determine graph and emoji based on gain/loss
        const isPositive = parseFloat(percentageGained) > 0;
        const graphEmoji = isPositive ? '📈' : '📉';
        const summaryEmoji = isPositive ? '✨' : '⚠️';

        // Build the response message
        const response = `
** ${summaryEmoji} Stock Info for ${ticker.toUpperCase()} ${graphEmoji}**\n
- **Entry Price:** $${entryPrice}
- **Total Original Worth:** $${totalOriginalWorth}
- **Amount Bought:** ${amountBought} shares
- **Most Recent Price:** $${mostRecentPrice}
- **Total Recent Worth:** $${totalRecentWorth}
- **Amount Gained:** $${amountGained} (${percentageGained}%)
- **Date Bought:** ${dateBought || 'Unknown'}
- **Pitchers:** ${pitchers.join(', ') || 'None'}`;

        // Reply with the detailed stock info
        interaction.reply(response);
      }
    });
  } catch (error) {
    console.error(`Error in /stock_info command execution for ${ticker}:`, error.message);
    interaction.reply('An unexpected error occurred while fetching the stock information.');
  }
}
