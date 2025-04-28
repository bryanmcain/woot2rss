require('dotenv').config();
const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  wootApi: {
    baseUrl: process.env.WOOT_API_BASE_URL || 'https://developer.woot.com',
    apiKey: process.env.WOOT_API_KEY,
  },
  db: {
    path: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'woot.db'),
    maxItems: parseInt(process.env.MAX_ITEMS || '1000', 10), // Max items to keep in database
  },
  updateInterval: process.env.UPDATE_INTERVAL || '*/30 * * * *', // Default: every 30 minutes
  checkNewItemsInterval: process.env.CHECK_NEW_ITEMS_INTERVAL || '*/10 * * * *', // Default: check for new items every 10 minutes
};