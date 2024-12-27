import axios from 'axios';

class StockPriceFetcher {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://finnhub.io/api/v1';
  }

  // Fetch the market open price
  async getMarketOpenPrice(ticker) {
    try {
      const response = await axios.get(`${this.baseURL}/quote`, {
        params: {
          symbol: ticker,
          token: this.apiKey,
        },
      });

      const { o: openPrice } = response.data;
      console.log(`Market open price for ${ticker}: $${openPrice}`);
      return openPrice;
    } catch (error) {
      console.error(`Error fetching market open price for ${ticker}:`, error.message);
      throw new Error('Failed to fetch market open price.');
    }
  }

  // Fetch the most recent (current) price
  async getCurrentPrice(ticker) {
    try {
      const response = await axios.get(`${this.baseURL}/quote`, {
        params: {
          symbol: ticker,
          token: this.apiKey,
        },
      });

      const { c: currentPrice } = response.data;
      console.log(`Current price for ${ticker}: $${currentPrice}`);
      return currentPrice;
    } catch (error) {
      console.error(`Error fetching current price for ${ticker}:`, error.message);
      throw new Error('Failed to fetch current price.');
    }
  }

  async getMarketClosePrice(ticker) {
    try {
      const response = await axios.get(`${this.baseURL}/quote`, {
        params: {
          symbol: ticker,
          token: this.apiKey,
        },
      });

      const { pc: closePrice } = response.data;
      console.log(`Market close price for ${ticker}: $${closePrice}`);
      return closePrice;
    } catch (error) {
      console.error(`Error fetching market close price for ${ticker}:`, error.message);
      throw new Error('Failed to fetch market close price.');
    }
  }

  async isMarketOpen() {
    try {
      const response = await axios.get(`${this.baseURL}/market/clock`, {
        params: {
          token: this.apiKey,
        },
      });

      const { is_open: isOpen } = response.data;
      console.log(`Market is currently ${isOpen ? 'open' : 'closed'}.`);
      return isOpen;
    } catch (error) {
      console.error('Error fetching market status:', error.message);
      throw new Error('Failed to fetch market status.');
    }
  }

}

export default StockPriceFetcher;
