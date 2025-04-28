const { Feed } = require('feed');
const wootApi = require('./api');

class RssGenerator {
  constructor() {
    this.feed = new Feed({
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

  async updateFeed() {
    try {
      console.log('Updating RSS feed...');
      
      // Fetch data from Woot API
      const offers = await wootApi.getOffers();
      
      // Create a new feed
      this.feed = new Feed({
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

      // Add items to the feed
      for (const offer of offers) {
        this.feed.addItem({
          title: offer.title,
          id: offer.id || offer.url,
          link: offer.url,
          description: offer.description,
          content: this.generateItemContent(offer),
          date: new Date(offer.startDate || offer.createdAt || new Date()),
          image: offer.imageUrl,
          price: offer.price,
        });
      }

      // Cache the generated RSS
      this.cached = {
        rss: this.feed.rss2(),
        atom: this.feed.atom1(),
        json: this.feed.json1(),
      };
      
      this.lastUpdated = new Date();
      console.log(`RSS feed updated at ${this.lastUpdated.toISOString()}`);
      
      return this.cached;
    } catch (error) {
      console.error('Error updating RSS feed:', error);
      throw error;
    }
  }

  generateItemContent(offer) {
    return `
      <div>
        <h2>${offer.title}</h2>
        <p>${offer.description}</p>
        ${offer.imageUrl ? `<img src="${offer.imageUrl}" alt="${offer.title}" />` : ''}
        <p>Price: ${offer.price}</p>
        ${offer.originalPrice ? `<p>Original Price: ${offer.originalPrice}</p>` : ''}
        ${offer.discount ? `<p>Discount: ${offer.discount}</p>` : ''}
        <a href="${offer.url}">View on Woot</a>
      </div>
    `;
  }

  async getRssFeed() {
    if (!this.cached) {
      await this.updateFeed();
    }
    return this.cached.rss;
  }

  async getAtomFeed() {
    if (!this.cached) {
      await this.updateFeed();
    }
    return this.cached.atom;
  }

  async getJsonFeed() {
    if (!this.cached) {
      await this.updateFeed();
    }
    return this.cached.json;
  }

  getLastUpdated() {
    return this.lastUpdated;
  }
}

module.exports = new RssGenerator();