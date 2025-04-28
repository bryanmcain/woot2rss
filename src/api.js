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

  async getListings() {
    console.log('Attempting to fetch listings from Woot API...');
    try {
      // Use the feed/All endpoint per the working curl command
      console.log(`Making request to: ${this.client.defaults.baseURL}/feed/All`);
      const response = await this.client.get('/feed/All');
      console.log(`Successfully received listings data. Items: ${JSON.stringify(response.data).substring(0, 100)}...`);
      return response.data;
    } catch (error) {
      console.error('Error fetching listings from Woot API:', error.message);
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
      // Use the listings feed to get current offers
      const data = await this.getListings();
      const offers = data && data.Items ? data.Items : [];
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

}

module.exports = new WootApi();