import finnhub from 'finnhub';

class StockPriceFetcher {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.finnhubClient = new finnhub.DefaultApi();
    const api_key = finnhub.ApiClient.instance.authentications['api_key'];
    api_key.apiKey = this.apiKey;
  }

  // Fetch the market open price
  async getMarketOpenPrice(ticker) {
    return new Promise((resolve, reject) => {
      this.finnhubClient.quote(ticker, (error, data, response) => {
        if (error) {
          console.error(`Error fetching market open price for ${ticker}:`, error.message);
          reject(new Error('Failed to fetch market open price.'));
        } else {
          const openPrice = data.o;
          console.log(`Market open price for ${ticker}: $${openPrice}`);
          resolve(openPrice);
        }
      });
    });
  }

  // Fetch the most recent (current) price
  async getCurrentPrice(ticker) {
    return new Promise((resolve, reject) => {
      this.finnhubClient.quote(ticker, (error, data, response) => {
        if (error) {
          console.error(`Error fetching current price for ${ticker}:`, error.message);
          reject(new Error('Failed to fetch current price.'));
        } else {
          const currentPrice = data.c;
          console.log(`Current price for ${ticker}: $${currentPrice}`);
          resolve(currentPrice);
        }
      });
    });
  }

  // Fetch the previous market close price
  async getMarketClosePrice(ticker) {
    return new Promise((resolve, reject) => {
      this.finnhubClient.quote(ticker, (error, data, response) => {
        if (error) {
          console.error(`Error fetching market close price for ${ticker}:`, error.message);
          reject(new Error('Failed to fetch market close price.'));
        } else {
          const closePrice = data.pc;
          console.log(`Market close price for ${ticker}: $${closePrice}`);
          resolve(closePrice);
        }
      });
    });
  }
}

export default StockPriceFetcher;
