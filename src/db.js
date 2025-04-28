const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

class DbService {
  constructor() {
    // Get database path from config
    const dbPath = config.db.path;
    
    // Ensure the directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Open the database
    this.db = new Database(dbPath);
    console.log(`Database initialized at: ${dbPath}`);
    
    this.init();
  }
  
  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        description TEXT,
        content TEXT,
        image_url TEXT,
        price TEXT,
        original_price TEXT,
        discount TEXT,
        feed_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        published_at TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS feeds (
        id TEXT PRIMARY KEY,
        feed_type TEXT NOT NULL,
        last_updated TEXT NOT NULL
      );
    `);
  }
  
  saveItem(item, feedType) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO items (
          id, title, url, description, content, image_url, 
          price, original_price, discount, feed_type, created_at, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const now = new Date().toISOString();
      const publishedAt = item.published_at || item.startDate || item.createdAt || now;
      
      // Log to debug
      console.log('Debug - Saving item: ', {
        id: item.id || item.url || `woot-${Date.now()}`,
        title: item.title || 'Untitled',
        url: item.url || 'https://www.woot.com',
        description: item.description || '',
        contentLength: item.content ? item.content.length : 0,
        imageUrl: item.imageUrl || '',
        price: item.price || '',
        originalPrice: item.originalPrice || '',
        discount: item.discount || '',
        feedType: feedType
      });
      
      stmt.run(
        item.id || item.url || `woot-${Date.now()}`,
        item.title || 'Untitled',
        item.url || 'https://www.woot.com',
        item.description || '',
        item.content || '',
        item.imageUrl || '',
        item.price || '',
        item.originalPrice || '',
        item.discount || '',
        feedType,
        now,
        publishedAt
      );
    } catch (error) {
      console.error('Error saving item to database:', error);
      console.error('Item data:', JSON.stringify({
        id: item.id,
        title: item.title,
        url: item.url,
        published_at: item.published_at
      }));
      throw error;
    }
  }
  
  updateFeedTimestamp(feedType) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO feeds (id, feed_type, last_updated)
      VALUES (?, ?, ?)
    `);
    
    stmt.run(
      feedType,
      feedType,
      new Date().toISOString()
    );
  }
  
  getFeedLastUpdated(feedType) {
    const stmt = this.db.prepare('SELECT last_updated FROM feeds WHERE id = ?');
    const result = stmt.get(feedType);
    return result ? result.last_updated : null;
  }
  
  getItems(feedType = null, limit = 50) {
    let query = 'SELECT * FROM items';
    const params = [];
    
    if (feedType) {
      query += ' WHERE feed_type = ?';
      params.push(feedType);
    }
    
    query += ' ORDER BY published_at DESC LIMIT ?';
    params.push(limit);
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }
  
  getItemCount(feedType = null) {
    let query = 'SELECT COUNT(*) as count FROM items';
    const params = [];
    
    if (feedType) {
      query += ' WHERE feed_type = ?';
      params.push(feedType);
    }
    
    const stmt = this.db.prepare(query);
    const result = stmt.get(...params);
    return result ? result.count : 0;
  }
  
  cleanupOldItems() {
    try {
      const maxItems = config.db.maxItems;
      
      // Get current item count
      const totalItems = this.getItemCount();
      
      // If we have more than the max, delete the oldest ones
      if (totalItems > maxItems) {
        const itemsToDelete = totalItems - maxItems;
        console.log(`Cleaning up database - removing ${itemsToDelete} oldest items`);
        
        const stmt = this.db.prepare(`
          DELETE FROM items 
          WHERE id IN (
            SELECT id FROM items 
            ORDER BY published_at ASC 
            LIMIT ?
          )
        `);
        
        const result = stmt.run(itemsToDelete);
        console.log(`Removed ${result.changes} old items from database`);
      }
    } catch (error) {
      console.error('Error cleaning up old items:', error);
    }
  }
  
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = new DbService();