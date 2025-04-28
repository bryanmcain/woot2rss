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
      
      // Store offers in database
      for (const offer of offers) {
        const offerWithContent = {
          ...offer,
          content: this.generateItemContent(offer)
        };
        db.saveItem(offerWithContent, 'offers');
      }
      
      // Update feed timestamp
      db.updateFeedTimestamp('offers');
      
      console.log(`Stored ${offers.length} offers in database`);
      return offers.length;
    } catch (error) {
      console.error('Error fetching and storing offers:', error);
      return 0;
    }
  }
  
  async fetchAndStoreEvents() {
    try {
      console.log('Fetching events from Woot API...');
      
      // Fetch data from Woot API
      const events = await wootApi.getEvents();
      
      // Store events in database
      for (const event of events) {
        const eventWithContent = {
          ...event,
          content: this.generateItemContent(event)
        };
        db.saveItem(eventWithContent, 'events');
      }
      
      // Update feed timestamp
      db.updateFeedTimestamp('events');
      
      console.log(`Stored ${events.length} events in database`);
      return events.length;
    } catch (error) {
      console.error('Error fetching and storing events:', error);
      return 0;
    }
  }

  async updateFeeds() {
    try {
      console.log('Updating feeds from API...');
      const offersCount = await this.fetchAndStoreOffers();
      const eventsCount = await this.fetchAndStoreEvents();
      
      // Clean up old items if needed
      db.cleanupOldItems();
      
      // Clear cache to force regeneration
      this.cached = null;
      this.lastUpdated = new Date();
      
      console.log(`Updated feeds at ${this.lastUpdated.toISOString()} - Added ${offersCount} offers and ${eventsCount} events`);
      
      return { offersCount, eventsCount };
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
    // Get the most recent feed update timestamp from the database
    const offersLastUpdated = db.getFeedLastUpdated('offers');
    const eventsLastUpdated = db.getFeedLastUpdated('events');
    
    if (!offersLastUpdated && !eventsLastUpdated) return this.lastUpdated;
    
    if (offersLastUpdated && eventsLastUpdated) {
      return new Date(Math.max(new Date(offersLastUpdated), new Date(eventsLastUpdated)));
    }
    
    return new Date(offersLastUpdated || eventsLastUpdated);
  }
  
  getItemCount() {
    return db.getItemCount();
  }
}

module.exports = new RssGenerator();