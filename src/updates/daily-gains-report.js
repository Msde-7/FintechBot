import { scheduleJob } from 'node-schedule';
import FundManager from '../db/FundManager.js';
import dotenv from 'dotenv'
dotenv.config();


const channelId = process.env.CHANNEL_ID;
const botID = process.env.GROUPME_BOT_ID;

const fundManager = new FundManager();

const holidays2025 = new Set([
  '2025-01-01',
  '2025-01-20',
  '2025-02-17',
  '2025-04-18',
  '2025-05-26',
  '2025-06-19',
  '2025-07-04',
  '2025-09-01',
  '2025-11-27',
  '2025-12-25',
]);

let isMarketOpenToday = true;

var HTTPS = require('https');

const sendGroupMeMessage = (message) => {
	options = {
		hostname: 'api.groupme.com',
		path: '/v3/bots/post',
		method: 'POST'
	};

	body = {
		"text" : message,
		"bot_id" : botID
	};

	//console.log('sending ' + message + ' to ' + botID);

	botReq = HTTPS.request(options, function(res) {
		if(res.statusCode == 202) {
			//neat
		} else {
			console.log('rejecting bad status code ' + res.statusCode);
		}
	});
	
	botReq.end(JSON.stringify(body));
}

export const scheduleMarketUpdates = (client) => {
  // Function to generate and send the daily fund report
  const generateDailyGainsReport = async () => {
    if (!isMarketOpenToday) {
      console.log("Market was closed today. Skipping daily gains report.");
      return;
    }

    console.log("Market was open today. Generating daily gains report...");

    try {
      const { report, funds, totalGain, totalPercentageGain } = await fundManager.calcDailyGainsReport();
      const channel = client.channels.cache.get(channelId);

      if (channel) {
        let message = '📊 **Daily Fund Performance Report** 📊\n\n';

        // Add overall fund performance details
        message += `**Overall Fund Performance**\n`;
        message += `- Remaining Funds: $${funds}\n`;
        message += `- Total Daily Gain: $${totalGain}\n`;
        message += `- Total Gain Percentage: ${totalPercentageGain}%\n\n`;

        message += `**Individual Stock Performance**\n\n`;

        // Add details for each stock in the report
        report.forEach((stock) => {
          const emoji = parseFloat(stock.totalGain) > 0 ? '📈' : '📉';
          message += `**${stock.ticker} ${emoji}**\n`;
          message += `- Quantity: ${stock.quantity}\n`;
          message += `- Yesterday's Price: $${stock.yesterdayPrice}\n`;
          message += `- Today's Price: $${stock.todaysPrice}\n`;
          message += `- Gain Per Stock: $${stock.gainPerStock}\n`;
          message += `- Total Gain: $${stock.totalGain}\n`;
          message += `- Gain Percentage: ${stock.percentageGain}%\n\n`;
        });
		sendGroupMeMessage(message);
        await channel.send(message);
      }
    } catch (error) {
      console.error("Error generating daily gains report:", error.message);
    }
  };

  // Function to calculate if the market is open today
  const calcIsMarketOpen = () => {
    const date = new Date();
    const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    isMarketOpenToday = !holidays2025.has(formattedDate);
  };

  // Schedule task to update yesterday's prices daily
  scheduleJob(
    { hour: 15, minute: 55, dayOfWeek: [1, 2, 3, 4, 5], tz: 'America/New_York' },
    async () => {
      calcIsMarketOpen();
      if (isMarketOpenToday) {
        console.log("Updating yesterday's prices...");
        await fundManager.updateYesterdaysPrices();
      } else {
        console.log("Market is closed today. Skipping price update.");
      }
    }
  );

  // Schedule task to generate the daily gains report after market close
  scheduleJob(
    { hour: 16, minute: 0, dayOfWeek: [1, 2, 3, 4, 5], tz: 'America/New_York' },
    async () => {
      console.log("Generating daily gains report after market close...");
      await generateDailyGainsReport();
    }
  );
};
