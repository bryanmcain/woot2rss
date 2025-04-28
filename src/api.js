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

  async getOffers() {
    try {
      // This endpoint is an assumption - you'll need to replace with actual endpoint
      const response = await this.client.get('/api/v1/offers');
      return response.data;
    } catch (error) {
      console.error('Error fetching offers from Woot API:', error.message);
      if (error.response) {
        console.error('API Response:', error.response.data);
        console.error('Status:', error.response.status);
      }
      return [];
    }
  }

  async getEvents() {
    try {
      // This endpoint is an assumption - you'll need to replace with actual endpoint
      const response = await this.client.get('/api/v1/events');
      return response.data;
    } catch (error) {
      console.error('Error fetching events from Woot API:', error.message);
      if (error.response) {
        console.error('API Response:', error.response.data);
        console.error('Status:', error.response.status);
      }
      return [];
    }
  }
}

module.exports = new WootApi();