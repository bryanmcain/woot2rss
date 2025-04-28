const axios = require('axios');
const config = require('./config');

class WootApi {
  constructor() {
    console.log(`Initializing Woot API client with baseURL: ${config.wootApi.baseUrl}`);
    console.log(`API Key present: ${config.wootApi.apiKey ? 'Yes' : 'No'}`);
    
    this.client = axios.create({
      baseURL: config.wootApi.baseUrl,
      headers: {
        'x-api-key': config.wootApi.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  async getNamedFeed(feedName = 'daily') {
    console.log(`Attempting to fetch '${feedName}' feed from Woot API...`);
    try {
      // Use the API endpoint format from documentation
      console.log(`Making request to: ${this.client.defaults.baseURL}/api/v1/feeds/${feedName}`);
      const response = await this.client.get(`/api/v1/feeds/${feedName}`);
      console.log(`Successfully received '${feedName}' feed data. Items: ${JSON.stringify(response.data).substring(0, 100)}...`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching '${feedName}' feed from Woot API:`, error.message);
      console.error(`Full error object: ${JSON.stringify(error)}`);
      if (error.response) {
        console.error('API Response:', error.response.data);
        console.error('Status:', error.response.status);
        console.error('Headers:', JSON.stringify(error.response.headers));
      } else if (error.request) {
        console.error('No response received from API. Request details:', error.request._currentUrl);
        console.error('Request method:', error.request.method);
      } else {
        console.error('Error setting up request:', error.message);
      }
      return [];
    }
  }

  async getOffers() {
    console.log('Fetching offers from Woot API...');
    try {
      // Use the named feed endpoint to get current offers
      const data = await this.getNamedFeed('daily');
      const offers = data.offers || [];
      console.log(`Retrieved ${offers.length} offers`);
      if (offers.length > 0) {
        console.log(`First offer: ${JSON.stringify(offers[0]).substring(0, 150)}...`);
      } else {
        console.log('No offers found in the API response');
        console.log(`Raw response data: ${JSON.stringify(data).substring(0, 200)}...`);
      }
      return offers;
    } catch (error) {
      console.error('Error fetching offers from Woot API:', error.message);
      return [];
    }
  }

  async getEvents() {
    console.log('Fetching events from Woot API...');
    try {
      // Use the named feed endpoint to get current events
      const data = await this.getNamedFeed('events');
      const events = data.events || [];
      console.log(`Retrieved ${events.length} events`);
      if (events.length > 0) {
        console.log(`First event: ${JSON.stringify(events[0]).substring(0, 150)}...`);
      } else {
        console.log('No events found in the API response');
        console.log(`Raw response data: ${JSON.stringify(data).substring(0, 200)}...`);
      }
      return events;
    } catch (error) {
      console.error('Error fetching events from Woot API:', error.message);
      return [];
    }
  }
}

module.exports = new WootApi();