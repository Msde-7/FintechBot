import FundManager from '../db/FundManager.js';

export const data = {
    name: 'generate_report',
    description: 'Generates and displays the fund performance report.',
    options: [
          { 
            name: 'time',
            type: 3, // STRING type
            description: 'Most recent current, close, or open time.',
            required: true,
          }
    ],
  };
    
  const fundManager = new FundManager();
  
  export async function execute(interaction) {
    const selectedTime = interaction.options.getString('time');
    console.log(selectedTime);
    if(selectedTime !== 'current' && selectedTime !== 'close' && selectedTime !== 'open') {
      await interaction.reply('Invalid time option. Please select either "current", "close", or "open".');
      return;
    }
    try {
      // Fetch the fund report data from the FundManager
      const { report, funds, totalFundGain, totalFundGainPercentage } = await fundManager.calcFundReport(selectedTime);
  
      // Check if there are stocks in the portfolio
      if (!report || report.length === 0) {
        await interaction.reply('No stocks found in the portfolio.');
        return;
      }
  
      // Build the performance report message
      let message = '📊 **Fund Performance Report** 📊\n\n';
      message += `**Overall Fund Performance**\n`;
      message += `- Remaining Funds: $${funds}\n`;
      message += `- Total Gain: $${totalFundGain}\n`;
      message += `- Total Gain Percentage: ${totalFundGainPercentage}%\n\n`;
  
      message += `**Individual Stock Performance**\n\n`;
  
      // Add details for each stock in the report
      report.forEach((stock) => {
        const emoji = parseFloat(stock.totalGain) > 0 ? '📈' : '📉';
        message += `**${stock.ticker} ${emoji}**\n`;
        message += `- Quantity: ${stock.quantity}\n`;
        message += `- Purchase Price: $${stock.purchasePrice}\n`;
        message += `- Most Recent Price: $${stock.price}\n`;
        message += `- Gain Per Stock: $${stock.gainPerStock}\n`;
        message += `- Total Gain: $${stock.totalGain}\n`;
        message += `- Gain Percentage: ${stock.gainPercentage}%\n\n`;
      });
  
      // Reply to the interaction with the generated report
      await interaction.reply(message);
    } catch (error) {
      // Log and respond to errors
      console.error('Error generating report:', error);
      await interaction.reply('An error occurred while generating the report. Please try again later.');
    }
  }
  