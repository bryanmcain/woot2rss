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
    
    // Define available categories
    this.categories = [
      'Clearance',
      'Computers',
      'Electronics',
      'Featured',
      'Home',
      'Gourmet',
      'Shirts',
      'Sports',
      'Tools',
      'Wootoff'
    ];
  }

  async getListings(category = 'All') {
    console.log(`Attempting to fetch listings from Woot API for category: ${category}...`);
    try {
      // Use the feed/{category} endpoint per the working curl command
      console.log(`Making request to: ${this.client.defaults.baseURL}/feed/${category}`);
      const response = await this.client.get(`/feed/${category}`);
      console.log(`Successfully received listings data for ${category}. Items: ${JSON.stringify(response.data).substring(0, 100)}...`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching listings from Woot API for category ${category}:`, error.message);
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

  async getOffers(category = 'All') {
    console.log(`Fetching offers from Woot API for category: ${category}...`);
    try {
      // Use the listings feed to get current offers
      const data = await this.getListings(category);
      const offers = data && data.Items ? data.Items : [];
      console.log(`Retrieved ${offers.length} offers for category ${category}`);
      if (offers.length > 0) {
        console.log(`First offer: ${JSON.stringify(offers[0]).substring(0, 150)}...`);
      } else {
        console.log(`No offers found in the API response for category ${category}`);
        console.log(`Raw response data: ${JSON.stringify(data).substring(0, 200)}...`);
      }
      return offers;
    } catch (error) {
      console.error(`Error fetching offers from Woot API for category ${category}:`, error.message);
      return [];
    }
  }
  
  async getAllCategoryOffers() {
    console.log('Fetching offers for all categories...');
    const categoryOffers = {};
    
    // Fetch offers for each category in parallel
    await Promise.all(this.categories.map(async (category) => {
      try {
        const offers = await this.getOffers(category);
        categoryOffers[category] = offers;
        console.log(`Fetched ${offers.length} offers for category ${category}`);
      } catch (error) {
        console.error(`Error fetching offers for category ${category}:`, error.message);
        categoryOffers[category] = [];
      }
    }));
    
    // Also fetch the "All" feed for backward compatibility
    try {
      const allOffers = await this.getOffers();
      categoryOffers['All'] = allOffers;
      console.log(`Fetched ${allOffers.length} offers for All categories`);
    } catch (error) {
      console.error('Error fetching offers for All categories:', error.message);
      categoryOffers['All'] = [];
    }
    
    return categoryOffers;
  }
  
  async getSpecificCategoryOffers(category) {
    console.log(`Fetching offers only for category ${category}...`);
    
    if (category === 'All' || this.categories.includes(category)) {
      try {
        const offers = await this.getOffers(category);
        console.log(`Fetched ${offers.length} offers for category ${category}`);
        return { [category]: offers };
      } catch (error) {
        console.error(`Error fetching offers for category ${category}:`, error.message);
        return { [category]: [] };
      }
    } else {
      console.error(`Invalid category: ${category}`);
      return { [category]: [] };
    }
  }
}

module.exports = new WootApi();