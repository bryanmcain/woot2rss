const { Feed } = require('feed');
const wootApi = require('./api');
const db = require('./db');

class RssGenerator {
  constructor() {
    this.createFeedTemplate = (category) => {
      const title = `Woot Deals - ${category}`;
      const description = `Latest ${category} deals from Woot`;
      const categorySlug = this.getCategorySlug(category);
      
      // Construct links using the slug format
      const link = `https://www.woot.com/category/${categorySlug}`;
      
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
          rss: category ? `/rss/${categorySlug}` : '/rss',
        },
      });
    };
    
    // Map to store cached feeds by category
    this.cached = new Map();
    this.lastUpdated = null;
    
    // Get the initial categories from the API's known sites
    // This will be updated dynamically as new sites are discovered from the API
    this.categories = [...wootApi.knownSites];
    
    // Track all known categories (including those discovered at runtime)
    this.allKnownCategories = new Set(this.categories);
  }

  async fetchAndStoreOffers() {
    try {
      console.log('Fetching all offers from Woot API using single /All endpoint...');
      
      // Fetch data from Woot API for all sites/categories at once from the /All endpoint
      const categoryOffers = await wootApi.getAllOffers();
      let totalSavedCount = 0;
      let newCategoriesFound = 0;
      
      // Process each category/site from the API response
      for (const [site, offers] of Object.entries(categoryOffers)) {
        console.log(`Processing ${offers.length} offers from site/category: ${site}...`);
        
        // Add this site to our known categories if it's new
        if (!this.allKnownCategories.has(site)) {
          this.allKnownCategories.add(site);
          this.categories.push(site);
          newCategoriesFound++;
          console.log(`Found new site/category: ${site}`);
        }
        
        let savedCount = 0;
        
        // Store offers in database
        for (const offer of offers) {
          try {
            // Save item directly with its Site property
            // Our new saveItem method handles creating new categories as needed
            const success = db.saveItem(offer);
            
            if (success) {
              savedCount++;
              
              // Log progress every 50 items
              if (savedCount % 50 === 0) {
                console.log(`Saved ${savedCount}/${offers.length} offers for site/category ${site}`);
              }
            }
          } catch (error) {
            console.error(`Error processing offer for site/category ${site}:`, error);
            // Continue with the next offer
          }
        }
        
        // Update feed timestamp for this category
        db.updateFeedTimestamp(site);
        
        console.log(`Successfully stored ${savedCount}/${offers.length} offers for site/category ${site}`);
        totalSavedCount += savedCount;
      }
      
      if (newCategoriesFound > 0) {
        console.log(`Found ${newCategoriesFound} new site categories from the API`);
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
      // Standardize category name with first letter uppercase, rest lowercase
      const validCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
      
      // Even if it's not in our list of known categories yet, we'll try to fetch it
      console.log(`Updating feed for category: ${validCategory}...`);
      
      // Fetch all data and filter by the requested category/site
      const allOffers = await wootApi.getAllOffers();
      
      // Check if the category exists in the fetched data
      if (!allOffers[validCategory]) {
        // If category doesn't exist and we don't know about it
        if (!this.allKnownCategories.has(validCategory)) {
          console.log(`Category ${validCategory} not found in available sites`);
          return { offersCount: 0, error: 'Category not found in available sites' };
        } else {
          // We know about this category but no current offers
          console.log(`No current offers for category ${validCategory}`);
          
          // Update the feed timestamp anyway
          db.updateFeedTimestamp(validCategory);
          
          return { 
            category: validCategory, 
            offersCount: 0
          };
        }
      }
      
      // If we reach here, we have offers for this category
      const offers = allOffers[validCategory];
      let savedCount = 0;
      
      console.log(`Processing ${offers.length} offers for category ${validCategory}...`);
      
      // Add this category to our list if it's new
      if (!this.allKnownCategories.has(validCategory)) {
        this.allKnownCategories.add(validCategory);
        this.categories.push(validCategory);
        console.log(`Added new category: ${validCategory}`);
      }
      
      // Process each offer
      for (const offer of offers) {
        try {
          // Save directly - our db.saveItem method now handles the Site field mapping
          const success = db.saveItem(offer);
          
          if (success) {
            savedCount++;
          }
        } catch (error) {
          console.error(`Error processing offer for category ${validCategory}:`, error);
          // Continue with the next offer
        }
      }
      
      // Update feed timestamp
      db.updateFeedTimestamp(validCategory);
      
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
  
  async generateFeed(category) {
    // Create a new feed from template
    const feed = this.createFeedTemplate(category);
    
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

  async getRssFeed(category) {
    // Check if we have a cached version for this category
    if (!this.cached.has(category)) {
      await this.generateFeed(category);
    }
    
    return this.cached.get(category).rss;
  }

  async getAtomFeed(category) {
    // Check if we have a cached version for this category
    if (!this.cached.has(category)) {
      await this.generateFeed(category);
    }
    
    return this.cached.get(category).atom;
  }

  async getJsonFeed(category) {
    // Check if we have a cached version for this category
    if (!this.cached.has(category)) {
      await this.generateFeed(category);
    }
    
    return this.cached.get(category).json;
  }

  getLastUpdated(category) {
    // Get the feed update timestamp from the database for the specific category
    const lastUpdated = db.getFeedLastUpdated(category);
    
    if (!lastUpdated) return this.lastUpdated;
    
    return new Date(lastUpdated);
  }
  
  getItemCount(category = null) {
    // If no specific category requested, sum up items across all categories
    if (category === null) {
      let total = 0;
      for (const cat of this.categories) {
        total += db.getItemCount(cat);
      }
      return total;
    }
    return db.getItemCount(category);
  }
  
  // Get all available categories
  getCategories() {
    // Return the array of categories we know about, including any discovered at runtime
    return [...this.allKnownCategories];
  }
  
  // Helper method to convert category to URL-friendly slug
  getCategorySlug(category) {
    return category.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
}

module.exports = new RssGenerator();