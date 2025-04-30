const axios = require('axios');
const config = require('./config');
const logger = require('./logger');

class WootApi {
  constructor() {
    logger.info(`Initializing Woot API client with baseURL: ${config.wootApi.baseUrl}`);
    logger.info(`API Key present: ${config.wootApi.apiKey ? 'Yes' : 'No'}`);
    
    this.client = axios.create({
      baseURL: config.wootApi.baseUrl,
      headers: {
        'x-api-key': config.wootApi.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    
    // Define available categories (these will be detected from the API response based on Site property)
    this.knownSites = new Set([
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
    ]);
  }

  async getAllListings() {
    logger.info(`Attempting to fetch all listings from Woot API using the /All endpoint...`);
    try {
      // Use the feed/All endpoint to get all offers in a single call
      const url = `${this.client.defaults.baseURL}/feed/All`;
      logger.debug('REQUEST DETAILS', {
        url: url,
        headers: this.client.defaults.headers
      });
      
      const response = await this.client.get(`/feed/All`);
      
      // Log API response summary for debugging
      if (response.data && response.data.Items) {
        logger.debug('WOOT API RESPONSE SUMMARY', {
          totalItems: response.data.Items.length,
          totalPages: response.data.TotalPages || 'N/A',
          marketingName: response.data.MarketingName || 'N/A'
        });
      }
      
      return response.data;
    } catch (error) {
      logger.error(`Error fetching listings from Woot API: ${error.message}`);
      
      if (error.response) {
        logger.error('API Error Details', {
          response: error.response.data,
          status: error.response.status,
          headers: error.response.headers
        });
      } else if (error.request) {
        logger.error('No response received from API', {
          url: error.request._currentUrl,
          method: error.request.method
        });
      } else {
        logger.error(`Error setting up request: ${error.message}`);
      }
      return { Items: [] };
    }
  }

  async getAllOffers() {
    logger.info('Fetching all offers and categorizing by Site...');
    try {
      // Get all listings from the /All endpoint
      const data = await this.getAllListings();
      const allOffers = data && data.Items ? data.Items : [];
      
      logger.info(`Retrieved ${allOffers.length} total offers from /All endpoint`);
      
      // Organize offers by their Site property
      const categorizedOffers = {};
      const uncategorizedOffers = [];
      const sitesFound = new Set();
      
      for (const offer of allOffers) {
        const site = offer.Site;
        
        if (site) {
          // Add to our set of known sites
          sitesFound.add(site);
          
          // Initialize the array for this site if it doesn't exist
          if (!categorizedOffers[site]) {
            categorizedOffers[site] = [];
          }
          
          // Add the offer to its site category
          categorizedOffers[site].push(offer);
        } else {
          // Track offers without a Site property
          uncategorizedOffers.push(offer);
        }
      }
      
      // Log statistics about the categorization
      logger.info(`Categorized ${allOffers.length - uncategorizedOffers.length} offers into ${sitesFound.size} sites`);
      if (uncategorizedOffers.length > 0) {
        logger.warn(`Found ${uncategorizedOffers.length} offers without a Site property`);
      }
      
      // Log the sites we found
      logger.info(`Sites found in API response: ${Array.from(sitesFound).join(', ')}`);
      
      // Update our known sites list with any new sites found
      for (const site of sitesFound) {
        this.knownSites.add(site);
      }
      
      return categorizedOffers;
    } catch (error) {
      logger.error(`Error processing offers from Woot API: ${error.message}`);
      return {};
    }
  }
  
  // This method is maintained for backward compatibility
  async getAllCategoryOffers() {
    return this.getAllOffers();
  }
  
  // This method is maintained for backward compatibility
  async getSpecificCategoryOffers(category) {
    logger.info(`Fetching offers for category ${category} from all offers...`);
    
    const allOffers = await this.getAllOffers();
    
    if (allOffers[category]) {
      logger.info(`Found ${allOffers[category].length} offers for category ${category}`);
      return { [category]: allOffers[category] };
    } else {
      logger.warn(`No offers found for category ${category}`);
      return { [category]: [] };
    }
  }
}

module.exports = new WootApi();