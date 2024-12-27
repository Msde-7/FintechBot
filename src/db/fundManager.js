import sqlite3 from 'sqlite3';
import StockPriceFetcher from '../api/StockPriceFetcher.js';

// Please tell me the afterlife is not async Javascript :(
class FundManager {
  constructor(dbPath = './src/db/fund_manager.db') {
    this.db = new sqlite3.Database(dbPath);
    this.stockPriceFetcher = new StockPriceFetcher('ctka619r01qntkqokiigctka619r01qntkqokij0');
    this.init();
  }

  init() {
    this.db.serialize(() => {
      this.db.run(`CREATE TABLE IF NOT EXISTS fund (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        date TEXT NOT NULL
      )`);

      this.db.run(`CREATE TABLE IF NOT EXISTS stocks (
        ticker TEXT PRIMARY KEY,
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        exit_price REAL,
        date TEXT NOT NULL,
        original_date TEXT NOT NULL,
        pitchers TEXT
      )`);

      this.db.run(`CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        options TEXT NOT NULL
      )`);

      this.db.run(`CREATE TABLE IF NOT EXISTS stock_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        date TEXT NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY (ticker) REFERENCES stocks(ticker)
      )`);
    });
  }

  logAction(action, options) {
    const optionsJSON = JSON.stringify(options);
    this.db.run(`INSERT INTO history (action, options) VALUES (?, ?)`, [action, optionsJSON]);
  }

  addStockPrice(ticker, date, price) {
    ticker = ticker.toUpperCase();
    this.db.run(
      `INSERT INTO stock_prices (ticker, date, price) VALUES (?, ?, ?)`,
      [ticker, date, price],
      (err) => {
        if (err) {
          console.error(`Error adding stock price for ${ticker} on ${date}:`, err.message);
        } else {
          console.log(`Added stock price for ${ticker} on ${date}: $${price}`);
        }
      }
    );
  }

  getStockPrices(ticker, callback) {
    ticker = ticker.toUpperCase();
    this.db.all(
      `SELECT date, price FROM stock_prices WHERE ticker = ? ORDER BY date`,
      [ticker],
      (err, rows) => {
        if (err) {
          console.error(`Error fetching stock prices for ${ticker}:`, err.message);
          callback(err, null);
        } else {
          callback(null, rows);
        }
      }
    );
  }

  async updateStockPrices(ticker) {
    ticker = ticker.toUpperCase();
    try {
      const prices = await this.stockPriceFetcher.getHistoricalPrices(ticker);
      prices.forEach(({ date, price }) => {
        this.addStockPrice(ticker, date, price);
      });
    } catch (error) {
      console.error(`Error updating stock prices for ${ticker}:`, error.message);
    }
  }

  addFund(amount, date) {
    this.logAction('fund', { amount, date });

    // Get the current fund amount (if any)
    this.db.get(`SELECT * FROM fund ORDER BY id DESC LIMIT 1`, (err, row) => {
      if (row) {
        // If there are funds, update the amount by adding the new funds
        const newFundAmount = row.amount + amount;
        this.db.run(`UPDATE fund SET amount = ? WHERE id = ?`, [newFundAmount, row.id]);
      } else {
        // If no funds exist, insert the new amount
        this.db.run(`INSERT INTO fund (amount, date) VALUES (?, ?)`, [amount, date]);
      }
    });
  }

  getFunds(callback) {
    // Get the current fund amount
    this.db.get(`SELECT * FROM fund ORDER BY id DESC LIMIT 1`, (err, row) => {
      if (row) {
        callback(null, row.amount);
      } else {
        callback('No fund data available', null);
      }
    });
  }

  addStock(ticker, quantity, price, exit_price, date, pitchers = []) {
    console.log(`${ticker} ${quantity} ${price} ${exit_price} ${date} Pitchers: ${pitchers.join(', ')}`);
    
    // Convert pitchers array into a comma-separated string
    const pitchersStr = pitchers.join(', ');

    // Calculate the amount spent to buy the stocks
    const totalCost = quantity * price;

    this.logAction('add', { ticker, quantity, price, exit_price, date, pitchers });

    // Update the fund amount by deducting the total cost
    this.db.get(`SELECT * FROM fund ORDER BY id DESC LIMIT 1`, (err, row) => {
      if (row) {
        const newFundAmount = row.amount - totalCost;
        if (newFundAmount < 0) {
          console.log('Insufficient funds to complete the purchase');
          return;
        }
        // Update the fund amount
        this.db.run(`UPDATE fund SET amount = ? WHERE id = ?`, [newFundAmount, row.id]);
      } else {
        console.log('No fund data available');
        return;
      }
    });

    // Insert or update the stock record
    this.db.get(`SELECT * FROM stocks WHERE ticker = ?`, [ticker], (err, row) => {
      if (row) {
        // Update stock with new quantity and pitchers
        this.db.run(
          `UPDATE stocks SET quantity = quantity + ?, pitchers = ? WHERE ticker = ?`,
          [quantity, pitchersStr, ticker]
        );
      } else {
        // Insert new stock with pitchers
        this.db.run(
          `INSERT INTO stocks (ticker, quantity, price, exit_price, date, original_date, pitchers) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [ticker, quantity, price, exit_price, date, date, pitchersStr]
        );
      }
    });

    this.addStockPrice(ticker, date, price);
  }

  deleteStock(ticker, quantity, date) {
    ticker = ticker.toUpperCase();
    console.log(`Deleting stock: ${ticker} Quantity: ${quantity} Date: ${date}`);
    
    this.logAction('delete', { ticker, quantity, date });

    // Get the stock record
    this.db.get(`SELECT * FROM stocks WHERE ticker = ?`, [ticker], (err, row) => {
      if (row) {
        const newQuantity = row.quantity - quantity;
        if (newQuantity <= 0) {
          // If deleting all or more than available, remove the stock
          this.db.run(`DELETE FROM stocks WHERE ticker = ?`, [ticker]);

          // Calculate the amount gained from selling the stock
          const totalRevenue = quantity * row.exit_price;

          // Update the fund amount by adding the revenue
          this.db.get(`SELECT * FROM fund ORDER BY id DESC LIMIT 1`, (err, fundRow) => {
            if (fundRow) {
              const newFundAmount = fundRow.amount + totalRevenue;
              this.db.run(`UPDATE fund SET amount = ? WHERE id = ?`, [newFundAmount, fundRow.id]);
            }
          });
        } else {
          // Update the stock with the reduced quantity
          this.db.run(`UPDATE stocks SET quantity = ? WHERE ticker = ?`, [newQuantity, ticker]);

          // Calculate the amount gained from selling the stock
          const totalRevenue = quantity * row.exit_price;

          // Update the fund amount by adding the revenue
          this.db.get(`SELECT * FROM fund ORDER BY id DESC LIMIT 1`, (err, fundRow) => {
            if (fundRow) {
              const newFundAmount = fundRow.amount + totalRevenue;
              this.db.run(`UPDATE fund SET amount = ? WHERE id = ?`, [newFundAmount, fundRow.id]);
            }
          });
        }
      }
    });
  }

  async calculateStockPerformance(ticker, time_used = "current") {
    try {
      let price = 0;
      switch (time_used) {
        case "open":
          price = await this.stockPriceFetcher.getMarketOpenPrice(ticker);
          break;
        case "close":
          price = await this.stockPriceFetcher.getMarketClosePrice(ticker);
          break;
        default:
          price = await this.stockPriceFetcher.getCurrentPrice(ticker);
          break;
      }
      return price;
    } catch (error) {
      console.error(`Error calculating performance for ${ticker}:`, error.message);
      throw new Error("Failed to fetch stock performance.");
    }
  }

  //Pain 
  async calculateFundReport(time_used = "current") {
    try {
      const funds = await new Promise((resolve, reject) => {
        this.getFunds((err, result) => {
          if (err) {
            console.error("Error fetching funds:", err.message);
            reject(err);
          } else {
            resolve(result || 0);
          }
        });
      });
  
      return new Promise((resolve, reject) => {
        this.db.all(`SELECT ticker, quantity, price FROM stocks`, async (err, rows) => {
          if (err) {
            console.error("Error fetching stocks from database:", err.message);
            return reject("Failed to fetch stocks.");
          }
  
          if (!rows || rows.length === 0) {
            console.log("No stocks found in the portfolio.");
            resolve({ report: [], funds, totalFundGain: "0.00", totalFundGainPercentage: "0.00" });
            return;
          }
  
          const report = [];
          let totalPurchaseValue = 0;
          let totalMarketValue = 0;
  
          for (const stock of rows) {
            const { ticker, quantity, price: purchasePrice } = stock;
  
            if (!ticker || !quantity || !purchasePrice) {
              console.warn(`Skipping invalid stock record: ${JSON.stringify(stock)}`);
              continue;
            }
  
            try {
              const price = await this.calculateStockPerformance(ticker, time_used);
              const gainPerStock = price - purchasePrice;
              const totalGain = gainPerStock * quantity;
              const gainPercentage = purchasePrice
                ? ((gainPerStock / purchasePrice) * 100).toFixed(2)
                : "0.00";
  
              totalPurchaseValue += purchasePrice * quantity;
              totalMarketValue += price * quantity;
  
              report.push({
                ticker,
                quantity,
                purchasePrice: purchasePrice.toFixed(2),
                price: price.toFixed(2),
                gainPerStock: gainPerStock.toFixed(2),
                totalGain: totalGain.toFixed(2),
                gainPercentage,
              });
            } catch (error) {
              console.error(`Error processing stock ${ticker}:`, error.message);
            }
          }
  
          const totalFundGain = totalMarketValue - totalPurchaseValue;
          const totalFundGainPercentage = ((totalFundGain) / (funds + totalPurchaseValue) * 100).toFixed(2);
  
          resolve({
            report,
            funds: funds.toFixed(2),
            totalFundGain: totalFundGain.toFixed(2),
            totalFundGainPercentage,
          });
        });
      });
    } catch (error) {
      console.error("Error in calculateFundReport:", error.message);
      throw error;
    }
  }

  getStockInfo(ticker, callback) {
    ticker = ticker.toUpperCase();
    this.db.get(`SELECT * FROM stocks WHERE ticker = ?`, [ticker], async (err, row) => {
        if (err) {
            console.error(`Error retrieving stock info for ${ticker}:`, err.message);
            callback(err, null);
            return;
        }

        if (!row) {
            console.log(`No stock found with ticker: ${ticker}`);
            callback(null, null);
            return;
        }

        const { quantity, price: entryPrice, pitchers, original_date } = row;

        try {
            // Fetch the most recent price
            const recentPrice = await this.stockPriceFetcher.getCurrentPrice(ticker);

            const totalOriginalWorth = (entryPrice * quantity).toFixed(2);
            const totalRecentWorth = (recentPrice * quantity).toFixed(2);
            const totalGain = (recentPrice - entryPrice) * quantity;
            const percentageGain = entryPrice
                ? ((totalGain / (entryPrice * quantity)) * 100).toFixed(2)
                : "0.00";

            callback(null, {
                ticker,
                entryPrice: entryPrice.toFixed(2),
                totalOriginalWorth,
                amountBought: quantity,
                mostRecentPrice: recentPrice.toFixed(2),
                totalRecentWorth,
                amountGained: totalGain.toFixed(2),
                percentageGained: percentageGain,
                pitchers: pitchers.split(", "),
                dateBought: original_date, // Include the original_date as dateBought
            });
        } catch (error) {
            console.error(`Error fetching recent price for ${ticker}:`, error.message);
            callback(error, null);
        }
    });
  }
  
  async updateDailyGains() {
    try {
      // Fetch all stocks from the database
      this.db.all(`SELECT ticker FROM stocks`, async (err, rows) => {
        if (err) {
          console.error("Error fetching stocks from database:", err.message);
          return;
        }
  
        if (!rows || rows.length === 0) {
          console.log("No stocks found in the portfolio.");
          return;
        }
  
        for (const { ticker } of rows) {
          try {
            const today = new Date();
            const todayDate = today.toISOString().split('T')[0];
  
            // Fetch today's close price
            const todayClosePrice = await this.stockPriceFetcher.getMarketClosePrice(ticker);
  
            // Find the most recent date in the database
            const recentDateRow = await new Promise((resolve) => {
              this.db.get(
                `SELECT date, price FROM stock_prices WHERE ticker = ? ORDER BY date DESC LIMIT 1`,
                [ticker],
                (checkErr, row) => {
                  if (checkErr) {
                    console.error(`Error fetching the most recent date for ${ticker}:`, checkErr.message);
                    resolve(null);
                  } else {
                    resolve(row);
                  }
                }
              );
            });
  
            if (recentDateRow) {
              console.log(
                `Most recent price for ${ticker} on ${recentDateRow.date}: $${recentDateRow.price}`
              );
            } else {
              console.log(`No historical prices found for ${ticker}.`);
            }
  
            // Insert today's close price into the database
            this.db.run(
              `INSERT INTO stock_prices (ticker, date, price) VALUES (?, ?, ?)`,
              [ticker, todayDate, todayClosePrice],
              (insertErr) => {
                if (insertErr) {
                  console.error(`Error inserting today's price for ${ticker}:`, insertErr.message);
                } else {
                  console.log(`Inserted today's price for ${ticker}: $${todayClosePrice}`);
                }
              }
            );
          } catch (error) {
            console.error(`Error updating daily gains for ${ticker}:`, error.message);
          }
        }
      });
    } catch (error) {
      console.error("Error in updateDailyGains:", error.message);
      throw error;
    }
  }

  undoLastAction() {
    this.db.get(`SELECT * FROM history ORDER BY id DESC LIMIT 1`, (err, lastActionRow) => {
        if (err) {
            console.error('Error retrieving last action:', err);
            return;
        }
        if (!lastActionRow) {
            console.log('No actions to undo.');
            return;
        }

        const { action, options } = lastActionRow;
        const parsedOptions = JSON.parse(options);

        if (action === 'fund') {
            const { amount } = parsedOptions;

            // Undo the fund by removing the last fund record or setting it to zero
            this.db.get(`SELECT * FROM fund ORDER BY id DESC LIMIT 1`, (err, row) => {
                if (err || !row) {
                    console.error('No fund record to undo:', err);
                    return;
                }

                const newAmount = row.amount - amount;
                if (newAmount <= 0) {
                    this.db.run(`DELETE FROM fund WHERE id = ?`, [row.id]);
                } else {
                    this.db.run(`UPDATE fund SET amount = ? WHERE id = ?`, [newAmount, row.id]);
                }
                console.log(`Undid funding of $${amount}. Fund balance updated.`);
            });
        } else if (action === 'add') {
            const { ticker, quantity, price } = parsedOptions;
            const totalCost = quantity * price;

            // Refund the fund for the cost of stocks
            this.db.get(`SELECT * FROM fund ORDER BY id DESC LIMIT 1`, (err, fundRow) => {
                if (err || !fundRow) {
                    console.error('No fund record to update:', err);
                    return;
                }

                const newFundAmount = fundRow.amount + totalCost;
                this.db.run(`UPDATE fund SET amount = ? WHERE id = ?`, [newFundAmount, fundRow.id]);
                console.log(`Refunded $${totalCost} to fund.`);
            });

            // Remove or update the stock record
            this.db.get(`SELECT * FROM stocks WHERE ticker = ?`, [ticker], (err, stockRow) => {
                if (err) {
                    console.error('Error retrieving stock:', err);
                    return;
                }

                if (!stockRow || stockRow.quantity <= quantity) {
                    this.db.run(`DELETE FROM stocks WHERE ticker = ?`, [ticker], () => {
                        console.log(`Deleted stock: ${ticker}`);
                    });
                } else {
                    const newQuantity = stockRow.quantity - quantity;
                    this.db.run(`UPDATE stocks SET quantity = ? WHERE ticker = ?`, [newQuantity, ticker], () => {
                        console.log(`Updated stock: ${ticker} with new quantity: ${newQuantity}`);
                    });
                }
            });
        } else if (action === 'delete') {
            const { ticker, quantity, price, exit_price, date } = parsedOptions;
            const totalRevenue = quantity * exit_price;

            // Reverse stock deletion
            this.db.get(`SELECT * FROM stocks WHERE ticker = ?`, [ticker], (err, stockRow) => {
                if (err) {
                    console.error('Error retrieving stock:', err);
                    return;
                }

                if (!stockRow) {
                    this.db.run(
                        `INSERT INTO stocks (ticker, quantity, price, exit_price, date, original_date) VALUES (?, ?, ?, ?, ?, ?)`,
                        [ticker, quantity, price, exit_price, date, date],
                        () => console.log(`Restored stock: ${ticker} with quantity: ${quantity}`)
                    );
                } else {
                    const newQuantity = stockRow.quantity + quantity;
                    this.db.run(`UPDATE stocks SET quantity = ? WHERE ticker = ?`, [newQuantity, ticker], () => {
                        console.log(`Updated stock: ${ticker} with new quantity: ${newQuantity}`);
                    });
                }
            });

            // Deduct the refunded revenue from the fund
            this.db.get(`SELECT * FROM fund ORDER BY id DESC LIMIT 1`, (err, fundRow) => {
                if (err || !fundRow) {
                    console.error('No fund record to update:', err);
                    return;
                }

                const newFundAmount = fundRow.amount - totalRevenue;
                this.db.run(`UPDATE fund SET amount = ? WHERE id = ?`, [newFundAmount, fundRow.id]);
                console.log(`Deducted $${totalRevenue} from fund.`);
            });
        }

        // Remove the last action from history
        this.db.run(`DELETE FROM history WHERE id = ?`, [lastActionRow.id], (err) => {
            if (err) {
                console.error('Error deleting action from history:', err);
                return;
            }
            console.log(`Undid action: ${action}`);
        });
    });
}

async calculateDailyGainsReport() {
  try {
    // Ensure daily gains are updated
    await this.updateDailyGains();

    return new Promise((resolve, reject) => {
      this.db.all(`SELECT ticker, quantity FROM stocks`, async (err, rows) => {
        if (err) {
          console.error("Error fetching stocks from the database:", err.message);
          return reject(new Error("Failed to fetch stocks."));
        }

        if (!rows || rows.length === 0) {
          console.log("No stocks found in the portfolio.");
          resolve({ report: [], totalDailyGain: "0.00" });
          return;
        }

        const report = [];
        let totalDailyGain = 0;

        for (const stock of rows) {
          const { ticker, quantity } = stock;

          if (!ticker || quantity === undefined || quantity <= 0) {
            console.warn(`Skipping invalid stock record: ${JSON.stringify(stock)}`);
            continue;
          }

          try {
            // Fetch today's and the most recent prior prices
            const today = new Date().toISOString().split('T')[0];

            const todayPrice = await new Promise((resolvePrice) => {
              this.db.get(
                `SELECT price FROM stock_prices WHERE ticker = ? AND date = ?`,
                [ticker, today],
                (checkErr, row) => {
                  if (checkErr || !row) {
                    console.error(`Error fetching today's price for ${ticker}:`, checkErr?.message || "No data");
                    resolvePrice(null);
                  } else {
                    resolvePrice(row.price);
                  }
                }
              );
            });

            const recentPrice = await new Promise((resolvePrice) => {
              this.db.get(
                `SELECT price FROM stock_prices WHERE ticker = ? ORDER BY date DESC LIMIT 1 OFFSET 1`,
                [ticker],
                (checkErr, row) => {
                  if (checkErr || !row) {
                    console.error(`Error fetching recent prior price for ${ticker}:`, checkErr?.message || "No data");
                    resolvePrice(null);
                  } else {
                    resolvePrice(row.price);
                  }
                }
              );
            });

            // If either price is missing, skip calculation
            if (todayPrice === null || recentPrice === null) {
              console.warn(`Skipping stock ${ticker} due to missing price data.`);
              continue;
            }

            // Calculate daily gain
            const dailyGainPerStock = todayPrice - recentPrice;
            const totalGain = dailyGainPerStock * quantity;
            const gainPercentage = ((dailyGainPerStock / recentPrice) * 100).toFixed(2);

            totalDailyGain += totalGain;

            report.push({
              ticker,
              quantity,
              recentPrice: recentPrice.toFixed(2),
              todayPrice: todayPrice.toFixed(2),
              gainPercentage,
              totalGain: totalGain.toFixed(2),
            });
          } catch (error) {
            console.error(`Error processing stock ${ticker}:`, error.message);
          }
        }

        // Sort the report by percentage gained in descending order
        report.sort((a, b) => parseFloat(b.gainPercentage) - parseFloat(a.gainPercentage));

        resolve({
          report,
          totalDailyGain: totalDailyGain.toFixed(2),
        });
      });
    });
  } catch (error) {
    console.error("Error in calculateDailyGainsReport:", error.message);
    throw error;
  }
}

  undoAllActions() {
    this.db.all(`SELECT * FROM history ORDER BY id DESC`, (err, rows) => {
      rows.forEach(() => this.undoLastAction());
      console.log('All actions undone.');
    });
  }
}

export default FundManager;
