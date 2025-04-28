const { Feed } = require('feed');
const wootApi = require('./api');
const db = require('./db');

class RssGenerator {
  constructor() {
    this.createFeedTemplate = (category = null) => {
      const title = category ? `Woot Deals - ${category}` : 'Woot Deals';
      const description = category ? `Latest ${category} deals from Woot` : 'Latest deals from Woot';
      const link = category ? `https://www.woot.com/category/${category.toLowerCase()}` : 'https://www.woot.com/';
      
      return new Feed({
        title: title,
        description: description,
        id: link,
        link: link,
        language: 'en',
        favicon: 'https://www.woot.com/favicon.ico',
        copyright: `All rights reserved ${new Date().getFullYear()}, Woot`,
        updated: new Date(),
        generator: 'Woot2RSS',
        feedLinks: {
          rss: category ? `/rss/${category.toLowerCase()}` : '/rss',
        },
      });
    };
    
    // Map to store cached feeds by category
    this.cached = new Map();
    this.lastUpdated = null;
    
    // Store the categories from the API
    this.categories = ['All', ...wootApi.categories];
  }

  async fetchAndStoreOffers() {
    try {
      console.log('Fetching offers from Woot API for all categories...');
      
      // Fetch data from Woot API for all categories
      const categoryOffers = await wootApi.getAllCategoryOffers();
      let totalSavedCount = 0;
      
      // Process each category
      for (const [category, offers] of Object.entries(categoryOffers)) {
        console.log(`Processing ${offers.length} offers from category ${category}...`);
        
        let savedCount = 0;
        
        // Store offers in database
        for (const offer of offers) {
          try {
            // Map the API response fields to our expected format
            // Handle prices that can be objects with Minimum/Maximum values
            const formatPrice = (price) => {
              if (!price) return 'N/A';
              if (typeof price === 'object' && price.Minimum !== undefined) {
                return price.Minimum === price.Maximum ? 
                  `$${price.Minimum}` : 
                  `$${price.Minimum} - $${price.Maximum}`;
              }
              return `$${price}`;
            };

            const mappedOffer = {
              id: offer.OfferId || `woot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              title: offer.Title || 'Untitled Offer',
              description: offer.Subtitle || '',
              url: offer.Url || 'https://www.woot.com',
              published_at: offer.StartDate || new Date().toISOString(),
              price: formatPrice(offer.SalePrice),
              originalPrice: formatPrice(offer.ListPrice),
              discount: null, // Calculate discount later if needed
              imageUrl: offer.Photo || null,
              categories: Array.isArray(offer.Categories) ? offer.Categories : [],
              site: offer.Site || 'Woot',
              isSoldOut: offer.IsSoldOut || false,
              endDate: offer.EndDate || null
            };
            
            // Add HTML content
            const offerWithContent = {
              ...mappedOffer,
              content: this.generateItemContent(mappedOffer)
            };
            
            // Save item with the specific category as feed type
            db.saveItem(offerWithContent, 'offers', category);
            savedCount++;
            
            // Log progress every 100 items
            if (savedCount % 100 === 0) {
              console.log(`Saved ${savedCount}/${offers.length} offers for category ${category}`);
            }
          } catch (error) {
            console.error(`Error processing offer for category ${category}:`, error);
            // Continue with the next offer
          }
        }
        
        // Update feed timestamp for this category
        db.updateFeedTimestamp(category);
        
        console.log(`Successfully stored ${savedCount}/${offers.length} offers for category ${category}`);
        totalSavedCount += savedCount;
      }
      
      console.log(`Total offers saved: ${totalSavedCount}`);
      return totalSavedCount;
    } catch (error) {
      console.error('Error fetching and storing offers:', error);
      return 0;
    }
  }
  

  async updateFeeds() {
    try {
      console.log('Updating all feeds from API...');
      const offersCount = await this.fetchAndStoreOffers();
      
      // Clean up old items if needed
      db.cleanupOldItems();
      
      // Clear cache to force regeneration
      this.cached.clear();
      this.lastUpdated = new Date();
      
      console.log(`Updated all feeds at ${this.lastUpdated.toISOString()} - Added ${offersCount} offers`);
      
      return { offersCount };
    } catch (error) {
      console.error('Error updating all feeds:', error);
      throw error;
    }
  }
  
  async updateSpecificFeed(category) {
    try {
      const validCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
      
      // Check if it's a valid category
      if (!this.categories.includes(validCategory)) {
        console.log(`Invalid category: ${category}`);
        return { offersCount: 0, error: 'Invalid category' };
      }
      
      console.log(`Updating feed for category: ${validCategory}...`);
      
      // Fetch data for the specific category
      const categoryOffers = await wootApi.getSpecificCategoryOffers(validCategory);
      let savedCount = 0;
      
      // Process the offers
      if (categoryOffers[validCategory] && categoryOffers[validCategory].length > 0) {
        const offers = categoryOffers[validCategory];
        console.log(`Processing ${offers.length} offers from category ${validCategory}...`);
        
        for (const offer of offers) {
          try {
            // Map the API response fields to our expected format
            // Handle prices that can be objects with Minimum/Maximum values
            const formatPrice = (price) => {
              if (!price) return 'N/A';
              if (typeof price === 'object' && price.Minimum !== undefined) {
                return price.Minimum === price.Maximum ? 
                  `$${price.Minimum}` : 
                  `$${price.Minimum} - $${price.Maximum}`;
              }
              return `$${price}`;
            };

            const mappedOffer = {
              id: offer.OfferId || `woot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              title: offer.Title || 'Untitled Offer',
              description: offer.Subtitle || '',
              url: offer.Url || 'https://www.woot.com',
              published_at: offer.StartDate || new Date().toISOString(),
              price: formatPrice(offer.SalePrice),
              originalPrice: formatPrice(offer.ListPrice),
              discount: null, // Calculate discount later if needed
              imageUrl: offer.Photo || null,
              categories: Array.isArray(offer.Categories) ? offer.Categories : [],
              site: offer.Site || 'Woot',
              isSoldOut: offer.IsSoldOut || false,
              endDate: offer.EndDate || null
            };
            
            // Add HTML content
            const offerWithContent = {
              ...mappedOffer,
              content: this.generateItemContent(mappedOffer)
            };
            
            // Save item with the specific category as feed type
            db.saveItem(offerWithContent, 'offers', validCategory);
            savedCount++;
          } catch (error) {
            console.error(`Error processing offer for category ${validCategory}:`, error);
            // Continue with the next offer
          }
        }
        
        // Update feed timestamp for this category
        db.updateFeedTimestamp(validCategory);
        
        console.log(`Successfully stored ${savedCount}/${offers.length} offers for category ${validCategory}`);
      } else {
        console.log(`No offers found for category ${validCategory}`);
      }
      
      // Clear cache for this category to force regeneration
      if (this.cached.has(validCategory)) {
        this.cached.delete(validCategory);
      }
      
      console.log(`Updated ${validCategory} feed at ${new Date().toISOString()} - Added ${savedCount} offers`);
      
      return { 
        category: validCategory, 
        offersCount: savedCount 
      };
    } catch (error) {
      console.error(`Error updating feed for category ${category}:`, error);
      return { 
        category, 
        offersCount: 0, 
        error: error.message 
      };
    }
  }

  generateItemContent(item) {
    return `
      <div>
        <h2>${item.title}</h2>
        <p>${item.description || ''}</p>
        ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.title}" />` : ''}
        <p>Price: ${item.price || 'N/A'}</p>
        ${item.originalPrice ? `<p>Original Price: ${item.originalPrice}</p>` : ''}
        ${item.discount ? `<p>Discount: ${item.discount}</p>` : ''}
        ${item.site ? `<p>Site: ${item.site}</p>` : ''}
        ${item.categories && item.categories.length > 0 ? `<p>Categories: ${item.categories.join(', ')}</p>` : ''}
        ${item.isSoldOut ? '<p><strong>Sold Out</strong></p>' : ''}
        ${item.endDate ? `<p>Ends: ${new Date(item.endDate).toLocaleString()}</p>` : ''}
        <a href="${item.url}">View on Woot</a>
      </div>
    `;
  }
  
  async generateFeed(category = 'All') {
    // Create a new feed from template
    const feed = this.createFeedTemplate(category === 'All' ? null : category);
    
    // Get items from database for the specific category (most recent 50 by default)
    const items = db.getItems(category, 50);
    
    // Add items to the feed
    for (const item of items) {
      feed.addItem({
        title: item.title,
        id: item.id,
        link: item.url,
        description: item.description,
        content: item.content,
        date: new Date(item.published_at),
        image: item.image_url,
      });
    }
    
    // Generate feed formats
    const feedData = {
      rss: feed.rss2(),
      atom: feed.atom1(),
      json: feed.json1(),
    };
    
    // Cache the results
    this.cached.set(category, feedData);
    
    return feedData;
  }

  async getRssFeed(category = 'All') {
    // Check if we have a cached version for this category
    if (!this.cached.has(category)) {
      await this.generateFeed(category);
    }
    
    return this.cached.get(category).rss;
  }

  async getAtomFeed(category = 'All') {
    // Check if we have a cached version for this category
    if (!this.cached.has(category)) {
      await this.generateFeed(category);
    }
    
    return this.cached.get(category).atom;
  }

  async getJsonFeed(category = 'All') {
    // Check if we have a cached version for this category
    if (!this.cached.has(category)) {
      await this.generateFeed(category);
    }
    
    return this.cached.get(category).json;
  }

  getLastUpdated(category = 'All') {
    // Get the feed update timestamp from the database for the specific category
    const lastUpdated = db.getFeedLastUpdated(category);
    
    if (!lastUpdated) return this.lastUpdated;
    
    return new Date(lastUpdated);
  }
  
  getItemCount(category = null) {
    return db.getItemCount(category);
  }
  
  // Get all available categories
  getCategories() {
    return this.categories;
  }
}

module.exports = new RssGenerator();