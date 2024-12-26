import { scheduleJob } from 'node-schedule';
import FundManager from '../db/FundManager.js';

let isMarketOpenToday = true;
const channelId = '1321901094049284201'
const fundManager = new FundManager();

export const scheduleMarketUpdates = (client) => {
  // Helper function to check market status
  const checkMarketStatus = async () => {
    try {
      const isOpen = await fundManager.stockPriceFetcher.isMarketOpen();
      console.log(`Market status updated: ${isOpen ? "Open" : "Closed"}`);
      return isOpen;
    } catch (error) {
      console.error("Error checking market status:", error.message);
      return false;
    }
  };

  // Schedule task to update market status daily at noon
  scheduleJob({ hour: 12, minute: 0, dayOfWeek: [1, 2, 3, 4, 5], tz: 'America/New_York' }, async () => {
    console.log("Updating market status at noon...");
    isMarketOpenToday = await checkMarketStatus();
    const channel = client.channels.cache.get(channelId);
    if (channel) {
      await channel.send(
        isMarketOpenToday
          ? "The market is open today. 🟢"
          : "The market is closed today. 🔴"
      );
    }
  });

  // Function to generate and send the daily gains report
  const generateDailyGainsReport = async () => {
    if (!isMarketOpenToday) {
      console.log("Market was closed today. Skipping daily gains report.");
      return;
    }

    console.log("Market was open today. Generating daily gains report...");

    try {
      const { report, totalDailyGain } = await fundManager.calculateDailyGainsReport();
      const channel = client.channels.cache.get(channelId);
      if (channel) {
        let message = `**Daily Gains Report**\nTotal Daily Gain: $${totalDailyGain}\n\n`;
        message += report
          .map(
            ({ ticker, quantity, gainPercentage, totalGain }) =>
              `Ticker: ${ticker}, Quantity: ${quantity}, % Gain: ${gainPercentage}%, Total Gain: $${totalGain}`
          )
          .join('\n');
        await channel.send(message);
      }
    } catch (error) {
      console.error("Error generating daily gains report:", error.message);
    }
  };

  // Schedule task to run daily after market close
  scheduleJob({ hour: 16, minute: 5, dayOfWeek: [1, 2, 3, 4, 5], tz: 'America/New_York' }, async () => {
    console.log("Generating daily gains report after market close...");
    await generateDailyGainsReport();
  });
};
