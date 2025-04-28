const { Feed } = require('feed');
const wootApi = require('./api');
const db = require('./db');

class RssGenerator {
  constructor() {
    this.createFeedTemplate = () => new Feed({
      title: 'Woot Deals',
      description: 'Latest deals from Woot',
      id: 'https://www.woot.com/',
      link: 'https://www.woot.com/',
      language: 'en',
      favicon: 'https://www.woot.com/favicon.ico',
      copyright: `All rights reserved ${new Date().getFullYear()}, Woot`,
      updated: new Date(),
      generator: 'Woot2RSS',
      feedLinks: {
        rss: 'https://example.com/rss',
      },
    });
    
    this.cached = null;
    this.lastUpdated = null;
  }

  async fetchAndStoreOffers() {
    try {
      console.log('Fetching offers from Woot API...');
      
      // Fetch data from Woot API
      const offers = await wootApi.getOffers();
      console.log(`Processing ${offers.length} offers from the API...`);
      
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
          
          db.saveItem(offerWithContent, 'offers');
          savedCount++;
          
          // Log progress every 100 items
          if (savedCount % 100 === 0) {
            console.log(`Saved ${savedCount}/${offers.length} offers to database`);
          }
        } catch (error) {
          console.error(`Error processing offer:`, error);
          // Continue with the next offer
        }
      }
      
      // Update feed timestamp
      db.updateFeedTimestamp('offers');
      
      console.log(`Successfully stored ${savedCount}/${offers.length} offers in database`);
      return savedCount;
    } catch (error) {
      console.error('Error fetching and storing offers:', error);
      return 0;
    }
  }
  

  async updateFeeds() {
    try {
      console.log('Updating feeds from API...');
      const offersCount = await this.fetchAndStoreOffers();
      
      // Clean up old items if needed
      db.cleanupOldItems();
      
      // Clear cache to force regeneration
      this.cached = null;
      this.lastUpdated = new Date();
      
      console.log(`Updated feeds at ${this.lastUpdated.toISOString()} - Added ${offersCount} offers`);
      
      return { offersCount };
    } catch (error) {
      console.error('Error updating feeds:', error);
      throw error;
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
  
  async generateFeed() {
    // Create a new feed from template
    const feed = this.createFeedTemplate();
    
    // Get items from database (most recent 50 by default)
    const items = db.getItems(null, 50);
    
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
    
    // Store generated feed formats
    this.cached = {
      rss: feed.rss2(),
      atom: feed.atom1(),
      json: feed.json1(),
    };
    
    return this.cached;
  }

  async getRssFeed() {
    if (!this.cached) {
      await this.generateFeed();
    }
    return this.cached.rss;
  }

  async getAtomFeed() {
    if (!this.cached) {
      await this.generateFeed();
    }
    return this.cached.atom;
  }

  async getJsonFeed() {
    if (!this.cached) {
      await this.generateFeed();
    }
    return this.cached.json;
  }

  getLastUpdated() {
    // Get the feed update timestamp from the database
    const offersLastUpdated = db.getFeedLastUpdated('offers');
    
    if (!offersLastUpdated) return this.lastUpdated;
    
    return new Date(offersLastUpdated);
  }
  
  getItemCount() {
    return db.getItemCount();
  }
}

module.exports = new RssGenerator();