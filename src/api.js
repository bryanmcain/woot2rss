const axios = require('axios');
const config = require('./config');

class WootApi {
  constructor() {
    this.client = axios.create({
      baseURL: config.wootApi.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.wootApi.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  async getNamedFeed(feedName = 'daily') {
    try {
      // Using the getNamedFeed endpoint from Woot API documentation
      const response = await this.client.get(`/v1/feeds/${feedName}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching '${feedName}' feed from Woot API:`, error.message);
      if (error.response) {
        console.error('API Response:', error.response.data);
        console.error('Status:', error.response.status);
      }
      return [];
    }
  }

  async getOffers() {
    try {
      // Use the named feed endpoint to get current offers
      const data = await this.getNamedFeed('daily');
      return data.offers || [];
    } catch (error) {
      console.error('Error fetching offers from Woot API:', error.message);
      return [];
    }
  }

  async getEvents() {
    try {
      // Use the named feed endpoint to get current events
      const data = await this.getNamedFeed('events');
      return data.events || [];
    } catch (error) {
      console.error('Error fetching events from Woot API:', error.message);
      return [];
    }
  }
}

module.exports = new WootApi();