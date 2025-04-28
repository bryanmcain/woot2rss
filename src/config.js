require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  wootApi: {
    baseUrl: process.env.WOOT_API_BASE_URL || 'https://api.woot.com',
    apiKey: process.env.WOOT_API_KEY,
  },
  updateInterval: process.env.UPDATE_INTERVAL || '*/30 * * * *', // Default: every 30 minutes
};