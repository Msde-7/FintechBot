import sqlite3 from 'sqlite3';

class FundManager {
  constructor(dbPath = './src/db/fund_manager.db') {
    this.db = new sqlite3.Database(dbPath);
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
    });
  }

  logAction(action, options) {
    const optionsJSON = JSON.stringify(options);
    this.db.run(`INSERT INTO history (action, options) VALUES (?, ?)`, [action, optionsJSON]);
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
  }

  deleteStock(ticker, quantity, date) {
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

  undoLastAction() {
    this.db.get(`SELECT * FROM history ORDER BY id DESC LIMIT 1`, (err, lastActionRow) => {
      if (!lastActionRow) {
        console.log('No actions to undo.');
        return;
      }

      const { action, options } = JSON.parse(lastActionRow.options);

      if (action === 'fund') {
        this.db.run(`DELETE FROM fund WHERE rowid = (SELECT MAX(rowid) FROM fund)`);
      } else if (action === 'add') {
        const { ticker, quantity, price } = options;
        const totalCost = quantity * price;
        
        // Undo adding a stock (decrease the fund amount)
        this.db.get(`SELECT * FROM fund ORDER BY id DESC LIMIT 1`, (err, fundRow) => {
          if (fundRow) {
            const newFundAmount = fundRow.amount + totalCost;
            this.db.run(`UPDATE fund SET amount = ? WHERE id = ?`, [newFundAmount, fundRow.id]);
          }
        });

        this.db.get(`SELECT * FROM stocks WHERE ticker = ?`, [ticker], (err, row) => {
          if (row) {
            const newQuantity = row.quantity - quantity;
            if (newQuantity <= 0) {
              this.db.run(`DELETE FROM stocks WHERE ticker = ?`, [ticker]);
            } else {
              this.db.run(`UPDATE stocks SET quantity = ? WHERE ticker = ?`, [newQuantity, ticker]);
            }
          }
        });
      } else if (action === 'delete') {
        const { ticker, quantity, price, exit_price, date } = options;
        this.db.get(`SELECT * FROM stocks WHERE ticker = ?`, [ticker], (err, row) => {
          if (!row) {
            this.db.run(
              `INSERT INTO stocks (ticker, quantity, price, exit_price, date, original_date) VALUES (?, ?, ?, ?, ?, ?)`,
              [ticker, quantity, price, exit_price, date, date]
            );
          } else {
            this.db.run(
              `UPDATE stocks SET quantity = quantity + ? WHERE ticker = ?`,
              [quantity || 0, ticker]
            );
          }
        });

        // Undo selling a stock (decrease the fund amount)
        const totalRevenue = quantity * exit_price;
        this.db.get(`SELECT * FROM fund ORDER BY id DESC LIMIT 1`, (err, fundRow) => {
          if (fundRow) {
            const newFundAmount = fundRow.amount - totalRevenue;
            this.db.run(`UPDATE fund SET amount = ? WHERE id = ?`, [newFundAmount, fundRow.id]);
          }
        });
      }

      this.db.run(`DELETE FROM history WHERE id = ?`, [lastActionRow.id]);
      console.log(`Undid action: ${action}`);
    });
  }

  undoAllActions() {
    this.db.all(`SELECT * FROM history ORDER BY id DESC`, (err, rows) => {
      rows.forEach(() => this.undoLastAction());
      console.log('All actions undone.');
    });
  }
}

export default FundManager;
